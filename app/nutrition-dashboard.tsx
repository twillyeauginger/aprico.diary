"use client";

import { useEffect, useMemo, useState } from "react";
import { parse as parseExif } from "exifr";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export type SourceType =
  | "database"
  | "label"
  | "ai_estimate"
  | "manual"
  | "reference";

export type MealRecord = {
  id: number | string;
  mealDate: string;
  mealTime?: string;
  mealType: string;
  foodName: string;
  sourceType: SourceType;
  sourceLabel: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
  confidence?: number | null;
  photoId?: string | null;
  demo?: boolean;
};

export type FoodResult = {
  id: string;
  name: string;
  maker?: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
  sourceType: SourceType;
  sourceLabel: string;
};

export type AnalysisItem = {
  name: string;
  portionGrams: number | null;
  portionText: string;
  confidence: number;
  nutrition: {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    sugar: number;
    sodium: number;
    fiber: number;
  };
  sourceType: "label" | "ai_estimate";
};

export type AnalysisResult = {
  imageType: "meal" | "nutrition_label" | "package" | "unknown";
  summary: string;
  items: AnalysisItem[];
  needsUserConfirmation: boolean;
  warnings: string[];
  photoId: string;
};

type AnalysisDraft = {
  name: string;
  amountMode: "percent" | "grams";
  amount: string;
  savedFoodId?: string;
};

export type MealInput = Omit<MealRecord, "id" | "demo">;

export type SavedFood = {
  id: number | string;
  name: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
};

export type SavedFoodInput = Omit<SavedFood, "id">;
export type DayType = "default" | "exercise";
type InsightPeriod = "day" | "week" | "month";
export type CalendarSettings = {
  dayTypes: Record<string, DayType>;
  completedDays: Record<string, boolean>;
};

export type NutritionGoals = {
  goalType: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  exerciseCaloriesMin: number;
  exerciseCaloriesMax: number;
  exerciseCarbsMin: number;
  exerciseCarbsMax: number;
  exerciseProteinMin: number;
  exerciseProteinMax: number;
  exerciseFat: number;
  restCalories: number;
  restCarbsMin: number;
  restCarbsMax: number;
  restProtein: number;
  restFat: number;
};

export const DEFAULT_GOALS: NutritionGoals = {
  goalType: "체중 유지 및 완만한 체지방 감량",
  calories: 1650,
  carbs: 215,
  protein: 85,
  fat: 50,
  exerciseCaloriesMin: 1700,
  exerciseCaloriesMax: 1750,
  exerciseCarbsMin: 225,
  exerciseCarbsMax: 240,
  exerciseProteinMin: 85,
  exerciseProteinMax: 90,
  exerciseFat: 50,
  restCalories: 1600,
  restCarbsMin: 195,
  restCarbsMax: 205,
  restProtein: 85,
  restFat: 50,
};

export type NutritionClient = {
  listMeals(month: string): Promise<MealRecord[]>;
  listAllMeals(): Promise<MealRecord[]>;
  createMeal(payload: MealInput): Promise<MealRecord>;
  updateMeal(id: MealRecord["id"], payload: MealInput): Promise<MealRecord>;
  deleteMeal(id: MealRecord["id"]): Promise<void>;
  listSavedFoods(): Promise<SavedFood[]>;
  createSavedFood(payload: SavedFoodInput): Promise<SavedFood>;
  updateSavedFood(
    id: SavedFood["id"],
    payload: SavedFoodInput,
  ): Promise<SavedFood>;
  deleteSavedFood(id: SavedFood["id"]): Promise<void>;
  getNutritionGoals(): Promise<NutritionGoals>;
  updateNutritionGoals(goals: NutritionGoals): Promise<NutritionGoals>;
  listCalendarSettings(month: string): Promise<CalendarSettings>;
  setCalendarSettings(
    date: string,
    dayType: DayType,
    isComplete: boolean,
  ): Promise<void>;
  searchFoods(query: string): Promise<FoodResult[]>;
  analyzePhoto(file: File): Promise<AnalysisResult>;
};

const legacyNutritionClient: NutritionClient = {
  async listMeals(month) {
    const response = await fetch(`/api/meals?month=${month}`);
    if (!response.ok) throw new Error("기록을 불러오지 못했습니다.");
    const body = (await response.json()) as { meals: MealRecord[] };
    return body.meals;
  },
  async listAllMeals() {
    const response = await fetch("/api/meals?all=true");
    if (!response.ok) throw new Error("음식 목록을 불러오지 못했습니다.");
    const body = (await response.json()) as { meals: MealRecord[] };
    return body.meals;
  },
  async createMeal(payload) {
    const response = await fetch("/api/meals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      meal?: MealRecord;
      error?: string;
    };
    if (!response.ok || !body.meal) {
      throw new Error(body.error ?? "저장하지 못했습니다.");
    }
    return body.meal;
  },
  async updateMeal(id, payload) {
    const response = await fetch(`/api/meals/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      meal?: MealRecord;
      error?: string;
    };
    if (!response.ok || !body.meal) {
      throw new Error(body.error ?? "수정하지 못했습니다.");
    }
    return body.meal;
  },
  async deleteMeal(id) {
    const response = await fetch(`/api/meals/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("삭제하지 못했습니다.");
  },
  async listSavedFoods() {
    const response = await fetch("/api/saved-foods");
    if (!response.ok) throw new Error("내 음식 DB를 불러오지 못했습니다.");
    const body = (await response.json()) as { foods: SavedFood[] };
    return body.foods;
  },
  async createSavedFood(payload) {
    const response = await fetch("/api/saved-foods", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { food?: SavedFood; error?: string };
    if (!response.ok || !body.food) throw new Error(body.error ?? "저장하지 못했습니다.");
    return body.food;
  },
  async updateSavedFood(id, payload) {
    const response = await fetch(`/api/saved-foods/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { food?: SavedFood; error?: string };
    if (!response.ok || !body.food) throw new Error(body.error ?? "수정하지 못했습니다.");
    return body.food;
  },
  async deleteSavedFood(id) {
    const response = await fetch(`/api/saved-foods/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("삭제하지 못했습니다.");
  },
  async getNutritionGoals() {
    const response = await fetch("/api/profile-goals");
    if (!response.ok) return DEFAULT_GOALS;
    const body = (await response.json()) as { goals?: NutritionGoals };
    return body.goals ?? DEFAULT_GOALS;
  },
  async updateNutritionGoals(goals) {
    const response = await fetch("/api/profile-goals", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(goals),
    });
    const body = (await response.json()) as { goals?: NutritionGoals; error?: string };
    if (!response.ok || !body.goals) throw new Error(body.error ?? "목표를 저장하지 못했습니다.");
    return body.goals;
  },
  async listCalendarSettings(month) {
    const response = await fetch(`/api/day-types?month=${month}`);
    if (!response.ok) return { dayTypes: {}, completedDays: {} };
    const settings = (await response.json()) as CalendarSettings;
    return {
      dayTypes: Object.fromEntries(
        Object.entries(settings.dayTypes).map(([date, value]) => [
          date,
          normalizeDayType(value),
        ]),
      ),
      completedDays: settings.completedDays,
    };
  },
  async setCalendarSettings(date, dayType, isComplete) {
    const response = await fetch("/api/day-types", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, dayType, isComplete }),
    });
    if (!response.ok) throw new Error("날짜 설정을 저장하지 못했습니다.");
  },
  async searchFoods(query) {
    const response = await fetch(`/api/foods?q=${encodeURIComponent(query)}`);
    const body = (await response.json()) as {
      foods?: FoodResult[];
      error?: string;
    };
    if (!response.ok) throw new Error(body.error ?? "검색하지 못했습니다.");
    return body.foods ?? [];
  },
  async analyzePhoto(file) {
    const uploadData = new FormData();
    uploadData.append("file", file);
    const uploadResponse = await fetch("/api/photos", {
      method: "POST",
      body: uploadData,
    });
    const uploaded = (await uploadResponse.json()) as {
      photoId?: string;
      error?: string;
    };
    if (!uploadResponse.ok || !uploaded.photoId) {
      throw new Error(uploaded.error ?? "사진을 올리지 못했습니다.");
    }

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId: uploaded.photoId }),
    });
    const body = (await response.json()) as AnalysisResult & { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "사진을 분석하지 못했습니다.");
    }
    return body;
  },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SOURCE_LABELS: Record<SourceType, string> = {
  database: "검증 DB",
  label: "표시값",
  ai_estimate: "AI 추정",
  manual: "직접 입력",
  reference: "참고값",
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}

function demoMeals(today: Date): MealRecord[] {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterday = new Date(day);
  yesterday.setDate(day.getDate() - 1);
  const twoDaysAgo = new Date(day);
  twoDaysAgo.setDate(day.getDate() - 2);

  return [
    {
      id: "demo-1",
      mealDate: dateKey(day),
      mealType: "아침",
      foodName: "그릭요거트와 블루베리",
      sourceType: "reference",
      sourceLabel: "예시 데이터",
      servingAmount: 1,
      servingUnit: "그릇",
      calories: 286,
      carbs: 34,
      protein: 18,
      fat: 8,
      sugar: 16,
      sodium: 92,
      fiber: 4,
      demo: true,
    },
    {
      id: "demo-2",
      mealDate: dateKey(day),
      mealType: "점심",
      foodName: "현미밥 닭가슴살 플레이트",
      sourceType: "ai_estimate",
      sourceLabel: "사진 분석 예시",
      servingAmount: 1,
      servingUnit: "접시",
      calories: 612,
      carbs: 71,
      protein: 46,
      fat: 17,
      sugar: 8,
      sodium: 620,
      fiber: 9,
      confidence: 0.84,
      demo: true,
    },
    {
      id: "demo-3",
      mealDate: dateKey(day),
      mealType: "간식",
      foodName: "프로틴 드링크",
      sourceType: "label",
      sourceLabel: "영양정보 표시값",
      servingAmount: 1,
      servingUnit: "병",
      calories: 165,
      carbs: 12,
      protein: 24,
      fat: 3,
      sugar: 7,
      sodium: 210,
      fiber: 1,
      demo: true,
    },
    {
      id: "demo-4",
      mealDate: dateKey(yesterday),
      mealType: "저녁",
      foodName: "연어 포케",
      sourceType: "reference",
      sourceLabel: "예시 데이터",
      servingAmount: 1,
      servingUnit: "그릇",
      calories: 674,
      carbs: 78,
      protein: 35,
      fat: 25,
      sugar: 11,
      sodium: 780,
      fiber: 8,
      demo: true,
    },
    {
      id: "demo-5",
      mealDate: dateKey(twoDaysAgo),
      mealType: "점심",
      foodName: "두부 버섯 덮밥",
      sourceType: "reference",
      sourceLabel: "예시 데이터",
      servingAmount: 1,
      servingUnit: "그릇",
      calories: 532,
      carbs: 74,
      protein: 25,
      fat: 17,
      sugar: 8,
      sodium: 690,
      fiber: 9,
      demo: true,
    },
  ];
}

function emptyManual(selectedDate: string) {
  const now = new Date();
  return {
    mealDate: selectedDate,
    mealTime: `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`,
    mealType: "점심",
    foodName: "",
    servingAmount: "1",
    servingUnit: "인분",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
    sugar: "",
    sodium: "",
    fiber: "",
  };
}

function emptySavedFood() {
  return {
    name: "",
    servingAmount: "1",
    servingUnit: "인분",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
    sugar: "",
    sodium: "",
    fiber: "",
  };
}

function sumNutrition(rows: MealRecord[]) {
  return rows.reduce(
    (total, row) => ({
      calories: total.calories + Number(row.calories || 0),
      carbs: total.carbs + Number(row.carbs || 0),
      protein: total.protein + Number(row.protein || 0),
      fat: total.fat + Number(row.fat || 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );
}

function mealTypeFromTime(time?: string) {
  if (!time) return "간식";
  const [hour, minute] = time.split(":").map(Number);
  const minutes = hour * 60 + minute;
  if (!Number.isFinite(minutes)) return "간식";
  if (minutes >= 5 * 60 && minutes < 11 * 60) return "아침";
  if (minutes >= 11 * 60 && minutes < 15 * 60) return "점심";
  if (minutes >= 17 * 60 && minutes < 23 * 60) return "저녁";
  return "간식";
}

function mealTypeClass(mealType: string) {
  if (mealType === "아침") return "breakfast";
  if (mealType === "점심") return "lunch";
  if (mealType === "저녁") return "dinner";
  return "snack";
}

type MealOccasion = ReturnType<typeof sumNutrition> & {
  key: string;
  mealDate: string;
  mealTime?: string;
  mealType: string;
};

function groupMealOccasions(rows: MealRecord[]): MealOccasion[] {
  const groups = new Map<string, MealRecord[]>();
  for (const meal of rows) {
    const occasionKey = meal.photoId
      ? `${meal.mealDate}|photo:${meal.photoId}`
      : `${meal.mealDate}|${meal.mealType}|${meal.mealTime || "시간 미입력"}`;
    const existing = groups.get(occasionKey) ?? [];
    existing.push(meal);
    groups.set(occasionKey, existing);
  }

  return [...groups.entries()].map(([key, meals]) => ({
    key,
    mealDate: meals[0].mealDate,
    mealTime: meals[0].mealTime,
    mealType: meals[0].mealType,
    ...sumNutrition(meals),
  }));
}

function sourceClass(source: SourceType) {
  return source === "database" || source === "manual" ? "" : source;
}

function displayDate(key: string) {
  const date = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function normalizeDayType(value: unknown): DayType {
  return value === "exercise" ? "exercise" : "default";
}

function goalsForDay(goals: NutritionGoals, dayType: DayType) {
  if (dayType === "exercise") {
    return {
      ...goals,
      calories: Math.round((goals.exerciseCaloriesMin + goals.exerciseCaloriesMax) / 2),
      carbs: Math.round((goals.exerciseCarbsMin + goals.exerciseCarbsMax) / 2),
      protein: Math.round((goals.exerciseProteinMin + goals.exerciseProteinMax) / 2),
      fat: goals.exerciseFat,
    };
  }
  return goals;
}

type AdherenceMetric = "calories" | "carbs" | "protein" | "fat";

const ADHERENCE_METRICS: Array<{
  key: AdherenceMetric;
  label: string;
  unit: string;
}> = [
  { key: "calories", label: "칼로리", unit: "kcal" },
  { key: "carbs", label: "탄수화물", unit: "g" },
  { key: "protein", label: "단백질", unit: "g" },
  { key: "fat", label: "지방", unit: "g" },
];

type AdherenceResult = {
  date: string;
  status: "empty" | "recording" | "close" | "off";
  level: number;
  dominantMetric?: AdherenceMetric;
  direction?: "over" | "under";
  values: ReturnType<typeof sumNutrition>;
  ranges: Record<AdherenceMetric, { min: number; max: number; target: number }>;
};

function adherenceRanges(
  goals: NutritionGoals,
  dayType: DayType,
): AdherenceResult["ranges"] {
  if (dayType === "exercise") {
    return {
      calories: {
        min: goals.exerciseCaloriesMin,
        max: goals.exerciseCaloriesMax,
        target: (goals.exerciseCaloriesMin + goals.exerciseCaloriesMax) / 2,
      },
      carbs: {
        min: goals.exerciseCarbsMin,
        max: goals.exerciseCarbsMax,
        target: (goals.exerciseCarbsMin + goals.exerciseCarbsMax) / 2,
      },
      protein: {
        min: goals.exerciseProteinMin,
        max: goals.exerciseProteinMax,
        target: (goals.exerciseProteinMin + goals.exerciseProteinMax) / 2,
      },
      fat: {
        min: goals.exerciseFat * 0.85,
        max: goals.exerciseFat * 1.15,
        target: goals.exerciseFat,
      },
    };
  }
  return {
    calories: {
      min: goals.calories * 0.9,
      max: goals.calories * 1.1,
      target: goals.calories,
    },
    carbs: {
      min: goals.carbs * 0.85,
      max: goals.carbs * 1.15,
      target: goals.carbs,
    },
    protein: {
      min: goals.protein * 0.85,
      max: goals.protein * 1.15,
      target: goals.protein,
    },
    fat: {
      min: goals.fat * 0.85,
      max: goals.fat * 1.15,
      target: goals.fat,
    },
  };
}

function configuredGoalLabel(
  goals: NutritionGoals,
  dayType: DayType,
  metric: AdherenceMetric,
) {
  if (dayType === "exercise") {
    if (metric === "calories") {
      return `${goals.exerciseCaloriesMin.toLocaleString()}–${goals.exerciseCaloriesMax.toLocaleString()}`;
    }
    if (metric === "carbs") {
      return `${goals.exerciseCarbsMin}–${goals.exerciseCarbsMax}`;
    }
    if (metric === "protein") {
      return `${goals.exerciseProteinMin}–${goals.exerciseProteinMax}`;
    }
    return goals.exerciseFat.toLocaleString();
  }
  return goals[metric].toLocaleString();
}

function evaluateAdherence({
  date,
  values,
  goals,
  dayType,
  isComplete,
  hasRecords,
}: {
  date: string;
  values: ReturnType<typeof sumNutrition>;
  goals: NutritionGoals;
  dayType: DayType;
  isComplete: boolean;
  hasRecords: boolean;
}): AdherenceResult {
  const ranges = adherenceRanges(goals, dayType);
  if (!isComplete) {
    return {
      date,
      status: hasRecords ? "recording" : "empty",
      level: 0,
      values,
      ranges,
    };
  }

  const deviations = ADHERENCE_METRICS.map(({ key }) => {
    const value = values[key];
    const range = ranges[key];
    const signedDeviation =
      value < range.min
        ? (value - range.min) / Math.max(range.target, 1)
        : value > range.max
          ? (value - range.max) / Math.max(range.target, 1)
          : 0;
    return { key, signedDeviation };
  });
  const dominant = deviations.reduce((largest, current) =>
    Math.abs(current.signedDeviation) > Math.abs(largest.signedDeviation)
      ? current
      : largest,
  );

  if (dominant.signedDeviation === 0) {
    const averageDistance =
      ADHERENCE_METRICS.reduce((sum, { key }) => {
        const range = ranges[key];
        return (
          sum +
          Math.abs(values[key] - range.target) / Math.max(range.target, 1)
        );
      }, 0) / ADHERENCE_METRICS.length;
    const level =
      averageDistance <= 0.03
        ? 4
        : averageDistance <= 0.07
          ? 3
          : averageDistance <= 0.11
            ? 2
            : 1;
    return { date, status: "close", level, values, ranges };
  }

  const deviationAmount = Math.abs(dominant.signedDeviation);
  const level =
    deviationAmount >= 0.5
      ? 4
      : deviationAmount >= 0.3
        ? 3
        : deviationAmount >= 0.15
          ? 2
          : 1;
  return {
    date,
    status: "off",
    level,
    dominantMetric: dominant.key,
    direction: dominant.signedDeviation > 0 ? "over" : "under",
    values,
    ranges,
  };
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

function insightDateRange(period: InsightPeriod, anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  const end = new Date(start);
  if (period === "week") {
    start.setDate(start.getDate() - start.getDay());
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === "month") {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
  }
  return { start, end };
}

function datesInRange(start: Date, end: Date) {
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function insightRangeLabel(period: InsightPeriod, start: Date, end: Date) {
  if (period === "day") {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(start);
  }
  if (period === "month") {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
  }
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${start.getMonth() + 1}월 ${start.getDate()}일`;
  const endLabel = sameMonth
    ? `${end.getDate()}일`
    : `${end.getMonth() + 1}월 ${end.getDate()}일`;
  return `${start.getFullYear()}년 ${startLabel}–${endLabel}`;
}

function buildPeriodInsights(
  rows: MealRecord[],
  period: InsightPeriod,
  start: Date,
  end: Date,
  completedDays: Record<string, boolean>,
) {
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const rangeDates = datesInRange(start, end);
  const actualMeals = rows.filter(
    (meal) =>
      !meal.demo && meal.mealDate >= startKey && meal.mealDate <= endKey,
  );
  const mealsByDate = new Map<string, MealRecord[]>();
  for (const meal of actualMeals) {
    const dailyRows = mealsByDate.get(meal.mealDate) ?? [];
    dailyRows.push(meal);
    mealsByDate.set(meal.mealDate, dailyRows);
  }
  const recordedDates = rangeDates.filter((date) => mealsByDate.has(date));
  const completedRecordedDates = recordedDates.filter(
    (date) => completedDays[date],
  );
  const basisDates =
    period === "day"
      ? recordedDates
      : completedRecordedDates.length > 0
        ? completedRecordedDates
        : recordedDates;
  const basisDateSet = new Set(basisDates);
  const basisMeals =
    period === "day"
      ? actualMeals
      : actualMeals.filter((meal) => basisDateSet.has(meal.mealDate));
  const divisor = period === "day" ? 1 : Math.max(basisDates.length, 1);
  const totals = sumNutrition(basisMeals);
  const averageValues = {
    calories: totals.calories / divisor,
    carbs: totals.carbs / divisor,
    protein: totals.protein / divisor,
    fat: totals.fat / divisor,
  };
  const dailyTotals = rangeDates.map((date) => ({
    date,
    ...sumNutrition(mealsByDate.get(date) ?? []),
  }));
  const occasions = groupMealOccasions(basisMeals);
  const mealTypes = ["아침", "점심", "저녁", "간식"].map((type) => ({
    type,
    count: occasions.filter((occasion) => occasion.mealType === type).length,
  }));
  const timeBuckets = new Map<number, ReturnType<typeof sumNutrition>>();
  for (const occasion of occasions) {
    const hour = Number(occasion.mealTime?.slice(0, 2));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const current = timeBuckets.get(hour) ?? {
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
    };
    timeBuckets.set(hour, {
      calories: current.calories + occasion.calories,
      carbs: current.carbs + occasion.carbs,
      protein: current.protein + occasion.protein,
      fat: current.fat + occasion.fat,
    });
  }
  const nutritionTimeBuckets = Array.from({ length: 24 }, (_, hour) => {
    const total = timeBuckets.get(hour) ?? {
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
    };
    return {
      hour,
      calories: total.calories / divisor,
      carbs: total.carbs / divisor,
      protein: total.protein / divisor,
      fat: total.fat / divisor,
    };
  });
  return {
    dayCount: recordedDates.length,
    recordedDates,
    basisDayCount: basisDates.length,
    basisDates,
    usesCompletedBasis:
      period !== "day" && completedRecordedDates.length > 0,
    rangeDates,
    dailyTotals,
    totals,
    averageValues,
    mealTypes,
    nutritionTimeBuckets,
  };
}

export function NutritionDashboard({
  client = legacyNutritionClient,
  userEmail,
  onSignOut,
}: {
  client?: NutritionClient;
  userEmail?: string;
  onSignOut?: () => void | Promise<void>;
}) {
  const [today] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [insightPeriod, setInsightPeriod] =
    useState<InsightPeriod>("week");
  const [insightAnchor, setInsightAnchor] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12),
  );
  const [activeView, setActiveView] = useState<
    "calendar" | "foods" | "foodDb" | "insights" | "profile"
  >("calendar");
  const [nutritionGoals, setNutritionGoals] =
    useState<NutritionGoals>(DEFAULT_GOALS);
  const [dayTypes, setDayTypes] = useState<Record<string, DayType>>({});
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>(
    {},
  );
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "saved" | "search" | "photo" | "manual"
  >(
    "saved",
  );
  const [manual, setManual] = useState(emptyManual(selectedDate));
  const [loadedSavedFood, setLoadedSavedFood] = useState<SavedFood | null>(null);
  const [loadedFoodResult, setLoadedFoodResult] =
    useState<FoodResult | null>(null);
  const [manualFoodResults, setManualFoodResults] = useState<FoodResult[]>([]);
  const [manualFoodSearching, setManualFoodSearching] = useState(false);
  const [manualFoodSearchDone, setManualFoodSearchDone] = useState(false);
  const [savedFoodQuantity, setSavedFoodQuantity] = useState("1");
  const [editingMeal, setEditingMeal] = useState<MealRecord | null>(null);
  const [editForm, setEditForm] = useState(emptyManual(selectedDate));
  const [updating, setUpdating] = useState(false);
  const [allMeals, setAllMeals] = useState<MealRecord[]>([]);
  const [foodListLoading, setFoodListLoading] = useState(false);
  const [foodListQuery, setFoodListQuery] = useState("");
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [savedFoodsLoading, setSavedFoodsLoading] = useState(false);
  const [savedFoodQuery, setSavedFoodQuery] = useState("");
  const [savedFoodEditor, setSavedFoodEditor] = useState<SavedFood | "new" | null>(
    null,
  );
  const [savedFoodForm, setSavedFoodForm] = useState(() =>
    emptySavedFood(),
  );
  const [query, setQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDate, setPhotoDate] = useState(selectedDate);
  const [photoTime, setPhotoTime] = useState("");
  const [photoDateSource, setPhotoDateSource] = useState<"exif" | "selected">(
    "selected",
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [originalAnalysisItems, setOriginalAnalysisItems] = useState<
    AnalysisItem[]
  >([]);
  const [analysisDrafts, setAnalysisDrafts] = useState<AnalysisDraft[]>([]);
  const [bulkPercentPrompt, setBulkPercentPrompt] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "meal"; item: MealRecord }
    | { kind: "savedFood"; item: SavedFood }
    | null
  >(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    client
      .getNutritionGoals()
      .then((goals) => {
        if (!cancelled) setNutritionGoals({ ...DEFAULT_GOALS, ...goals });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    client.listCalendarSettings(monthKey(viewMonth)).then((settings) => {
      if (!cancelled) {
        setDayTypes((current) => ({ ...current, ...settings.dayTypes }));
        setCompletedDays((current) => ({
          ...current,
          ...settings.completedDays,
        }));
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, viewMonth]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const loadedMeals = await client.listMeals(monthKey(viewMonth));
        if (cancelled) return;
        if (loadedMeals.length === 0) {
          setMeals(demoMeals(today));
          setIsDemo(true);
        } else {
          setMeals(loadedMeals);
          setIsDemo(false);
        }
      } catch {
        if (!cancelled) {
          setMeals(demoMeals(today));
          setIsDemo(true);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [client, viewMonth, today]);

  useEffect(() => {
    if (activeView !== "foods" && activeView !== "insights") return;
    let cancelled = false;
    client
      .listAllMeals()
      .then((rows) => {
        if (!cancelled) setAllMeals(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(
            error instanceof Error
              ? error.message
              : "음식 목록을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled && activeView === "foods") setFoodListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeView, client]);

  const insightRange = useMemo(
    () => insightDateRange(insightPeriod, insightAnchor),
    [insightAnchor, insightPeriod],
  );

  useEffect(() => {
    if (activeView !== "insights") return;
    let cancelled = false;
    const months = [
      monthKey(insightRange.start),
      monthKey(insightRange.end),
    ].filter((month, index, values) => values.indexOf(month) === index);
    Promise.all(months.map((month) => client.listCalendarSettings(month)))
      .then((settingsList) => {
        if (cancelled) return;
        setDayTypes((current) => ({
          ...current,
          ...Object.assign({}, ...settingsList.map((settings) => settings.dayTypes)),
        }));
        setCompletedDays((current) => ({
          ...current,
          ...Object.assign(
            {},
            ...settingsList.map((settings) => settings.completedDays),
          ),
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeView, client, insightRange.end, insightRange.start]);

  useEffect(() => {
    if (activeView !== "foodDb" && !modalOpen) return;
    let cancelled = false;
    client
      .listSavedFoods()
      .then((foods) => {
        if (!cancelled) setSavedFoods(foods);
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(
            error instanceof Error
              ? error.message
              : "내 음식 DB를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSavedFoodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeView, client, modalOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const monthCells = useMemo(() => {
    const start = new Date(viewMonth);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [viewMonth]);

  const selectedMeals = useMemo(
    () =>
      meals
        .filter((meal) => meal.mealDate === selectedDate)
        .sort((a, b) => (a.mealTime ?? "").localeCompare(b.mealTime ?? "")),
    [meals, selectedDate],
  );
  const selectedTotals = useMemo(
    () => sumNutrition(selectedMeals),
    [selectedMeals],
  );
  const selectedGoals = goalsForDay(
    nutritionGoals,
    dayTypes[selectedDate] ?? "default",
  );

  const dailyMap = useMemo(() => {
    const map = new Map<string, MealRecord[]>();
    for (const meal of meals) {
      const existing = map.get(meal.mealDate) ?? [];
      existing.push(meal);
      map.set(meal.mealDate, existing);
    }
    return map;
  }, [meals]);

  const periodInsights = useMemo(
    () =>
      buildPeriodInsights(
        allMeals.length > 0 ? allMeals : meals,
        insightPeriod,
        insightRange.start,
        insightRange.end,
        completedDays,
      ),
    [
      allMeals,
      completedDays,
      insightPeriod,
      insightRange.end,
      insightRange.start,
      meals,
    ],
  );
  const insightGoals = useMemo(() => {
    const dates =
      periodInsights.basisDates.length > 0
        ? periodInsights.basisDates
        : [dateKey(insightAnchor)];
    const dailyGoals = dates.map((date) =>
      goalsForDay(nutritionGoals, dayTypes[date] ?? "default"),
    );
    return {
      calories:
        dailyGoals.reduce((sum, goal) => sum + goal.calories, 0) /
        dailyGoals.length,
      carbs:
        dailyGoals.reduce((sum, goal) => sum + goal.carbs, 0) /
        dailyGoals.length,
      protein:
        dailyGoals.reduce((sum, goal) => sum + goal.protein, 0) /
        dailyGoals.length,
      fat:
        dailyGoals.reduce((sum, goal) => sum + goal.fat, 0) /
        dailyGoals.length,
    };
  }, [dayTypes, insightAnchor, nutritionGoals, periodInsights.basisDates]);

  const filteredAllMeals = useMemo(() => {
    const normalized = foodListQuery.trim().toLocaleLowerCase("ko");
    return [...allMeals]
      .filter(
        (meal) =>
          !normalized ||
          meal.foodName.toLocaleLowerCase("ko").includes(normalized) ||
          meal.mealType.toLocaleLowerCase("ko").includes(normalized),
      )
      .sort(
        (a, b) =>
          b.mealDate.localeCompare(a.mealDate) ||
          (b.mealTime ?? "").localeCompare(a.mealTime ?? ""),
      );
  }, [allMeals, foodListQuery]);

  function showToast(message: string) {
    setToast(message);
  }

  function openAdd(
    tab: "saved" | "search" | "photo" | "manual" = "saved",
  ) {
    setActiveTab(tab);
    setSavedFoodsLoading(true);
    setModalOpen(true);
    setManual(emptyManual(selectedDate));
    setLoadedSavedFood(null);
    setLoadedFoodResult(null);
    setManualFoodResults([]);
    setManualFoodSearchDone(false);
    setQuery("");
    setFoodResults([]);
    setSavedFoodQuantity("1");
  }

  function applySavedFoodQuantity(food: SavedFood, quantity: number) {
    const multiplier = Math.max(0, quantity);
    setManual((current) => ({
      ...current,
      foodName: food.name,
      servingAmount: String(food.servingAmount * multiplier),
      servingUnit: food.servingUnit,
      calories: String(food.calories * multiplier),
      carbs: String(food.carbs * multiplier),
      protein: String(food.protein * multiplier),
      fat: String(food.fat * multiplier),
      sugar: String(food.sugar * multiplier),
      sodium: String(food.sodium * multiplier),
      fiber: String(food.fiber * multiplier),
    }));
  }

  function loadSavedFood(food: SavedFood) {
    setManual(emptyManual(selectedDate));
    setLoadedSavedFood(food);
    setLoadedFoodResult(null);
    setManualFoodResults([]);
    setManualFoodSearchDone(false);
    setSavedFoodQuantity("1");
    applySavedFoodQuantity(food, 1);
    setActiveTab("manual");
  }

  function closeModal() {
    setModalOpen(false);
    setAnalysis(null);
    setOriginalAnalysisItems([]);
    setAnalysisDrafts([]);
    setBulkPercentPrompt(null);
    setPhotoFile(null);
    setLoadedSavedFood(null);
    setLoadedFoodResult(null);
    setManualFoodResults([]);
    setManualFoodSearchDone(false);
    setSavedFoodQuantity("1");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
  }

  async function saveMeal(
    payload: MealInput,
    successMessage = "기록에 추가했어요.",
  ) {
    const meal = await client.createMeal(payload);
    setMeals((current) =>
      isDemo ? [meal] : [...current.filter((item) => !item.demo), meal],
    );
    setIsDemo(false);
    showToast(successMessage);
    return meal;
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manual.foodName.trim()) return;
    try {
      await saveMeal({
        mealDate: manual.mealDate,
        mealTime: manual.mealTime,
        mealType: manual.mealType,
        foodName: manual.foodName.trim(),
        sourceType: loadedFoodResult?.sourceType ?? "manual",
        sourceLabel: loadedSavedFood
          ? "내 음식 DB"
          : loadedFoodResult?.sourceLabel ?? "직접 입력",
        servingAmount: Number(manual.servingAmount) || 1,
        servingUnit: manual.servingUnit || "인분",
        calories: Number(manual.calories) || 0,
        carbs: Number(manual.carbs) || 0,
        protein: Number(manual.protein) || 0,
        fat: Number(manual.fat) || 0,
        sugar: Number(manual.sugar) || 0,
        sodium: Number(manual.sodium) || 0,
        fiber: Number(manual.fiber) || 0,
      });
      closeModal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  function openEdit(meal: MealRecord) {
    setEditingMeal(meal);
    setEditForm({
      mealDate: meal.mealDate,
      mealTime: meal.mealTime ?? "",
      mealType: meal.mealType,
      foodName: meal.foodName,
      servingAmount: String(meal.servingAmount),
      servingUnit: meal.servingUnit,
      calories: String(meal.calories),
      carbs: String(meal.carbs),
      protein: String(meal.protein),
      fat: String(meal.fat),
      sugar: String(meal.sugar),
      sodium: String(meal.sodium),
      fiber: String(meal.fiber),
    });
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMeal || !editForm.foodName.trim()) return;
    setUpdating(true);
    try {
      const updated = await client.updateMeal(editingMeal.id, {
        mealDate: editForm.mealDate,
        mealTime: editForm.mealTime,
        mealType: editForm.mealType,
        foodName: editForm.foodName.trim(),
        sourceType: "manual",
        sourceLabel: "사용자 수정",
        servingAmount: Number(editForm.servingAmount) || 1,
        servingUnit: editForm.servingUnit || "인분",
        calories: Number(editForm.calories) || 0,
        carbs: Number(editForm.carbs) || 0,
        protein: Number(editForm.protein) || 0,
        fat: Number(editForm.fat) || 0,
        sugar: Number(editForm.sugar) || 0,
        sodium: Number(editForm.sodium) || 0,
        fiber: Number(editForm.fiber) || 0,
      });
      setMeals((current) =>
        current.map((meal) => (meal.id === updated.id ? updated : meal)),
      );
      setAllMeals((current) =>
        current.map((meal) => (meal.id === updated.id ? updated : meal)),
      );
      setSelectedDate(updated.mealDate);
      setViewMonth(new Date(`${updated.mealDate.slice(0, 7)}-01T12:00:00`));
      setEditingMeal(null);
      showToast("기록을 수정했어요.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "수정하지 못했습니다.");
    } finally {
      setUpdating(false);
    }
  }

  function savedFoodPayload(): SavedFoodInput {
    return {
      name: savedFoodForm.name.trim(),
      servingAmount: Number(savedFoodForm.servingAmount) || 1,
      servingUnit: savedFoodForm.servingUnit || "인분",
      calories: Number(savedFoodForm.calories) || 0,
      carbs: Number(savedFoodForm.carbs) || 0,
      protein: Number(savedFoodForm.protein) || 0,
      fat: Number(savedFoodForm.fat) || 0,
      sugar: Number(savedFoodForm.sugar) || 0,
      sodium: Number(savedFoodForm.sodium) || 0,
      fiber: Number(savedFoodForm.fiber) || 0,
    };
  }

  function openSavedFoodEditor(food?: SavedFood) {
    setSavedFoodEditor(food ?? "new");
    setSavedFoodForm(
      food
        ? {
            name: food.name,
            servingAmount: String(food.servingAmount),
            servingUnit: food.servingUnit,
            calories: String(food.calories),
            carbs: String(food.carbs),
            protein: String(food.protein),
            fat: String(food.fat),
            sugar: String(food.sugar),
            sodium: String(food.sodium),
            fiber: String(food.fiber),
          }
        : emptySavedFood(),
    );
  }

  async function handleSavedFoodSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!savedFoodForm.name.trim()) return;
    try {
      if (savedFoodEditor === "new") {
        const created = await client.createSavedFood(savedFoodPayload());
        setSavedFoods((current) => [created, ...current]);
        showToast("내 음식 DB에 저장했어요.");
      } else if (savedFoodEditor) {
        const updated = await client.updateSavedFood(
          savedFoodEditor.id,
          savedFoodPayload(),
        );
        setSavedFoods((current) =>
          current.map((food) => (food.id === updated.id ? updated : food)),
        );
        showToast("음식 정보를 수정했어요.");
      }
      setSavedFoodEditor(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  async function deleteSavedFood(food: SavedFood) {
    try {
      await client.deleteSavedFood(food.id);
      setSavedFoods((current) => current.filter((item) => item.id !== food.id));
      showToast("내 음식 DB에서 삭제했어요.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    }
  }

  async function addSavedFoodToMeal(food: SavedFood) {
    try {
      await saveMeal({
        mealDate: selectedDate,
        mealTime: new Date().toTimeString().slice(0, 5),
        mealType: "점심",
        foodName: food.name,
        sourceType: "manual",
        sourceLabel: "내 음식 DB",
        servingAmount: food.servingAmount,
        servingUnit: food.servingUnit,
        calories: food.calories,
        carbs: food.carbs,
        protein: food.protein,
        fat: food.fat,
        sugar: food.sugar,
        sodium: food.sodium,
        fiber: food.fiber,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "추가하지 못했습니다.");
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setFoodResults(await client.searchFoods(query.trim()));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "검색하지 못했습니다.");
    } finally {
      setSearching(false);
    }
  }

  function loadFoodResult(food: FoodResult) {
    setManual((current) => ({
      ...current,
      foodName: food.name,
      servingAmount: String(food.servingAmount || 100),
      servingUnit: food.servingUnit || "g",
      calories: String(food.calories),
      carbs: String(food.carbs),
      protein: String(food.protein),
      fat: String(food.fat),
      sugar: String(food.sugar),
      sodium: String(food.sodium),
      fiber: String(food.fiber),
    }));
    setLoadedFoodResult(food);
    setLoadedSavedFood(null);
    setSavedFoodQuantity("1");
    setManualFoodResults([]);
    setManualFoodSearchDone(false);
    setActiveTab("manual");
  }

  function updateManualServingAmount(value: string) {
    if (!loadedFoodResult) {
      setManual((current) => ({ ...current, servingAmount: value }));
      return;
    }
    const ratio =
      Math.max(0, Number(value) || 0) /
      Math.max(loadedFoodResult.servingAmount, 1);
    setManual((current) => ({
      ...current,
      servingAmount: value,
      calories: String(loadedFoodResult.calories * ratio),
      carbs: String(loadedFoodResult.carbs * ratio),
      protein: String(loadedFoodResult.protein * ratio),
      fat: String(loadedFoodResult.fat * ratio),
      sugar: String(loadedFoodResult.sugar * ratio),
      sodium: String(loadedFoodResult.sodium * ratio),
      fiber: String(loadedFoodResult.fiber * ratio),
    }));
  }

  async function searchManualFood() {
    const foodName = manual.foodName.trim();
    if (!foodName) {
      showToast("먼저 음식 이름을 입력해주세요.");
      return;
    }
    setManualFoodSearching(true);
    setManualFoodSearchDone(false);
    try {
      setManualFoodResults(await client.searchFoods(foodName));
      setManualFoodSearchDone(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "검색하지 못했습니다.");
      setManualFoodResults([]);
      setManualFoodSearchDone(true);
    } finally {
      setManualFoodSearching(false);
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
    setOriginalAnalysisItems([]);
    setAnalysisDrafts([]);
    setBulkPercentPrompt(null);
    setPhotoDate(selectedDate);
    setPhotoTime("");
    setPhotoDateSource("selected");
    try {
      const metadata = (await parseExif(file, {
        pick: ["DateTimeOriginal", "CreateDate"],
      })) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
      const capturedAt = metadata?.DateTimeOriginal ?? metadata?.CreateDate;
      if (capturedAt instanceof Date && !Number.isNaN(capturedAt.getTime())) {
        setPhotoDate(dateKey(capturedAt));
        setPhotoTime(
          `${String(capturedAt.getHours()).padStart(2, "0")}:${String(
            capturedAt.getMinutes(),
          ).padStart(2, "0")}`,
        );
        setPhotoDateSource("exif");
      }
    } catch {
      // Some edited or downloaded images do not contain EXIF capture time.
    }
  }

  async function analyzePhoto() {
    if (!photoFile) return;
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisDrafts([]);
    try {
      const result = await client.analyzePhoto(photoFile);
      setAnalysis(result);
      setOriginalAnalysisItems(result.items);
      setAnalysisDrafts(
        result.items.map((item) => ({
          name: item.name,
          amountMode: "percent",
          amount: "100",
        })),
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "사진 분석을 시작하지 못했습니다.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function replaceAnalysisItemFromDb(index: number, foodId: string) {
    if (!foodId) {
      const original = originalAnalysisItems[index];
      if (!original) return;
      setAnalysis((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item, itemIndex) =>
                itemIndex === index ? original : item,
              ),
            }
          : current,
      );
      setAnalysisDrafts((current) =>
        current.map((draft, draftIndex) =>
          draftIndex === index
            ? { ...draft, name: original.name, savedFoodId: undefined }
            : draft,
        ),
      );
      return;
    }
    const food = savedFoods.find((item) => String(item.id) === foodId);
    if (!food) return;
    setAnalysis((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    name: food.name,
                    portionGrams:
                      food.servingUnit.toLocaleLowerCase() === "g"
                        ? food.servingAmount
                        : null,
                    portionText: `${food.servingAmount}${food.servingUnit}`,
                    nutrition: {
                      calories: food.calories,
                      carbs: food.carbs,
                      protein: food.protein,
                      fat: food.fat,
                      sugar: food.sugar,
                      sodium: food.sodium,
                      fiber: food.fiber,
                    },
                  }
                : item,
            ),
          }
        : current,
    );
    setAnalysisDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index
          ? { ...draft, name: food.name, savedFoodId: foodId }
          : draft,
      ),
    );
  }

  async function confirmAnalysis() {
    if (!analysis) return;
    try {
      for (const [index, item] of analysis.items.entries()) {
        const draft = analysisDrafts[index] ?? {
          name: item.name,
          amountMode: "percent" as const,
          amount: "100",
        };
        const enteredAmount = Math.max(0, Number(draft.amount) || 0);
        if (enteredAmount === 0) continue;
        const ratio =
          draft.amountMode === "grams" && item.portionGrams
            ? enteredAmount / item.portionGrams
            : enteredAmount / 100;
        const servingAmount =
          draft.amountMode === "grams"
            ? enteredAmount
            : item.portionGrams
              ? item.portionGrams * ratio
              : ratio;
        await saveMeal(
          {
            mealDate: photoDate,
            mealTime: photoTime,
            mealType: mealTypeFromTime(photoTime),
            foodName: draft.name.trim() || item.name,
            sourceType: draft.savedFoodId ? "manual" : item.sourceType,
            sourceLabel:
              draft.savedFoodId
                ? "내 음식 DB"
                : item.sourceType === "label"
                ? "영양정보 사진 표시값"
                : "GPT 사진 추정",
            servingAmount,
            servingUnit: item.portionGrams ? "g" : "인분",
            calories: item.nutrition.calories * ratio,
            carbs: item.nutrition.carbs * ratio,
            protein: item.nutrition.protein * ratio,
            fat: item.nutrition.fat * ratio,
            sugar: item.nutrition.sugar * ratio,
            sodium: item.nutrition.sodium * ratio,
            fiber: item.nutrition.fiber * ratio,
            confidence: item.confidence,
            photoId: analysis.photoId,
          },
          "사진 분석 결과를 기록했어요.",
        );
      }
      closeModal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  async function deleteMeal(meal: MealRecord) {
    if (meal.demo) {
      setMeals((current) => current.filter((item) => item.id !== meal.id));
      return;
    }
    try {
      await client.deleteMeal(meal.id);
      setMeals((current) => current.filter((item) => item.id !== meal.id));
      showToast("기록을 삭제했어요.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (target.kind === "meal") {
      await deleteMeal(target.item);
    } else {
      await deleteSavedFood(target.item);
    }
  }

  function changeMonth(offset: number) {
    setViewMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function changeInsightRange(offset: number) {
    setInsightAnchor((current) => {
      const next = new Date(current);
      if (insightPeriod === "day") {
        next.setDate(next.getDate() + offset);
      } else if (insightPeriod === "week") {
        next.setDate(next.getDate() + offset * 7);
      } else {
        next.setMonth(next.getMonth() + offset);
      }
      return next;
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="식단 기록 홈">
          식단 기록
        </div>
        <nav className="top-nav" aria-label="주요 메뉴">
          <button
            className={activeView === "calendar" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("calendar")}
          >
            캘린더
          </button>
          <button
            className={activeView === "foods" ? "active" : ""}
            type="button"
            onClick={() => {
              setFoodListLoading(true);
              setActiveView("foods");
            }}
          >
            식사 기록
          </button>
          <button
            className={activeView === "foodDb" ? "active" : ""}
            type="button"
            onClick={() => {
              setSavedFoodsLoading(true);
              setActiveView("foodDb");
            }}
          >
            내 음식 DB
          </button>
          <button
            className={activeView === "insights" ? "active" : ""}
            type="button"
            onClick={() => {
              setInsightAnchor(dateFromKey(selectedDate));
              setActiveView("insights");
            }}
          >
            인사이트
          </button>
          <button
            className={activeView === "profile" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("profile")}
          >
            마이페이지
          </button>
        </nav>
        <div className="profile-actions">
          <div
            className="profile-dot"
            aria-label="개인 기록"
            title={userEmail}
          >
            {userEmail?.slice(0, 1).toUpperCase() ?? "나"}
          </div>
          {onSignOut && (
            <button
              className="sign-out-button"
              type="button"
              onClick={() => void onSignOut()}
            >
              로그아웃
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">식단 캘린더</p>
          <h1>
            오늘의 식단과
            <br />
            영양정보를 기록하세요.
          </h1>
        </div>
        <div>
          <p className="hero-copy">
            음식 사진, 공식 DB 검색, 직접 입력으로 기록할 수 있습니다. 확인된
            영양정보와 추정값은 서로 구분해 표시합니다.
          </p>
          <div className="source-legend" aria-label="데이터 출처">
            <span className="source-pill">검증 DB</span>
            <span className="source-pill label">제품 표시값</span>
            <span className="source-pill ai">AI 추정값</span>
          </div>
        </div>
      </section>

      {isDemo && (
        <div className="demo-banner">
          <span>
            지금은 화면을 이해하기 위한 예시 기록이에요. 첫 음식을 추가하면 예시가
            사라집니다.
          </span>
          <button
            type="button"
            onClick={() => {
              setMeals([]);
              setIsDemo(false);
            }}
          >
            예시 비우기
          </button>
        </div>
      )}

      {(activeView === "calendar" || activeView === "insights") && <section
        className="summary-grid"
        aria-label={activeView === "calendar" ? "선택한 날짜 영양 요약" : "기간 영양 요약"}
      >
        <SummaryCard
          label={
            activeView === "calendar"
              ? "오늘의 에너지"
              : insightPeriod === "day"
                ? "이날의 에너지"
                : "하루 평균 에너지"
          }
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.calories
              : periodInsights.averageValues.calories,
          )}
          unit="kcal"
          goal={Math.round(
            activeView === "calendar"
              ? selectedGoals.calories
              : insightGoals.calories,
          )}
          primary
        />
        <SummaryCard
          label="탄수화물"
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.carbs
              : periodInsights.averageValues.carbs,
          )}
          unit="g"
          goal={Math.round(
            activeView === "calendar" ? selectedGoals.carbs : insightGoals.carbs,
          )}
        />
        <SummaryCard
          label="단백질"
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.protein
              : periodInsights.averageValues.protein,
          )}
          unit="g"
          goal={Math.round(
            activeView === "calendar"
              ? selectedGoals.protein
              : insightGoals.protein,
          )}
        />
        <SummaryCard
          label="지방"
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.fat
              : periodInsights.averageValues.fat,
          )}
          unit="g"
          goal={Math.round(
            activeView === "calendar" ? selectedGoals.fat : insightGoals.fat,
          )}
        />
      </section>}

      {activeView === "calendar" ? (
      <section className="dashboard-grid">
        <div className="panel calendar-panel">
          <div className="panel-header">
            <div>
              <h2>
                {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
              </h2>
              <p className="date-kicker">날짜를 눌러 하루 기록을 확인하세요.</p>
            </div>
            <div className="month-controls">
              <button
                className="icon-button"
                type="button"
                aria-label="이전 달"
                onClick={() => changeMonth(-1)}
              >
                ←
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDate(dateKey(today));
                }}
              >
                오늘
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="다음 달"
                onClick={() => changeMonth(1)}
              >
                →
              </button>
            </div>
          </div>
          <div className="weekdays">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {monthCells.map((date) => {
              const key = dateKey(date);
              const dayMeals = dailyMap.get(key) ?? [];
              const totals = sumNutrition(dayMeals);
              const isOutside = date.getMonth() !== viewMonth.getMonth();
              const isToday = key === dateKey(today);
              const isSelected = key === selectedDate;
              return (
                <button
                  className={[
                    "day-cell",
                    isOutside ? "outside" : "",
                    isToday ? "today" : "",
                    isSelected ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={key}
                  type="button"
                  aria-label={`${key}, ${Math.round(totals.calories)}킬로칼로리`}
                  onClick={() => {
                    setSelectedDate(key);
                    if (isOutside) {
                      setViewMonth(
                        new Date(date.getFullYear(), date.getMonth(), 1),
                      );
                    }
                  }}
                >
                  <span className="day-number">{date.getDate()}</span>
                  {dayTypes[key] && dayTypes[key] !== "default" && (
                    <span className={`day-type-badge ${dayTypes[key]}`}>
                      운동
                    </span>
                  )}
                  {completedDays[key] && (
                    <span className="day-complete-mark" aria-label="기록 완료">
                      ✓
                    </span>
                  )}
                  {dayMeals.length > 0 && (
                    <>
                      <span className="day-kcal">
                        {Math.round(totals.calories).toLocaleString()} kcal
                      </span>
                      <span className="day-dots" aria-hidden="true">
                        {dayMeals.slice(0, 3).map((meal) => (
                          <span
                            className={`day-dot ${sourceClass(meal.sourceType)}`}
                            key={meal.id}
                          />
                        ))}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="day-type-selector" aria-label="선택한 날짜 유형">
            {([
              ["default", "운동 없는 날"],
              ["exercise", "운동 하는 날"],
            ] as Array<[DayType, string]>).map(([value, label]) => (
              <button
                className={(dayTypes[selectedDate] ?? "default") === value ? "active" : ""}
                key={value}
                type="button"
                onClick={async () => {
                  try {
                    await client.setCalendarSettings(
                      selectedDate,
                      value,
                      completedDays[selectedDate] ?? false,
                    );
                    setDayTypes((current) => ({ ...current, [selectedDate]: value }));
                    showToast(`${label}로 설정했어요.`);
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : "저장하지 못했습니다.");
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className={`day-complete-toggle ${
              completedDays[selectedDate] ? "active" : ""
            }`}
            type="button"
            aria-pressed={completedDays[selectedDate] ?? false}
            onClick={async () => {
              const nextValue = !(completedDays[selectedDate] ?? false);
              try {
                await client.setCalendarSettings(
                  selectedDate,
                  dayTypes[selectedDate] ?? "default",
                  nextValue,
                );
                setCompletedDays((current) => ({
                  ...current,
                  [selectedDate]: nextValue,
                }));
                showToast(
                  nextValue
                    ? "이날의 식사 기록을 완료했어요."
                    : "기록 중인 날로 되돌렸어요.",
                );
              } catch (error) {
                showToast(
                  error instanceof Error ? error.message : "저장하지 못했습니다.",
                );
              }
            }}
          >
            <span aria-hidden="true">{completedDays[selectedDate] ? "✓" : "○"}</span>
            <span>
              <strong>이날 기록 완료</strong>
              <small>완료한 날은 일·주·월 목표 달성 분석에 우선 반영됩니다.</small>
            </span>
          </button>
        </div>

        <aside className="panel day-panel">
          <div className="panel-header">
            <div>
              <h2>{displayDate(selectedDate)}</h2>
              <p className="date-kicker">
                {selectedMeals.length > 0
                  ? `${selectedMeals.length}개의 음식 · ${Math.round(
                      selectedTotals.calories,
                    ).toLocaleString()} kcal`
                  : "아직 기록이 없어요"}
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="음식 추가"
              onClick={() => openAdd()}
            >
              +
            </button>
          </div>

          {selectedMeals.length > 0 ? (
            <div className="meal-list">
              {selectedMeals.map((meal) => (
                <article className="meal-card" key={meal.id}>
                  <span
                    className={`meal-type-label ${mealTypeClass(meal.mealType)}`}
                  >
                    {meal.mealType}
                  </span>
                  <div>
                    <h3 className="meal-name">{meal.foodName}</h3>
                    <div className="meal-meta">
                      <span>{meal.mealType}</span>
                      {meal.mealTime && (
                        <>
                          <span>·</span>
                          <span>{meal.mealTime}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {meal.servingAmount}
                        {meal.servingUnit}
                      </span>
                      <span
                        className={`source-badge ${sourceClass(meal.sourceType)}`}
                      >
                        {meal.sourceLabel || SOURCE_LABELS[meal.sourceType]}
                      </span>
                    </div>
                  </div>
                  <div className="meal-calories">
                    <strong>{Math.round(meal.calories)}</strong>
                    <span>kcal</span>
                  </div>
                  <div className="meal-actions">
                    {!meal.demo && (
                      <button
                        className="edit-meal"
                        type="button"
                        aria-label={`${meal.foodName} 수정`}
                        onClick={() => openEdit(meal)}
                      >
                        수정
                      </button>
                    )}
                    <button
                      className="delete-meal"
                      type="button"
                      aria-label={`${meal.foodName} 삭제`}
                      onClick={() => setDeleteTarget({ kind: "meal", item: meal })}
                    >
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <strong>첫 끼를 기록해볼까요?</strong>
                사진, 공식 DB 검색, 직접 입력 중 편한 방법을 골라주세요.
              </div>
            </div>
          )}
          <button className="add-button" type="button" onClick={() => openAdd()}>
            <span aria-hidden="true">＋</span>
            음식 추가하기
          </button>
        </aside>
      </section>
      ) : activeView === "insights" ? (
        <InsightsPanel
          period={insightPeriod}
          start={insightRange.start}
          end={insightRange.end}
          insights={periodInsights}
          dayTypes={dayTypes}
          completedDays={completedDays}
          goals={nutritionGoals}
          onChangePeriod={setInsightPeriod}
          onChangeRange={changeInsightRange}
        />
      ) : activeView === "foods" ? (
        <FoodListPanel
          loading={foodListLoading}
          meals={filteredAllMeals}
          dailyMeals={allMeals}
          goals={nutritionGoals}
          query={foodListQuery}
          onQueryChange={setFoodListQuery}
          onEdit={openEdit}
        />
      ) : activeView === "foodDb" ? (
        <SavedFoodPanel
          foods={savedFoods}
          loading={savedFoodsLoading}
          onAdd={() => openSavedFoodEditor()}
          onAddToMeal={addSavedFoodToMeal}
          onDelete={(food) => setDeleteTarget({ kind: "savedFood", item: food })}
          onEdit={openSavedFoodEditor}
        />
      ) : (
        <ProfilePanel
          key={JSON.stringify(nutritionGoals)}
          email={userEmail}
          goals={nutritionGoals}
          onSave={async (goals) => {
            try {
              const saved = await client.updateNutritionGoals(goals);
              setNutritionGoals(saved);
              showToast("하루 영양 목표를 저장했어요.");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "목표를 저장하지 못했습니다.");
            }
          }}
        />
      )}

      <button
        className="floating-add"
        type="button"
        aria-label="음식 추가"
        onClick={() => openAdd()}
      >
        +
      </button>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeModal();
          }}
        >
          <section
            aria-labelledby="add-food-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="add-food-title">음식 기록하기</h2>
                <p>{displayDate(selectedDate)}에 추가합니다.</p>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="닫기"
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <div className="tabs" role="tablist" aria-label="음식 입력 방법">
              <button
                className={activeTab === "saved" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === "saved"}
                onClick={() => setActiveTab("saved")}
              >
                내 음식 DB
              </button>
              <button
                className={activeTab === "search" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === "search"}
                onClick={() => setActiveTab("search")}
              >
                공식 DB 검색
              </button>
              <button
                className={activeTab === "photo" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === "photo"}
                onClick={() => setActiveTab("photo")}
              >
                사진 분석
              </button>
              <button
                className={activeTab === "manual" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === "manual"}
                onClick={() => {
                  setLoadedSavedFood(null);
                  setLoadedFoodResult(null);
                  setManualFoodResults([]);
                  setManualFoodSearchDone(false);
                  setSavedFoodQuantity("1");
                  setActiveTab("manual");
                }}
              >
                직접 입력
              </button>
            </div>

            <div className="tab-content">
              {activeTab === "saved" && (
                <>
                  <div className="search-box">
                    <input
                      className="search-input"
                      type="search"
                      aria-label="내 음식 DB 검색"
                      placeholder="저장한 음식 검색"
                      value={savedFoodQuery}
                      onChange={(event) => setSavedFoodQuery(event.target.value)}
                    />
                  </div>
                  <p className="helper-note">
                    음식을 불러온 뒤 날짜, 시간, 식사 구분과 섭취량을 확인하고 기록합니다.
                  </p>
                  <div className="search-results">
                    {savedFoodsLoading ? (
                      <Skeleton count={3} height={58} />
                    ) : savedFoods
                        .filter((food) =>
                          food.name
                            .toLocaleLowerCase("ko")
                            .includes(savedFoodQuery.trim().toLocaleLowerCase("ko")),
                        )
                        .map((food) => (
                          <button
                            className="food-result"
                            type="button"
                            key={food.id}
                            onClick={() => loadSavedFood(food)}
                          >
                            <span>
                              <strong>{food.name}</strong>
                              <span>
                                {food.servingAmount}{food.servingUnit} · 탄 {Math.round(food.carbs)}g ·
                                단 {Math.round(food.protein)}g · 지 {Math.round(food.fat)}g
                              </span>
                            </span>
                            <span className="result-kcal">
                              {Math.round(food.calories)} kcal
                            </span>
                          </button>
                        ))}
                    {!savedFoodsLoading && savedFoods.length === 0 && (
                      <div className="notice">
                        내 음식 DB가 비어 있어요. 상단 메뉴의 ‘내 음식 DB’에서 먼저 등록해주세요.
                      </div>
                    )}
                  </div>
                </>
              )}
              {activeTab === "search" && (
                <>
                  <form className="search-box" onSubmit={handleSearch}>
                    <input
                      className="search-input"
                      aria-label="제품 또는 음식 검색"
                      placeholder="예: 그릭요거트, 닭가슴살"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <button
                      className="search-button"
                      type="submit"
                      disabled={searching}
                    >
                      {searching ? "검색 중" : "검색"}
                    </button>
                  </form>
                  <p className="helper-note">
                    식약처 식품영양성분 DB를 우선 사용하고, 결과가 없거나 연결되지
                    않은 경우 USDA FoodData Central의 공식 분석값을 보여드립니다.
                    결과를 선택한 뒤 섭취량과 시간을 수정할 수 있어요.
                  </p>
                  <div className="search-results">
                    {foodResults.map((food) => (
                      <button
                        className="food-result"
                        type="button"
                        key={food.id}
                        onClick={() => loadFoodResult(food)}
                      >
                        <span>
                          <strong>{food.name}</strong>
                          <span>
                            {food.maker ? `${food.maker} · ` : ""}
                            {food.servingAmount}
                            {food.servingUnit} · {food.sourceLabel}
                          </span>
                        </span>
                        <span className="result-nutrition">
                          <strong>{Math.round(food.calories)} kcal</strong>
                          <small>
                            탄 {food.carbs.toFixed(1)} · 단 {food.protein.toFixed(1)} ·
                            지 {food.fat.toFixed(1)}g
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "photo" && (
                <>
                  <label className="upload-zone">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                    />
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="선택한 음식" />
                    ) : (
                      <span className="upload-placeholder">
                        <span aria-hidden="true" style={{ fontSize: 32 }}>
                          ◫
                        </span>
                        <strong>음식이나 영양정보 표를 올려주세요</strong>
                        <span>정면에서 밝게 찍으면 더 잘 읽을 수 있어요.</span>
                      </span>
                    )}
                  </label>
                  <p className="helper-note">
                    사진은 비공개 저장소에 보관됩니다. 분석 결과는 바로 저장되지
                    않으며, 확인 후 기록에 반영됩니다.
                  </p>
                  {photoFile && (
                    <>
                      <div className="field-row">
                        <div className="field">
                          <label htmlFor="photo-meal-date">먹은 날짜</label>
                          <input
                            id="photo-meal-date"
                            type="date"
                            value={photoDate}
                            onChange={(event) => {
                              setPhotoDate(event.target.value);
                              setPhotoDateSource("selected");
                            }}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="photo-meal-time">먹은 시간</label>
                          <input
                            id="photo-meal-time"
                            type="time"
                            value={photoTime}
                            onChange={(event) => {
                              setPhotoTime(event.target.value);
                              setPhotoDateSource("selected");
                            }}
                          />
                        </div>
                      </div>
                      <p className="photo-time-note">
                        {photoDateSource === "exif"
                          ? "사진의 촬영 날짜와 시간을 가져왔어요. 실제 식사 시간과 다르면 수정해주세요."
                          : "사진에 촬영 시간이 없어 선택한 날짜를 사용합니다. 시간을 확인해주세요."}
                        {photoTime && (
                          <>
                            {" "}
                            이 시간은 <strong>{mealTypeFromTime(photoTime)}</strong>
                            으로 자동 분류됩니다.
                          </>
                        )}
                      </p>
                    </>
                  )}
                  <button
                    className="primary-button wide-button"
                    type="button"
                    disabled={!photoFile || analyzing}
                    onClick={analyzePhoto}
                  >
                    {analyzing ? "사진을 살펴보는 중…" : "사진 분석하기"}
                  </button>
                  {analyzing && (
                    <div className="analysis-loading" aria-live="polite">
                      <Skeleton
                        count={3}
                        height={18}
                        baseColor="#efeadf"
                        highlightColor="#fffdf8"
                      />
                      <p>음식 종류, 양, 영양정보 출처를 구분하고 있어요.</p>
                    </div>
                  )}
                  {analysis && (
                    <>
                      <div className="notice">
                        {analysis.summary}{" "}
                        {analysis.needsUserConfirmation &&
                          "저장하기 전에 음식과 양을 꼭 확인해주세요."}
                      </div>
                      <div className="analysis-results">
                        {analysis.items.map((item, index) => (
                          <div className="analysis-result" key={`${item.name}-${index}`}>
                            <div className="analysis-result-main">
                              <label htmlFor={`analysis-db-${index}`}>
                                내 음식 DB에서 바꾸기
                              </label>
                              <select
                                id={`analysis-db-${index}`}
                                className="analysis-db-select"
                                value={analysisDrafts[index]?.savedFoodId ?? ""}
                                onChange={(event) =>
                                  replaceAnalysisItemFromDb(index, event.target.value)
                                }
                              >
                                <option value="">사진 분석 결과 사용</option>
                                {savedFoods.map((food) => (
                                  <option key={food.id} value={String(food.id)}>
                                    {food.name} · {food.servingAmount}{food.servingUnit}
                                  </option>
                                ))}
                              </select>
                              <label htmlFor={`analysis-name-${index}`}>음식 이름</label>
                              <input
                                id={`analysis-name-${index}`}
                                value={analysisDrafts[index]?.name ?? item.name}
                                onChange={(event) =>
                                  setAnalysisDrafts((current) =>
                                    current.map((draft, draftIndex) =>
                                      draftIndex === index
                                        ? { ...draft, name: event.target.value }
                                        : draft,
                                    ),
                                  )
                                }
                              />
                              <p>
                                사진 속 추정량 {item.portionText} ·{" "}
                                {Math.round(item.nutrition.calories)} kcal · 단백질{" "}
                                {Math.round(item.nutrition.protein)}g
                              </p>
                              <div className="consumed-amount">
                                <label htmlFor={`analysis-mode-${index}`}>실제로 먹은 양</label>
                                <select
                                  id={`analysis-mode-${index}`}
                                  value={analysisDrafts[index]?.amountMode ?? "percent"}
                                  onChange={(event) =>
                                    setAnalysisDrafts((current) =>
                                      current.map((draft, draftIndex) =>
                                        draftIndex === index
                                          ? {
                                              ...draft,
                                              amountMode: event.target.value as "percent" | "grams",
                                              amount:
                                                event.target.value === "grams" && item.portionGrams
                                                  ? String(item.portionGrams)
                                                  : "100",
                                            }
                                          : draft,
                                      ),
                                    )
                                  }
                                >
                                  <option value="percent">사진 속 양의 %</option>
                                  {item.portionGrams && <option value="grams">그램(g)</option>}
                                </select>
                                <input
                                  inputMode="decimal"
                                  min="0"
                                  type="number"
                                  value={analysisDrafts[index]?.amount ?? "100"}
                                  onFocus={(event) => event.currentTarget.select()}
                                  onChange={(event) =>
                                    {
                                      const value = event.target.value;
                                      setAnalysisDrafts((current) =>
                                        current.map((draft, draftIndex) =>
                                          draftIndex === index
                                            ? { ...draft, amount: value }
                                            : draft,
                                        ),
                                      );
                                      if (
                                        index === 0 &&
                                        (analysisDrafts[index]?.amountMode ?? "percent") ===
                                          "percent" &&
                                        value !== ""
                                      ) {
                                        setBulkPercentPrompt(value);
                                      }
                                    }
                                  }
                                />
                                <span>
                                  {analysisDrafts[index]?.amountMode === "grams" ? "g" : "%"}
                                </span>
                              </div>
                              {index === 0 &&
                                bulkPercentPrompt !== null &&
                                analysis.items.length > 1 && (
                                  <div className="bulk-apply-prompt" role="status">
                                    <span>
                                      나머지 음식에도 {bulkPercentPrompt}%를 적용할까요?
                                    </span>
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAnalysisDrafts((current) =>
                                            current.map((draft) => ({
                                              ...draft,
                                              amountMode: "percent",
                                              amount: bulkPercentPrompt,
                                            })),
                                          );
                                          setBulkPercentPrompt(null);
                                        }}
                                      >
                                        모두 적용
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setBulkPercentPrompt(null)}
                                      >
                                        개별 입력
                                      </button>
                                    </div>
                                  </div>
                                )}
                            </div>
                            <span className="confidence">
                              신뢰도 {Math.round(item.confidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        className="primary-button wide-button"
                        type="button"
                        onClick={confirmAnalysis}
                      >
                        확인하고 기록하기
                      </button>
                    </>
                  )}
                </>
              )}

              {activeTab === "manual" && (
                <form onSubmit={handleManualSubmit}>
                  {loadedSavedFood && (
                    <section className="saved-food-quantity">
                      <div>
                        <strong>{loadedSavedFood.name}</strong>
                        <span>
                          {loadedSavedFood.servingAmount}
                          {loadedSavedFood.servingUnit}을 1회분으로 계산합니다.
                        </span>
                      </div>
                      <label htmlFor="saved-food-quantity">
                        수량
                        <input
                          id="saved-food-quantity"
                          inputMode="decimal"
                          min="0.1"
                          step="0.1"
                          type="number"
                          value={savedFoodQuantity}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSavedFoodQuantity(value);
                            applySavedFoodQuantity(
                              loadedSavedFood,
                              Number(value) || 0,
                            );
                          }}
                        />
                      </label>
                      <p>
                        수량에 맞춰 섭취량과 모든 영양성분이 계산됩니다. 계산 후 아래
                        값은 직접 수정할 수 있어요.
                      </p>
                    </section>
                  )}
                  {loadedFoodResult && (
                    <section className="official-food-loaded">
                      <div>
                        <span>공식 영양 DB 적용</span>
                        <strong>{loadedFoodResult.sourceLabel}</strong>
                        <p>
                          {loadedFoodResult.maker || loadedFoodResult.name}의{" "}
                          {loadedFoodResult.servingAmount}
                          {loadedFoodResult.servingUnit} 기준값을 불러왔습니다.
                          섭취량을 바꾸면 영양성분도 함께 계산됩니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLoadedFoodResult(null)}
                      >
                        직접 입력으로 전환
                      </button>
                    </section>
                  )}
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="meal-date">날짜</label>
                      <input
                        id="meal-date"
                        type="date"
                        value={manual.mealDate}
                        onChange={(event) =>
                          setManual({ ...manual, mealDate: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="meal-time">먹은 시간</label>
                      <input
                        id="meal-time"
                        type="time"
                        value={manual.mealTime}
                        onChange={(event) =>
                          setManual({ ...manual, mealTime: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="meal-type">식사 구분</label>
                      <select
                        id="meal-type"
                        value={manual.mealType}
                        onChange={(event) =>
                          setManual({ ...manual, mealType: event.target.value })
                        }
                      >
                        {["아침", "점심", "저녁", "간식"].map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field manual-food-name-field">
                    <label htmlFor="food-name">음식 이름</label>
                    <div className="manual-food-lookup">
                      <input
                        id="food-name"
                        placeholder="예: 스크램블 에그, 구운 연어"
                        value={manual.foodName}
                        onChange={(event) => {
                          setManual({ ...manual, foodName: event.target.value });
                          setLoadedFoodResult(null);
                          setManualFoodResults([]);
                          setManualFoodSearchDone(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void searchManualFood();
                          }
                        }}
                      />
                      <button
                        className="search-button"
                        type="button"
                        disabled={manualFoodSearching}
                        onClick={searchManualFood}
                      >
                        {manualFoodSearching
                          ? "공식 DB 검색 중"
                          : "영양정보 불러오기"}
                      </button>
                    </div>
                    <small>
                      입력한 이름과 조리법으로 식약처·USDA 공식 영양 DB를
                      검색합니다.
                    </small>
                  </div>
                  {(manualFoodResults.length > 0 ||
                    manualFoodSearchDone) && (
                    <div
                      className="search-results manual-food-results"
                      aria-live="polite"
                    >
                      {manualFoodResults.map((food) => (
                        <button
                          className="food-result"
                          type="button"
                          key={food.id}
                          onClick={() => loadFoodResult(food)}
                        >
                          <span>
                            <strong>{food.name}</strong>
                            <span>
                              {food.maker ? `${food.maker} · ` : ""}
                              {food.servingAmount}
                              {food.servingUnit} · {food.sourceLabel}
                            </span>
                          </span>
                          <span className="result-nutrition">
                            <strong>{Math.round(food.calories)} kcal</strong>
                            <small>
                              탄 {food.carbs.toFixed(1)} · 단{" "}
                              {food.protein.toFixed(1)} · 지{" "}
                              {food.fat.toFixed(1)}g
                            </small>
                          </span>
                        </button>
                      ))}
                      {manualFoodSearchDone &&
                        manualFoodResults.length === 0 && (
                          <div className="notice">
                            일치하는 공식 DB 항목이 없습니다. 음식 이름과 조리법을
                            조금 다르게 입력해보세요.
                          </div>
                        )}
                    </div>
                  )}
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="serving-amount">섭취량</label>
                      <input
                        id="serving-amount"
                        inputMode="decimal"
                        value={manual.servingAmount}
                        onChange={(event) =>
                          updateManualServingAmount(event.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="serving-unit">단위</label>
                      <input
                        id="serving-unit"
                        value={manual.servingUnit}
                        onChange={(event) => {
                          setManual({ ...manual, servingUnit: event.target.value });
                          setLoadedFoodResult(null);
                        }}
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <NutrientField
                      id="calories"
                      label="열량 (kcal)"
                      value={manual.calories}
                      onChange={(value) => setManual({ ...manual, calories: value })}
                    />
                    <NutrientField
                      id="carbs"
                      label="탄수화물 (g)"
                      value={manual.carbs}
                      onChange={(value) => setManual({ ...manual, carbs: value })}
                    />
                    <NutrientField
                      id="protein"
                      label="단백질 (g)"
                      value={manual.protein}
                      onChange={(value) => setManual({ ...manual, protein: value })}
                    />
                    <NutrientField
                      id="fat"
                      label="지방 (g)"
                      value={manual.fat}
                      onChange={(value) => setManual({ ...manual, fat: value })}
                    />
                    <NutrientField
                      id="sugar"
                      label="당류 (g)"
                      value={manual.sugar}
                      onChange={(value) => setManual({ ...manual, sugar: value })}
                    />
                    <NutrientField
                      id="sodium"
                      label="나트륨 (mg)"
                      value={manual.sodium}
                      onChange={(value) => setManual({ ...manual, sodium: value })}
                    />
                  </div>
                  <button className="primary-button wide-button" type="submit">
                    기록에 추가하기
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
      {editingMeal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setEditingMeal(null);
          }}
        >
          <section
            aria-labelledby="edit-food-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="edit-food-title">직접 입력 기록 수정</h2>
                <p>저장하면 기기 간 기록에도 바로 반영됩니다.</p>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="닫기"
                onClick={() => setEditingMeal(null)}
              >
                ×
              </button>
            </div>
            <form className="tab-content" onSubmit={handleEditSubmit}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="edit-meal-date">날짜</label>
                  <input
                    id="edit-meal-date"
                    type="date"
                    value={editForm.mealDate}
                    onChange={(event) =>
                      setEditForm({ ...editForm, mealDate: event.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-meal-type">식사 구분</label>
                  <select
                    id="edit-meal-type"
                    value={editForm.mealType}
                    onChange={(event) =>
                      setEditForm({ ...editForm, mealType: event.target.value })
                    }
                  >
                    {["아침", "점심", "저녁", "간식"].map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="edit-meal-time">먹은 시간</label>
                  <input
                    id="edit-meal-time"
                    type="time"
                    value={editForm.mealTime}
                    onChange={(event) =>
                      setEditForm({ ...editForm, mealTime: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-food-name">음식 이름</label>
                <input
                  id="edit-food-name"
                  required
                  value={editForm.foodName}
                  onChange={(event) =>
                    setEditForm({ ...editForm, foodName: event.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="edit-serving-amount">섭취량</label>
                  <input
                    id="edit-serving-amount"
                    inputMode="decimal"
                    value={editForm.servingAmount}
                    onChange={(event) =>
                      setEditForm({ ...editForm, servingAmount: event.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-serving-unit">단위</label>
                  <input
                    id="edit-serving-unit"
                    value={editForm.servingUnit}
                    onChange={(event) =>
                      setEditForm({ ...editForm, servingUnit: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="field-row">
                {[
                  ["calories", "열량 (kcal)"],
                  ["carbs", "탄수화물 (g)"],
                  ["protein", "단백질 (g)"],
                  ["fat", "지방 (g)"],
                  ["sugar", "당류 (g)"],
                  ["sodium", "나트륨 (mg)"],
                  ["fiber", "식이섬유 (g)"],
                ].map(([key, label]) => (
                  <NutrientField
                    id={`edit-${key}`}
                    key={key}
                    label={label}
                    value={editForm[key as keyof typeof editForm]}
                    onChange={(value) =>
                      setEditForm({ ...editForm, [key]: value })
                    }
                  />
                ))}
              </div>
              <button
                className="primary-button wide-button"
                type="submit"
                disabled={updating}
              >
                {updating ? "저장하는 중…" : "수정 내용 저장"}
              </button>
            </form>
          </section>
        </div>
      )}
      {savedFoodEditor && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSavedFoodEditor(null);
          }}
        >
          <section
            aria-labelledby="saved-food-editor-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="saved-food-editor-title">
                  {savedFoodEditor === "new" ? "내 음식 등록" : "내 음식 수정"}
                </h2>
                <p>먹은 날짜와 무관한 1회 섭취 기준 정보입니다.</p>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="닫기"
                onClick={() => setSavedFoodEditor(null)}
              >
                ×
              </button>
            </div>
            <form className="tab-content" onSubmit={handleSavedFoodSubmit}>
              <div className="field">
                <label htmlFor="saved-food-name">음식 이름</label>
                <input
                  id="saved-food-name"
                  required
                  value={savedFoodForm.name}
                  onChange={(event) =>
                    setSavedFoodForm({ ...savedFoodForm, name: event.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="saved-serving-amount">1회 섭취량</label>
                  <input
                    id="saved-serving-amount"
                    inputMode="decimal"
                    value={savedFoodForm.servingAmount}
                    onChange={(event) =>
                      setSavedFoodForm({
                        ...savedFoodForm,
                        servingAmount: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="saved-serving-unit">단위</label>
                  <input
                    id="saved-serving-unit"
                    value={savedFoodForm.servingUnit}
                    onChange={(event) =>
                      setSavedFoodForm({
                        ...savedFoodForm,
                        servingUnit: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="field-row">
                {[
                  ["calories", "열량 (kcal)"],
                  ["carbs", "탄수화물 (g)"],
                  ["protein", "단백질 (g)"],
                  ["fat", "지방 (g)"],
                  ["sugar", "당류 (g)"],
                  ["sodium", "나트륨 (mg)"],
                  ["fiber", "식이섬유 (g)"],
                ].map(([key, label]) => (
                  <NutrientField
                    id={`saved-${key}`}
                    key={key}
                    label={label}
                    value={savedFoodForm[key as keyof typeof savedFoodForm]}
                    onChange={(value) =>
                      setSavedFoodForm({ ...savedFoodForm, [key]: value })
                    }
                  />
                ))}
              </div>
              <button className="primary-button wide-button" type="submit">
                {savedFoodEditor === "new" ? "내 음식 DB에 저장" : "수정 내용 저장"}
              </button>
            </form>
          </section>
        </div>
      )}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDeleteTarget(null);
          }}
        >
          <section
            aria-labelledby="delete-confirm-title"
            aria-modal="true"
            className="modal confirm-modal"
            role="alertdialog"
          >
            <div className="modal-header">
              <div>
                <h2 id="delete-confirm-title">
                  {deleteTarget.kind === "meal" ? "식사 기록을 삭제할까요?" : "저장한 음식을 삭제할까요?"}
                </h2>
                <p>
                  ‘{deleteTarget.kind === "meal"
                    ? deleteTarget.item.foodName
                    : deleteTarget.item.name}’을 삭제하면 되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <div className="confirm-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => void confirmDelete()}
              >
                삭제
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function FoodListPanel({
  loading,
  meals,
  dailyMeals,
  goals,
  query,
  onQueryChange,
  onEdit,
}: {
  loading: boolean;
  meals: MealRecord[];
  dailyMeals: MealRecord[];
  goals: NutritionGoals;
  query: string;
  onQueryChange: (query: string) => void;
  onEdit: (meal: MealRecord) => void;
}) {
  const macroMax = Math.max(
    10,
    ...meals.flatMap((meal) => [meal.carbs, meal.protein, meal.fat]),
  );
  const dailyTotals = useMemo(() => {
    const days = new Map<string, MealRecord[]>();
    for (const meal of dailyMeals) {
      const rows = days.get(meal.mealDate) ?? [];
      rows.push(meal);
      days.set(meal.mealDate, rows);
    }
    return [...days.entries()]
      .map(([date, rows]) => ({ date, ...sumNutrition(rows) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyMeals]);
  return (
    <section className="food-list-panel" aria-labelledby="food-list-title">
      <div className="food-list-heading">
        <div>
          <p className="eyebrow">내 식사 기록</p>
          <h2 id="food-list-title">실제로 먹은 음식</h2>
          <p>같은 g 척도의 막대로 실제 영양소 양과 밀도를 비교해보세요.</p>
        </div>
        <label className="food-list-search">
          <span className="sr-only">음식 검색</span>
          <input
            type="search"
            placeholder="음식 이름 또는 식사 구분 검색"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      </div>
      {!loading && dailyTotals.length > 0 && (
        <div className="daily-goal-section">
          <div className="daily-goal-heading">
            <strong>날짜별 목표 달성</strong>
            <span>
              칼로리 {goals.calories.toLocaleString()} kcal · 탄 {goals.carbs}g ·
              단 {goals.protein}g · 지 {goals.fat}g 기준
            </span>
          </div>
          <div className="daily-goal-list">
            {dailyTotals.map((day) => (
              <article className="daily-goal-card" key={day.date}>
                <strong>{day.date}</strong>
                {[
                  ["칼", day.calories, goals.calories, "kcal", "calories"],
                  ["탄", day.carbs, goals.carbs, "g", "carbs"],
                  ["단", day.protein, goals.protein, "g", "protein"],
                  ["지", day.fat, goals.fat, "g", "fat"],
                ].map(([label, value, goal, unit, nutrient]) => {
                  const numericValue = Number(value);
                  const numericGoal = Number(goal);
                  const percent = Math.round((numericValue / numericGoal) * 100);
                  return (
                    <div className="daily-goal-row" key={String(label)}>
                      <span className={`daily-goal-label ${nutrient}`}>{label}</span>
                      <span className="daily-goal-track" aria-hidden="true">
                        <span
                          className={`daily-goal-fill ${nutrient}`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </span>
                      <span className="daily-goal-value">
                        <strong>{Math.round(numericValue).toLocaleString()}</strong>
                        /{numericGoal.toLocaleString()}{unit}
                      </span>
                      <strong className={percent > 100 ? "over-goal" : ""}>
                        {percent}%
                      </strong>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        </div>
      )}
      {loading ? (
        <div className="food-list-loading" aria-live="polite">
          <Skeleton
            count={5}
            height={70}
            baseColor="#efeadf"
            highlightColor="#fffdf8"
          />
        </div>
      ) : meals.length === 0 ? (
        <div className="empty-state insights-empty">
          <div>
            <strong>{query ? "검색 결과가 없어요." : "아직 기록한 음식이 없어요."}</strong>
            {query
              ? "다른 음식 이름이나 식사 구분으로 찾아보세요."
              : "캘린더에서 첫 음식을 추가해보세요."}
          </div>
        </div>
      ) : (
        <>
          <div className="food-table-wrap">
          <table className="food-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>음식</th>
                <th>식사</th>
                <th>먹은 시간</th>
                <th>섭취량</th>
                <th>영양 구성</th>
                <th>열량·단백질 밀도</th>
                <th>출처</th>
                <th><span className="sr-only">작업</span></th>
              </tr>
            </thead>
            <tbody>
              {meals.map((meal) => (
                <tr key={meal.id}>
                  <td>{meal.mealDate}</td>
                  <td>
                    <strong>{meal.foodName}</strong>
                  </td>
                  <td>{meal.mealType}</td>
                  <td>{meal.mealTime || "—"}</td>
                  <td>{meal.servingAmount}{meal.servingUnit}</td>
                  <td>
                    <MacroBar
                      carbs={meal.carbs}
                      protein={meal.protein}
                      fat={meal.fat}
                      maxGrams={macroMax}
                    />
                  </td>
                  <td>
                    <div className="density-cell">
                      <strong>{Math.round(meal.calories).toLocaleString()} kcal</strong>
                      <span>
                        100 kcal당 단백질{" "}
                        {Math.round(
                          (meal.protein / Math.max(meal.calories, 1)) * 100,
                        )}
                        g
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`source-badge ${sourceClass(meal.sourceType)}`}>
                      {meal.sourceLabel || SOURCE_LABELS[meal.sourceType]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="table-edit-button"
                      type="button"
                      onClick={() => onEdit(meal)}
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="food-mobile-list">
            {meals.map((meal) => (
              <article className="food-mobile-card" key={meal.id}>
              <header>
                <div>
                  <span className={`meal-type-label ${mealTypeClass(meal.mealType)}`}>
                    {meal.mealType}
                  </span>
                  <div>
                    <h3>{meal.foodName}</h3>
                    <p>
                      {meal.mealDate} · {meal.mealTime || "시간 미입력"} ·{" "}
                      {meal.servingAmount}
                      {meal.servingUnit}
                    </p>
                  </div>
                </div>
                <strong>
                  {Math.round(meal.calories).toLocaleString()}
                  <small>kcal</small>
                </strong>
              </header>
              <div className="food-mobile-nutrients">
                <span className="carbs">
                  <small>탄수화물</small>
                  <strong>{meal.carbs.toFixed(1)}g</strong>
                </span>
                <span className="protein">
                  <small>단백질</small>
                  <strong>{meal.protein.toFixed(1)}g</strong>
                </span>
                <span className="fat">
                  <small>지방</small>
                  <strong>{meal.fat.toFixed(1)}g</strong>
                </span>
              </div>
              <footer>
                <div>
                  <span className={`source-badge ${sourceClass(meal.sourceType)}`}>
                    {meal.sourceLabel || SOURCE_LABELS[meal.sourceType]}
                  </span>
                  <small>
                    100kcal당 단백질{" "}
                    {Math.round(
                      (meal.protein / Math.max(meal.calories, 1)) * 100,
                    )}
                    g
                  </small>
                </div>
                <button
                  className="table-edit-button"
                  type="button"
                  onClick={() => onEdit(meal)}
                >
                  수정
                </button>
              </footer>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProfilePanel({
  email,
  goals,
  onSave,
}: {
  email?: string;
  goals: NutritionGoals;
  onSave: (goals: NutritionGoals) => void | Promise<void>;
}) {
  const [form, setForm] = useState(goals);
  return (
    <section className="profile-panel" aria-labelledby="profile-title">
      <div className="profile-heading">
        <p className="eyebrow">나의 기준</p>
        <h2 id="profile-title">마이페이지</h2>
        <p>{email ?? "내 계정"} · 하루 권장 섭취 목표를 관리합니다.</p>
      </div>
      <div className="goal-type-field">
        <label htmlFor="goal-type">목표 유형</label>
        <input
          id="goal-type"
          value={form.goalType}
          onChange={(event) => setForm({ ...form, goalType: event.target.value })}
        />
      </div>
      <form
        className="goal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <h3 className="goal-section-title">나의 영양 목표</h3>
        <p className="goal-section-description">
          캘린더에서 운동 여부를 선택하면 해당 목표가 식단 진행률에 적용됩니다.
        </p>
        <div className="day-goal-grid">
          {([
            {
              key: "default",
              title: "운동 없는 날",
              description:
                "계획한 운동을 하지 않는 날입니다. 일상 활동을 기준으로 한 기본 목표를 사용합니다.",
              fields: [
                ["calories", "칼로리", "kcal"],
                ["carbs", "탄수화물", "g"],
                ["protein", "단백질", "g"],
                ["fat", "지방", "g"],
              ],
            },
            {
              key: "exercise",
              title: "운동 하는 날",
              description:
                "근력·유산소 등 계획한 운동을 한 날입니다. 활동량에 맞춰 에너지와 탄수화물 범위를 높입니다.",
              fields: [
                ["exerciseCaloriesMin", "칼로리 최소", "kcal"],
                ["exerciseCaloriesMax", "칼로리 최대", "kcal"],
                ["exerciseCarbsMin", "탄수화물 최소", "g"],
                ["exerciseCarbsMax", "탄수화물 최대", "g"],
                ["exerciseProteinMin", "단백질 최소", "g"],
                ["exerciseProteinMax", "단백질 최대", "g"],
                ["exerciseFat", "지방", "g"],
              ],
            },
          ] as Array<{
            key: DayType;
            title: string;
            description: string;
            fields: Array<[keyof NutritionGoals, string, string]>;
          }>).map((section) => (
            <section
              className={`day-goal-card ${section.key}`}
              key={section.key}
            >
              <header>
                <span>{section.title}</span>
                <p>{section.description}</p>
              </header>
              <div className="day-goal-fields">
                {section.fields.map(([key, label, unit]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <div>
                      <input
                        min="1"
                        inputMode="decimal"
                        type="number"
                        value={form[key]}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [key]: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />
                      <small>{unit}</small>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <button className="primary-button wide-button" type="submit">
          영양 목표 저장
        </button>
      </form>
    </section>
  );
}

function MacroBar({
  carbs,
  protein,
  fat,
  maxGrams,
}: {
  carbs: number;
  protein: number;
  fat: number;
  maxGrams: number;
}) {
  const macros = [
    { key: "carbs", label: "탄", value: carbs },
    { key: "protein", label: "단", value: protein },
    { key: "fat", label: "지", value: fat },
  ];
  return (
    <div className="macro-visual" aria-label={`탄수화물 ${carbs}g, 단백질 ${protein}g, 지방 ${fat}g`}>
      {macros.map((macro) => (
        <div className="macro-row" key={macro.key}>
          <span className={`macro-label ${macro.key}`}>{macro.label}</span>
          <span className="macro-track" aria-hidden="true">
            <span
              className={`macro-fill macro-${macro.key}`}
              style={{ width: `${Math.min(100, (macro.value / maxGrams) * 100)}%` }}
            />
          </span>
          <strong>{Math.round(macro.value)}g</strong>
        </div>
      ))}
    </div>
  );
}

function SavedFoodPanel({
  foods,
  loading,
  onAdd,
  onAddToMeal,
  onDelete,
  onEdit,
}: {
  foods: SavedFood[];
  loading: boolean;
  onAdd: () => void;
  onAddToMeal: (food: SavedFood) => void;
  onDelete: (food: SavedFood) => void;
  onEdit: (food: SavedFood) => void;
}) {
  const macroMax = Math.max(
    10,
    ...foods.flatMap((food) => [food.carbs, food.protein, food.fat]),
  );
  return (
    <section className="food-list-panel" aria-labelledby="saved-food-title">
      <div className="food-list-heading">
        <div>
          <p className="eyebrow">나만의 영양 사전</p>
          <h2 id="saved-food-title">내 음식 DB</h2>
          <p>자주 먹는 음식 정보를 미리 저장하고 식사 기록에 바로 추가하세요.</p>
        </div>
        <button className="primary-button" type="button" onClick={onAdd}>
          새 음식 등록
        </button>
      </div>
      {loading ? (
        <div className="food-list-loading">
          <Skeleton count={4} height={150} />
        </div>
      ) : foods.length === 0 ? (
        <div className="empty-state insights-empty">
          <div>
            <strong>미리 저장한 음식이 없어요.</strong>
            자주 먹는 음식이나 레시피의 1회분 영양정보를 등록해보세요.
          </div>
        </div>
      ) : (
        <div className="saved-food-grid">
          {foods.map((food) => (
            <article className="saved-food-card" key={food.id}>
              <div className="saved-food-card-head">
                <div>
                  <h3>{food.name}</h3>
                  <p>{food.servingAmount}{food.servingUnit} 기준</p>
                </div>
                <strong>{Math.round(food.calories)}<small> kcal</small></strong>
              </div>
              <MacroBar
                carbs={food.carbs}
                protein={food.protein}
                fat={food.fat}
                maxGrams={macroMax}
              />
              <div className="saved-food-actions">
                <button type="button" onClick={() => onAddToMeal(food)}>
                  선택한 날짜에 기록
                </button>
                <button type="button" onClick={() => onEdit(food)}>수정</button>
                <button type="button" onClick={() => onDelete(food)}>삭제</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InsightsPanel({
  period,
  start,
  end,
  insights,
  dayTypes,
  completedDays,
  goals,
  onChangePeriod,
  onChangeRange,
}: {
  period: InsightPeriod;
  start: Date;
  end: Date;
  insights: ReturnType<typeof buildPeriodInsights>;
  dayTypes: Record<string, DayType>;
  completedDays: Record<string, boolean>;
  goals: NutritionGoals;
  onChangePeriod: (period: InsightPeriod) => void;
  onChangeRange: (offset: number) => void;
}) {
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(
    null,
  );
  const [selectedTimeHour, setSelectedTimeHour] = useState<number | null>(null);
  const maxCalories = Math.max(
    2000,
    ...insights.dailyTotals.map((day) => day.calories),
  );
  const totalMeals = insights.mealTypes.reduce(
    (total, item) => total + item.count,
    0,
  );
  const dailyTotalsByDate = useMemo(
    () => new Map(insights.dailyTotals.map((day) => [day.date, day])),
    [insights.dailyTotals],
  );
  const recordedDateSet = useMemo(
    () => new Set(insights.recordedDates),
    [insights.recordedDates],
  );
  const adherenceDays = useMemo(() => {
    return insights.rangeDates.map((date) => {
      const values = dailyTotalsByDate.get(date) ?? {
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
      };
      return evaluateAdherence({
        date,
        values,
        goals,
        dayType: dayTypes[date] ?? "default",
        isComplete: completedDays[date] ?? false,
        hasRecords: recordedDateSet.has(date),
      });
    });
  }, [
    completedDays,
    dailyTotalsByDate,
    dayTypes,
    goals,
    insights.rangeDates,
    recordedDateSet,
  ]);
  const completedAdherenceDays = adherenceDays.filter(
    (day) => day.status === "close" || day.status === "off",
  );
  const closeDayCount = completedAdherenceDays.filter(
    (day) => day.status === "close",
  ).length;
  const dominantDeviation = ADHERENCE_METRICS.map((metric) => ({
    ...metric,
    count: completedAdherenceDays.filter(
      (day) => day.status === "off" && day.dominantMetric === metric.key,
    ).length,
  })).sort((left, right) => right.count - left.count)[0];
  const recentStreak = (() => {
    const completed = [...completedAdherenceDays].sort((left, right) =>
      right.date.localeCompare(left.date),
    );
    if (completed[0]?.status !== "close") return 0;
    let streak = 1;
    for (let index = 1; index < completed.length; index += 1) {
      if (completed[index].status !== "close") break;
      const previous = new Date(`${completed[index - 1].date}T12:00:00`);
      previous.setDate(previous.getDate() - 1);
      if (dateKey(previous) !== completed[index].date) break;
      streak += 1;
    }
    return streak;
  })();
  const selectedAdherence =
    adherenceDays.find((day) => day.date === selectedHeatmapDate) ?? null;
  const heatmapLeadingCells = period === "month" ? start.getDay() : 0;
  const timeMetrics: Array<{
    key: AdherenceMetric;
    label: string;
    unit: string;
  }> = ADHERENCE_METRICS;
  const selectedTimeBucket =
    insights.nutritionTimeBuckets.find(
      (bucket) => bucket.hour === selectedTimeHour,
    ) ?? null;
  const hasTimedNutrition = insights.nutritionTimeBuckets.some(
    (bucket) =>
      bucket.calories > 0 ||
      bucket.carbs > 0 ||
      bucket.protein > 0 ||
      bucket.fat > 0,
  );
  const periodName =
    period === "day" ? "일간" : period === "week" ? "주간" : "월간";
  const averageCaption =
    period === "day"
      ? "선택한 날의 실제 섭취량"
      : `${
          insights.usesCompletedBasis ? "기록 완료일" : "기록이 있는 날"
        } ${insights.basisDayCount}일 기준 하루 평균`;

  return (
    <section className="insights-panel" aria-labelledby="insights-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{periodName} 인사이트</p>
          <h2 id="insights-title">{insightRangeLabel(period, start, end)}</h2>
          <p className="date-kicker">
            {averageCaption}
          </p>
        </div>
        <div className="insight-controls">
          <div className="insight-period-tabs" aria-label="인사이트 기간">
            {([
              ["day", "일"],
              ["week", "주"],
              ["month", "월"],
            ] as Array<[InsightPeriod, string]>).map(([value, label]) => (
              <button
                className={period === value ? "active" : ""}
                key={value}
                type="button"
                onClick={() => onChangePeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="month-controls">
            <button
              className="icon-button"
              type="button"
              aria-label={`이전 ${periodName}`}
              onClick={() => onChangeRange(-1)}
            >
              ←
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`다음 ${periodName}`}
              onClick={() => onChangeRange(1)}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {insights.dayCount === 0 && completedAdherenceDays.length === 0 ? (
        <div className="empty-state insights-empty">
          <div>
            <strong>아직 분석할 기록이 없어요.</strong>
            며칠간 식단을 기록하면 섭취 흐름과 식사 패턴을 확인할 수 있어요.
          </div>
        </div>
      ) : (
        <div className="insights-grid">
          <article className="insight-card">
            <span className="insight-label">기록한 날</span>
            <strong>{insights.dayCount}<small>일</small></strong>
            <p>같은 사진과 같은 시간을 한 끼로 묶어 총 {totalMeals}끼</p>
          </article>
          <article className="insight-card">
            <span className="insight-label">
              {period === "day" ? "이날 섭취 열량" : "하루 평균 열량"}
            </span>
            <strong>
              {Math.round(insights.averageValues.calories).toLocaleString()}
              <small>kcal</small>
            </strong>
            <p>{averageCaption}</p>
          </article>
          <article className="insight-card goal-heatmap-card">
            <div className="goal-heatmap-heading">
              <div>
                <span className="insight-label">{periodName} 목표 리듬</span>
                <p>
                  기록 완료한 날은 목표에 가까울수록 진한 녹색, 벗어난 날은 가장
                  차이가 큰 항목의 색으로 표시합니다. 운동 없는 날의 근접 범위는
                  칼로리 ±10%, 탄단지 ±15%입니다.
                </p>
              </div>
              <div className="goal-heatmap-summary">
                <span>
                  목표 근접 <strong>{closeDayCount}</strong>/
                  {completedAdherenceDays.length}일
                </span>
                <span>
                  자주 벗어난 항목{" "}
                  <strong>
                    {dominantDeviation.count > 0
                      ? dominantDeviation.label
                      : "아직 없음"}
                  </strong>
                </span>
                <span>
                  최근 연속 <strong>{recentStreak}일</strong>
                </span>
              </div>
            </div>
            <div className="goal-heatmap-legend" aria-label="목표 리듬 범례">
              <span className="close">목표 근접</span>
              <span className="calories">칼로리 차이</span>
              <span className="carbs">탄수화물 차이</span>
              <span className="protein">단백질 차이</span>
              <span className="fat">지방 차이</span>
              <span className="recording">기록 중</span>
            </div>
            {period !== "day" && (
              <div className="goal-heatmap-weekdays" aria-hidden="true">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
            )}
            <div
              className={`goal-heatmap period-${period}`}
              aria-label="날짜별 영양 목표 달성"
            >
              {Array.from({ length: heatmapLeadingCells }, (_, index) => (
                <span className="goal-day-placeholder" key={`blank-${index}`} />
              ))}
              {adherenceDays.map((day) => {
                const dominantLabel = ADHERENCE_METRICS.find(
                  (metric) => metric.key === day.dominantMetric,
                )?.label;
                const statusLabel =
                  day.status === "close"
                    ? "목표 근접"
                    : day.status === "off"
                      ? `${dominantLabel} ${
                          day.direction === "over" ? "초과" : "부족"
                        }`
                      : day.status === "recording"
                        ? "기록 중"
                        : "기록 없음";
                return (
                  <button
                    className={[
                      "goal-day",
                      day.status,
                      day.dominantMetric ?? "",
                      `level-${day.level}`,
                      selectedHeatmapDate === day.date ? "selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={day.date}
                    type="button"
                    title={`${day.date} · ${statusLabel}`}
                    aria-label={`${day.date}, ${statusLabel}`}
                    onClick={() => setSelectedHeatmapDate(day.date)}
                  >
                    <span>{Number(day.date.slice(-2))}</span>
                    {day.status === "off" && (
                      <small aria-hidden="true">
                        {day.direction === "over" ? "↑" : "↓"}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedAdherence && (
              <div className="goal-day-detail" aria-live="polite">
                <div>
                  <strong>{displayDate(selectedAdherence.date)}</strong>
                  <span>
                    {dayTypes[selectedAdherence.date] === "exercise"
                      ? "운동 하는 날"
                      : "운동 없는 날"}
                  </span>
                </div>
                {selectedAdherence.status === "empty" ? (
                  <p>아직 기록한 음식이 없어요.</p>
                ) : selectedAdherence.status === "recording" ? (
                  <p>
                    기록 중인 날입니다. 캘린더에서 ‘이날 기록 완료’를 선택하면
                    목표 달성을 평가합니다.
                  </p>
                ) : (
                  <>
                    <p>
                      {selectedAdherence.status === "close"
                        ? "칼로리와 탄단지가 모두 목표 범위에 가까워요."
                        : `${ADHERENCE_METRICS.find(
                            (metric) =>
                              metric.key === selectedAdherence.dominantMetric,
                          )?.label}이 목표보다 ${
                            selectedAdherence.direction === "over"
                              ? "많았어요."
                              : "적었어요."
                          }`}
                    </p>
                    <div className="goal-day-detail-values">
                      {ADHERENCE_METRICS.map((metric) => {
                        const targetLabel = configuredGoalLabel(
                          goals,
                          dayTypes[selectedAdherence.date] ?? "default",
                          metric.key,
                        );
                        return (
                          <span className={metric.key} key={metric.key}>
                            <small>{metric.label}</small>
                            <strong>
                              {Math.round(
                                selectedAdherence.values[metric.key],
                              ).toLocaleString()}
                              {metric.unit}
                            </strong>
                            <small>
                              목표 {targetLabel}
                              {metric.unit}
                            </small>
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
          <article className="insight-card trend-card">
            <div>
              <span className="insight-label">
                {period === "day" ? "이날 섭취 열량" : "일별 섭취 열량"}
              </span>
              <p>
                {period === "day"
                  ? "선택한 날짜의 총 섭취량입니다."
                  : "막대에 날짜별 총 섭취량을 표시합니다."}
              </p>
            </div>
            <div className="trend-bars" aria-label="날짜별 섭취 열량">
              {insights.dailyTotals.map((day) => (
                <div className="trend-day" key={day.date}>
                  <span
                    className="trend-bar"
                    style={{
                      height: `${Math.max(5, (day.calories / maxCalories) * 100)}%`,
                    }}
                    title={`${day.date}: ${Math.round(day.calories)} kcal`}
                  />
                  <small>{Number(day.date.slice(-2))}</small>
                </div>
              ))}
            </div>
          </article>
          <article className="insight-card meal-pattern-card">
            <span className="insight-label">식사별 기록 비중</span>
            <div className="meal-patterns">
              {insights.mealTypes.map((item) => {
                const percent = Math.round(
                  (item.count / Math.max(totalMeals, 1)) * 100,
                );
                return (
                  <div className="meal-pattern" key={item.type}>
                    <div>
                      <span>{item.type}</span>
                      <strong>{item.count}회 · {percent}%</strong>
                    </div>
                    <div className="progress-track" aria-hidden="true">
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
          <article className="insight-card meal-time-card">
            <div>
              <span className="insight-label">시간대별 영양 섭취</span>
              <p>
                00시부터 23시까지, 칼로리와 탄단지를 서로 합치지 않고 독립된
                막대로 비교합니다. {averageCaption}입니다.
              </p>
            </div>
            <div
              className="time-series-charts"
              aria-label="24시간 칼로리와 탄수화물, 단백질, 지방 그래프"
            >
              {timeMetrics.map((metric) => {
                const maxValue = Math.max(
                  1,
                  ...insights.nutritionTimeBuckets.map(
                    (bucket) => bucket[metric.key],
                  ),
                );
                return (
                  <section className={`time-series-row ${metric.key}`} key={metric.key}>
                    <div className="time-series-label">
                      <span>{metric.label}</span>
                      <small>
                        {metric.unit} · {period === "day" ? "실제 섭취" : "하루 평균"}
                      </small>
                    </div>
                    <div className="time-series-bars">
                      {insights.nutritionTimeBuckets.map((bucket) => {
                        const value = bucket[metric.key];
                        const label = `${String(bucket.hour).padStart(2, "0")}시 · ${
                          value < 10 ? value.toFixed(1) : Math.round(value)
                        }${metric.unit}`;
                        return (
                          <button
                            className={value > 0 ? "has-value" : ""}
                            key={bucket.hour}
                            type="button"
                            title={label}
                            aria-label={label}
                            onClick={() => setSelectedTimeHour(bucket.hour)}
                          >
                            <span
                              style={{
                                height: `${
                                  value > 0
                                    ? Math.max(6, (value / maxValue) * 100)
                                    : 0
                                }%`,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              <div className="time-series-axis" aria-hidden="true">
                {Array.from({ length: 24 }, (_, hour) => (
                  <span key={hour}>
                    {hour % 3 === 0 || hour === 23
                      ? String(hour).padStart(2, "0")
                      : ""}
                  </span>
                ))}
              </div>
            </div>
            {!hasTimedNutrition && (
              <p className="time-series-empty">
                먹은 시간을 입력하면 각 시간의 막대가 표시됩니다.
              </p>
            )}
            {selectedTimeBucket && (
              <div className="time-series-detail" aria-live="polite">
                <strong>
                  {String(selectedTimeBucket.hour).padStart(2, "0")}시
                </strong>
                <span>
                  칼로리 {Math.round(selectedTimeBucket.calories)}kcal
                </span>
                <span>탄수화물 {selectedTimeBucket.carbs.toFixed(1)}g</span>
                <span>단백질 {selectedTimeBucket.protein.toFixed(1)}g</span>
                <span>지방 {selectedTimeBucket.fat.toFixed(1)}g</span>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  goal,
  primary = false,
}: {
  label: string;
  value: number;
  unit: string;
  goal: number;
  primary?: boolean;
}) {
  const percent = Math.min(100, Math.round((value / goal) * 100));
  return (
    <article className={`summary-card ${primary ? "primary" : ""}`}>
      <div className="card-label">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="card-value">
        {value.toLocaleString()}
        <small>{unit}</small>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="summary-foot">하루 목표 {goal.toLocaleString()} {unit}</div>
    </article>
  );
}

function NutrientField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
