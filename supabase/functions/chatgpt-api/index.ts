import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const units = new Set(["g", "kg", "ml", "l", "개", "인분", "공기", "컵", "큰술", "작은술"]);
const mealTypes: Record<string, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

function number(body: Record<string, unknown>, key: string, nullable = false) {
  if (nullable && (body[key] === null || body[key] === undefined)) return null;
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key}는 0 이상의 숫자여야 합니다.`);
  return value;
}

function text(body: Record<string, unknown>, key: string, nullable = false) {
  if (nullable && (body[key] === null || body[key] === undefined)) return null;
  const value = String(body[key] ?? "").trim();
  if (!value) throw new Error(`${key}가 필요합니다.`);
  return value.slice(0, 500);
}

Deno.serve(async (request) => {
  const expected = Deno.env.get("CHATGPT_API_TOKEN");
  let userId = Deno.env.get("CHATGPT_USER_ID");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected) return json({ error: "ChatGPT API 환경변수가 설정되지 않았습니다." }, 503);
  if (!token || token !== expected) return json({ error: "유효하지 않은 Bearer 토큰입니다." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (!userId) {
    const { data: ownerRows } = await supabase
      .from("meals")
      .select("user_id")
      .limit(1);
    userId = ownerRows?.[0]?.user_id;
    if (!userId) {
      const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 2 });
      if (data.users.length !== 1) {
        return json({ error: "CHATGPT_USER_ID 환경변수를 설정해주세요." }, 503);
      }
      userId = data.users[0].id;
    }
  }
  const url = new URL(request.url);
  const marker = "/api/chatgpt";
  const path = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);

  try {
    if (request.method === "POST" && path === "/foods") {
      const body = (await request.json()) as Record<string, unknown>;
      const unit = text(body, "servingUnit")!;
      if (!units.has(unit.toLowerCase())) throw new Error("지원하지 않는 servingUnit입니다.");
      const values = {
        user_id: userId,
        name: text(body, "name"),
        serving_amount: number(body, "servingAmount"),
        serving_unit: unit,
        weight_grams: number(body, "weightGrams", true),
        calories: number(body, "caloriesKcal"),
        carbs: number(body, "carbohydratesGrams"),
        protein: number(body, "proteinGrams"),
        fat: number(body, "fatGrams"),
        sodium: number(body, "sodiumMilligrams", true) ?? 0,
        sugar: number(body, "sugarsGrams", true) ?? 0,
        source: text(body, "source", true),
        notes: text(body, "notes", true),
      };
      const { data, error } = await supabase.from("saved_foods").insert(values).select("*").single();
      if (error) throw error;
      return json({ success: true, food: data }, 201);
    }

    if (request.method === "GET" && path === "/foods/search") {
      const query = url.searchParams.get("query")?.trim();
      if (!query) return json({ error: "query가 필요합니다." }, 400);
      const { data, error } = await supabase.from("saved_foods").select("*")
        .eq("user_id", userId).ilike("name", `%${query}%`).limit(20);
      if (error) throw error;
      return json({ foods: data ?? [] });
    }

    if (request.method === "POST" && path === "/meal-entries") {
      const body = (await request.json()) as Record<string, unknown>;
      const eatenAt = new Date(text(body, "eatenAt")!);
      if (Number.isNaN(eatenAt.getTime())) throw new Error("eatenAt은 ISO 8601 형식이어야 합니다.");
      const local = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(eatenAt);
      const part = (type: string) => local.find((item) => item.type === type)?.value ?? "";
      const mealDate = `${part("year")}-${part("month")}-${part("day")}`;
      const mealTime = `${part("hour")}:${part("minute")}`;
      const type = String(body.mealType ?? "");
      if (!mealTypes[type]) throw new Error("mealType이 올바르지 않습니다.");
      const unit = text(body, "unit")!;
      if (!units.has(unit.toLowerCase())) throw new Error("지원하지 않는 unit입니다.");
      const foodName = text(body, "foodName")!;
      const amount = number(body, "amount");
      const { data: duplicate } = await supabase.from("meals").select("id")
        .eq("user_id", userId).eq("meal_date", mealDate).eq("meal_time", mealTime)
        .eq("food_name", foodName).eq("serving_amount", amount).eq("serving_unit", unit)
        .maybeSingle();
      if (duplicate) return json({ success: true, duplicate: true, mealEntryId: duplicate.id });
      const { data, error } = await supabase.from("meals").insert({
        user_id: userId, meal_date: mealDate, meal_time: mealTime,
        meal_type: mealTypes[type], food_name: foodName, serving_amount: amount,
        serving_unit: unit, weight_grams: number(body, "weightGrams", true),
        calories: number(body, "caloriesKcal"), carbs: number(body, "carbohydratesGrams"),
        protein: number(body, "proteinGrams"), fat: number(body, "fatGrams"),
        source_type: "manual", source_label: "ChatGPT Action",
        notes: text(body, "notes", true), sugar: 0, sodium: 0, fiber: 0,
      }).select("*").single();
      if (error) throw error;
      return json({ success: true, duplicate: false, mealEntry: data }, 201);
    }

    if (request.method === "GET" && path === "/meal-entries") {
      const date = url.searchParams.get("date") ?? "";
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return json({ error: "date는 YYYY-MM-DD 형식이어야 합니다." }, 400);
      const { data, error } = await supabase.from("meals").select("*")
        .eq("user_id", userId).eq("meal_date", date).order("meal_time");
      if (error) throw error;
      return json({ date, timezone: "Asia/Seoul", mealEntries: data ?? [] });
    }

    const deleteMatch = path.match(/^\/meal-entries\/([0-9a-f-]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      const { data, error } = await supabase.from("meals").delete()
        .eq("user_id", userId).eq("id", deleteMatch[1]).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ success: false, error: "기록을 찾지 못했습니다." }, 404);
      return json({ success: true, deletedMealEntryId: data.id });
    }
    return json({ error: "지원하지 않는 경로입니다." }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, 400);
  }
});
