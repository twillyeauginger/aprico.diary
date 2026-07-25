import {
  createClient,
  FunctionsHttpError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type {
  AnalysisResult,
  DayType,
  FoodResult,
  MealInput,
  MealRecord,
  NutritionClient,
  NutritionGoals,
  SavedFood,
  SavedFoodInput,
  SourceType,
} from "../app/nutrition-dashboard";
import { DEFAULT_GOALS } from "../app/nutrition-dashboard";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

type MealRow = {
  id: string;
  meal_date: string;
  meal_time: string | null;
  meal_type: string;
  food_name: string;
  source_type: SourceType;
  source_label: string;
  serving_amount: number;
  serving_unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
  confidence: number | null;
  photo_path: string | null;
};

type SavedFoodRow = {
  id: string;
  name: string;
  serving_amount: number;
  serving_unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
};

function rowToSavedFood(row: SavedFoodRow): SavedFood {
  return {
    id: row.id,
    name: row.name,
    servingAmount: Number(row.serving_amount),
    servingUnit: row.serving_unit,
    calories: Number(row.calories),
    carbs: Number(row.carbs),
    protein: Number(row.protein),
    fat: Number(row.fat),
    sugar: Number(row.sugar),
    sodium: Number(row.sodium),
    fiber: Number(row.fiber),
  };
}

function savedFoodValues(payload: SavedFoodInput) {
  return {
    name: payload.name,
    serving_amount: payload.servingAmount,
    serving_unit: payload.servingUnit,
    calories: payload.calories,
    carbs: payload.carbs,
    protein: payload.protein,
    fat: payload.fat,
    sugar: payload.sugar,
    sodium: payload.sodium,
    fiber: payload.fiber,
  };
}

function rowToMeal(row: MealRow): MealRecord {
  return {
    id: row.id,
    mealDate: row.meal_date,
    mealTime: row.meal_time?.slice(0, 5) ?? "",
    mealType: row.meal_type,
    foodName: row.food_name,
    sourceType: row.source_type,
    sourceLabel: row.source_label,
    servingAmount: Number(row.serving_amount),
    servingUnit: row.serving_unit,
    calories: Number(row.calories),
    carbs: Number(row.carbs),
    protein: Number(row.protein),
    fat: Number(row.fat),
    sugar: Number(row.sugar),
    sodium: Number(row.sodium),
    fiber: Number(row.fiber),
    confidence:
      row.confidence === null || row.confidence === undefined
        ? null
        : Number(row.confidence),
    photoId: row.photo_path,
  };
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function requireUser(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
  }
  return user;
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context
      .json()
      .catch(() => null)) as { error?: unknown } | null;
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
  }
  if (error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`;
  }
  return fallback;
}

export function createSupabaseNutritionClient(
  client: SupabaseClient,
): NutritionClient {
  return {
    async listMeals(month) {
      const { data, error } = await client
        .from("meals")
        .select("*")
        .gte("meal_date", `${month}-01`)
        .lt("meal_date", nextMonth(month))
        .order("meal_date", { ascending: true })
        .order("meal_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw new Error(`기록을 불러오지 못했습니다: ${error.message}`);
      return ((data ?? []) as MealRow[]).map(rowToMeal);
    },

    async listAllMeals() {
      const { data, error } = await client
        .from("meals")
        .select("*")
        .order("meal_date", { ascending: false })
        .order("meal_time", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(`음식 목록을 불러오지 못했습니다: ${error.message}`);
      return ((data ?? []) as MealRow[]).map(rowToMeal);
    },

    async createMeal(payload: MealInput) {
      const user = await requireUser(client);
      const { data, error } = await client
        .from("meals")
        .insert({
          user_id: user.id,
          meal_date: payload.mealDate,
          meal_time: payload.mealTime || null,
          meal_type: payload.mealType,
          food_name: payload.foodName,
          source_type: payload.sourceType,
          source_label: payload.sourceLabel,
          serving_amount: payload.servingAmount,
          serving_unit: payload.servingUnit,
          calories: payload.calories,
          carbs: payload.carbs,
          protein: payload.protein,
          fat: payload.fat,
          sugar: payload.sugar,
          sodium: payload.sodium,
          fiber: payload.fiber,
          confidence: payload.confidence ?? null,
          photo_path: payload.photoId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(`기록을 저장하지 못했습니다: ${error.message}`);
      return rowToMeal(data as MealRow);
    },

    async updateMeal(id, payload) {
      const { data, error } = await client
        .from("meals")
        .update({
          meal_date: payload.mealDate,
          meal_time: payload.mealTime || null,
          meal_type: payload.mealType,
          food_name: payload.foodName,
          source_type: "manual",
          source_label: "사용자 수정",
          serving_amount: payload.servingAmount,
          serving_unit: payload.servingUnit,
          calories: payload.calories,
          carbs: payload.carbs,
          protein: payload.protein,
          fat: payload.fat,
          sugar: payload.sugar,
          sodium: payload.sodium,
          fiber: payload.fiber,
          confidence: null,
          photo_path: null,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(`기록을 수정하지 못했습니다: ${error.message}`);
      return rowToMeal(data as MealRow);
    },

    async deleteMeal(id) {
      const { error } = await client.from("meals").delete().eq("id", id);
      if (error) throw new Error(`기록을 삭제하지 못했습니다: ${error.message}`);
    },

    async listSavedFoods() {
      const { data, error } = await client
        .from("saved_foods")
        .select("*")
        .order("name");
      if (error) throw new Error(`내 음식 DB를 불러오지 못했습니다: ${error.message}`);
      return ((data ?? []) as SavedFoodRow[]).map(rowToSavedFood);
    },

    async createSavedFood(payload) {
      const user = await requireUser(client);
      const { data, error } = await client
        .from("saved_foods")
        .insert({ user_id: user.id, ...savedFoodValues(payload) })
        .select("*")
        .single();
      if (error) throw new Error(`음식을 저장하지 못했습니다: ${error.message}`);
      return rowToSavedFood(data as SavedFoodRow);
    },

    async updateSavedFood(id, payload) {
      const { data, error } = await client
        .from("saved_foods")
        .update(savedFoodValues(payload))
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(`음식을 수정하지 못했습니다: ${error.message}`);
      return rowToSavedFood(data as SavedFoodRow);
    },

    async deleteSavedFood(id) {
      const { error } = await client.from("saved_foods").delete().eq("id", id);
      if (error) throw new Error(`음식을 삭제하지 못했습니다: ${error.message}`);
    },

    async getNutritionGoals() {
      const { data, error } = await client
        .from("nutrition_goals")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`영양 목표를 불러오지 못했습니다: ${error.message}`);
      if (!data) return DEFAULT_GOALS;
      const row = data as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(DEFAULT_GOALS).map(([key, fallback]) => [
          key,
          key === "goalType"
            ? String(row.goal_type ?? fallback)
            : Number(row[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] ?? fallback),
        ]),
      ) as NutritionGoals;
    },

    async updateNutritionGoals(goals) {
      const user = await requireUser(client);
      const values = {
        user_id: user.id,
        goal_type: goals.goalType,
        ...Object.fromEntries(
          Object.entries(goals)
            .filter(([key]) => key !== "goalType")
            .map(([key, value]) => [
              key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
              value,
            ]),
        ),
        updated_at: new Date().toISOString(),
      };
      const { error } = await client
        .from("nutrition_goals")
        .upsert(values, { onConflict: "user_id" });
      if (error) throw new Error(`영양 목표를 저장하지 못했습니다: ${error.message}`);
      return goals;
    },

    async listDayTypes(month) {
      const { data, error } = await client
        .from("calendar_day_types")
        .select("day_date, day_type")
        .gte("day_date", `${month}-01`)
        .lt("day_date", nextMonth(month));
      if (error) throw new Error(`날짜 유형을 불러오지 못했습니다: ${error.message}`);
      return Object.fromEntries(
        (data ?? []).map((row) => [row.day_date, row.day_type as DayType]),
      );
    },

    async setDayType(date, dayType) {
      const user = await requireUser(client);
      const { error } = await client.from("calendar_day_types").upsert(
        { user_id: user.id, day_date: date, day_type: dayType },
        { onConflict: "user_id,day_date" },
      );
      if (error) throw new Error(`날짜 유형을 저장하지 못했습니다: ${error.message}`);
    },

    async searchFoods(query) {
      const { data, error } = await client.functions.invoke("search-foods", {
        body: { query },
      });
      if (error) {
        throw new Error(await functionErrorMessage(error, "식품을 검색하지 못했습니다."));
      }
      const body = data as { foods?: FoodResult[]; error?: string };
      if (body.error) throw new Error(body.error);
      return body.foods ?? [];
    },

    async analyzePhoto(file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("JPG, PNG, WebP 사진만 올릴 수 있어요.");
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("사진은 8MB 이하로 올려주세요.");
      }

      const user = await requireUser(client);
      const photoPath = `${user.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await client.storage
        .from("meal-photos")
        .upload(photoPath, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) {
        throw new Error(`사진을 올리지 못했습니다: ${uploadError.message}`);
      }

      const { data, error } = await client.functions.invoke("analyze-photo", {
        body: { photoPath },
      });
      if (error) {
        await client.storage.from("meal-photos").remove([photoPath]);
        throw new Error(await functionErrorMessage(error, "사진을 분석하지 못했습니다."));
      }
      const body = data as AnalysisResult & { error?: string };
      if (body.error) {
        await client.storage.from("meal-photos").remove([photoPath]);
        throw new Error(body.error);
      }
      return { ...body, photoId: photoPath };
    },
  };
}
