import { env } from "cloudflare:workers";

type AppEnv = {
  FOOD_DB_API_KEY?: string;
  USDA_FOODDATA_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_LOOKUP_MODEL?: string;
};

function pick(item: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function numeric(item: Record<string, unknown>, keys: string[]) {
  const raw = String(pick(item, keys, 0)).replaceAll(",", "");
  const value = Number(raw.match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function responseText(response: Record<string, unknown>) {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      const record = part as Record<string, unknown>;
      if (record.type === "output_text" && typeof record.text === "string") {
        return record.text.trim();
      }
    }
  }
  return "";
}

async function translateForUsda(query: string, appEnv: AppEnv) {
  if (!/[가-힣]/.test(query) || !appEnv.OPENAI_API_KEY) return query;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${appEnv.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: appEnv.OPENAI_LOOKUP_MODEL || "gpt-5.6-luna",
        reasoning: { effort: "none" },
        input: `Translate this Korean food name into a concise English USDA FoodData Central search phrase. Preserve cooking method and main ingredients. Return only the search phrase: ${query}`,
        text: { verbosity: "low" },
      }),
    });
    if (!response.ok) return query;
    const translated = responseText(
      (await response.json()) as Record<string, unknown>,
    );
    return translated || query;
  } catch {
    return query;
  }
}

function usdaNutrient(
  food: Record<string, unknown>,
  names: string[],
  unit?: string,
) {
  const nutrients = Array.isArray(food.foodNutrients)
    ? (food.foodNutrients as Array<Record<string, unknown>>)
    : [];
  const wanted = names.map((name) => name.toLowerCase());
  const found = nutrients.find(
    (nutrient) =>
      wanted.includes(String(nutrient.nutrientName ?? "").toLowerCase()) &&
      (!unit || String(nutrient.unitName ?? "").toUpperCase() === unit),
  );
  const value = Number(found?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function searchUsda(query: string, appEnv: AppEnv) {
  const translatedQuery = await translateForUsda(query, appEnv);
  const endpoint = new URL(
    "https://api.nal.usda.gov/fdc/v1/foods/search",
  );
  endpoint.searchParams.set(
    "api_key",
    appEnv.USDA_FOODDATA_API_KEY || "DEMO_KEY",
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: translatedQuery,
      pageSize: 12,
      dataType: ["Foundation", "Survey (FNDDS)", "SR Legacy"],
    }),
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "공식 영양 DB의 임시 검색 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
    throw new Error("USDA 공식 영양 DB가 응답하지 않았습니다.");
  }
  const body = (await response.json()) as Record<string, unknown>;
  const rawFoods = Array.isArray(body.foods) ? body.foods : [];
  return rawFoods.slice(0, 12).map((raw, index) => {
    const food = raw as Record<string, unknown>;
    const description = String(food.description ?? translatedQuery);
    return {
      id: `usda-${String(food.fdcId ?? index)}`,
      name: query,
      maker: description,
      servingAmount: 100,
      servingUnit: "g",
      calories: usdaNutrient(food, ["Energy"], "KCAL"),
      carbs: usdaNutrient(food, ["Carbohydrate, by difference"]),
      protein: usdaNutrient(food, ["Protein"]),
      fat: usdaNutrient(food, ["Total lipid (fat)"]),
      sugar: usdaNutrient(food, [
        "Total Sugars",
        "Sugars, total including NLEA",
      ]),
      sodium: usdaNutrient(food, ["Sodium, Na"]),
      fiber: usdaNutrient(food, ["Fiber, total dietary"]),
      sourceType: "database",
      sourceLabel: "USDA FoodData Central · 100g 기준",
    };
  });
}

async function searchMfds(query: string, apiKey: string) {
  const endpoint = new URL(
    "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02",
  );
  endpoint.searchParams.set("serviceKey", apiKey);
  endpoint.searchParams.set("type", "json");
  endpoint.searchParams.set("pageNo", "1");
  endpoint.searchParams.set("numOfRows", "12");
  endpoint.searchParams.set("FOOD_NM_KR", query);
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("식약처 공식 식품 DB가 응답하지 않았습니다.");
  const body = (await response.json()) as Record<string, unknown>;
  const bodyContainer =
    (body.body as Record<string, unknown> | undefined) ??
    ((body.response as Record<string, unknown> | undefined)?.body as
      | Record<string, unknown>
      | undefined);
  const itemContainer = bodyContainer?.items;
  const rawItems = Array.isArray(itemContainer)
    ? itemContainer
    : Array.isArray((itemContainer as Record<string, unknown> | undefined)?.item)
      ? ((itemContainer as Record<string, unknown>).item as unknown[])
      : [];
  return rawItems.slice(0, 12).map((raw, index) => {
    const item = raw as Record<string, unknown>;
    return {
      id: String(pick(item, ["FOOD_CD", "foodCd", "NUM"], `mfds-${index}`)),
      name: String(pick(item, ["FOOD_NM_KR", "foodNm", "FOOD_NM"], query)),
      maker: String(pick(item, ["MKR_NM", "makerNm", "COMPANY_NM"], "")),
      servingAmount:
        numeric(item, [
          "NUT_CON_SRTR_QUA",
          "SERVING_SIZE",
          "foodSize",
        ]) || 100,
      servingUnit: "g",
      calories: numeric(item, ["AMT_NUM1", "ENERGY_KCAL", "enerc"]),
      carbs: numeric(item, ["AMT_NUM7", "CHOCDF", "carbohydrate"]),
      protein: numeric(item, ["AMT_NUM3", "PROT", "protein"]),
      fat: numeric(item, ["AMT_NUM4", "FATCE", "fat"]),
      sugar: numeric(item, ["AMT_NUM8", "SUGAR", "sugar"]),
      sodium: numeric(item, ["AMT_NUM13", "NA", "sodium"]),
      fiber: numeric(item, ["AMT_NUM6", "FIBER", "fiber"]),
      sourceType: "database",
      sourceLabel: "식약처 식품영양성분 DB",
    };
  });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ foods: [] });
  const appEnv = env as unknown as AppEnv;

  try {
    if (appEnv.FOOD_DB_API_KEY) {
      try {
        const foods = await searchMfds(query, appEnv.FOOD_DB_API_KEY);
        if (foods.length > 0) return Response.json({ foods });
      } catch (error) {
        console.warn(
          "MFDS food search failed; using USDA fallback",
          error instanceof Error ? error.message : error,
        );
      }
    }
    return Response.json({ foods: await searchUsda(query, appEnv) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "공식 식품 DB를 검색하지 못했습니다.",
      },
      { status: 502 },
    );
  }
}
