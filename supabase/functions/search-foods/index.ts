import { authenticatedUser } from "../_shared/auth.ts";
import {
  handlePreflight,
  json,
  requestOriginAllowed,
} from "../_shared/http.ts";

const examples = [
  {
    id: "example-yogurt",
    name: "플레인 그릭요거트",
    maker: "예시 항목",
    servingAmount: 100,
    servingUnit: "g",
    calories: 120,
    carbs: 8,
    protein: 10,
    fat: 5,
    sugar: 5,
    sodium: 55,
    fiber: 0,
    sourceType: "reference",
    sourceLabel: "공식 DB 연결 전 참고값",
  },
  {
    id: "example-chicken",
    name: "닭가슴살 구이",
    maker: "예시 항목",
    servingAmount: 100,
    servingUnit: "g",
    calories: 165,
    carbs: 0,
    protein: 31,
    fat: 3.6,
    sugar: 0,
    sodium: 74,
    fiber: 0,
    sourceType: "reference",
    sourceLabel: "공식 DB 연결 전 참고값",
  },
  {
    id: "example-rice",
    name: "현미밥",
    maker: "예시 항목",
    servingAmount: 210,
    servingUnit: "g",
    calories: 315,
    carbs: 68,
    protein: 6,
    fat: 2.4,
    sugar: 0.6,
    sodium: 7,
    fiber: 3.5,
    sourceType: "reference",
    sourceLabel: "공식 DB 연결 전 참고값",
  },
];

function pick(item: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function numeric(item: Record<string, unknown>, keys: string[]) {
  const value = Number(pick(item, keys, 0));
  return Number.isFinite(value) ? value : 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handlePreflight(request);
  if (request.method !== "POST") return json(request, { error: "POST 요청만 지원합니다." }, 405);
  if (!requestOriginAllowed(request)) {
    return json(request, { error: "허용되지 않은 요청 출처입니다." }, 403);
  }

  try {
    const user = await authenticatedUser(request);
    if (!user) return json(request, { error: "로그인이 필요합니다." }, 401);

    const { query } = (await request.json()) as { query?: string };
    const normalizedQuery = query?.trim() ?? "";
    if (!normalizedQuery) return json(request, { foods: [] });

    const apiKey = Deno.env.get("FOOD_DB_API_KEY");
    if (!apiKey) {
      const normalized = normalizedQuery.toLowerCase();
      const matches = examples.filter((item) =>
        item.name.toLowerCase().includes(normalized),
      );
      return json(request, { foods: matches.length > 0 ? matches : examples });
    }

    const endpoint = new URL(
      "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02",
    );
    endpoint.searchParams.set("serviceKey", apiKey);
    endpoint.searchParams.set("type", "json");
    endpoint.searchParams.set("pageNo", "1");
    endpoint.searchParams.set("numOfRows", "12");
    endpoint.searchParams.set("FOOD_NM_KR", normalizedQuery);

    const response = await fetch(endpoint, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("공식 식품 DB가 응답하지 않았습니다.");

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
    const foods = rawItems.slice(0, 12).map((raw, index) => {
      const item = raw as Record<string, unknown>;
      return {
        id: String(
          pick(item, ["FOOD_CD", "foodCd", "NUM"], `mfds-${index}`),
        ),
        name: String(
          pick(item, ["FOOD_NM_KR", "foodNm", "FOOD_NM"], normalizedQuery),
        ),
        maker: String(pick(item, ["MKR_NM", "makerNm", "COMPANY_NM"], "")),
        servingAmount: numeric(item, [
          "NUT_CON_SRTR_QUA",
          "SERVING_SIZE",
          "foodSize",
        ]),
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
    return json(request, { foods });
  } catch (error) {
    return json(
      request,
      {
        error:
          error instanceof Error
            ? error.message
            : "식품 DB를 검색하지 못했습니다.",
      },
      502,
    );
  }
});
