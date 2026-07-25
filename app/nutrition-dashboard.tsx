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
const MEAL_ICONS: Record<string, string> = {
  아침: "◐",
  점심: "●",
  저녁: "◒",
  간식: "✦",
};
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

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
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
  const [activeView, setActiveView] = useState<
    "calendar" | "foods" | "foodDb" | "insights"
  >("calendar");
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "saved" | "search" | "photo" | "manual"
  >(
    "saved",
  );
  const [manual, setManual] = useState(emptyManual(selectedDate));
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
  const [analysisDrafts, setAnalysisDrafts] = useState<AnalysisDraft[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "meal"; item: MealRecord }
    | { kind: "savedFood"; item: SavedFood }
    | null
  >(null);
  const [toast, setToast] = useState("");

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
    if (activeView !== "foods") return;
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
        if (!cancelled) setFoodListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeView, client]);

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

  const dailyMap = useMemo(() => {
    const map = new Map<string, MealRecord[]>();
    for (const meal of meals) {
      const existing = map.get(meal.mealDate) ?? [];
      existing.push(meal);
      map.set(meal.mealDate, existing);
    }
    return map;
  }, [meals]);

  const monthInsights = useMemo(() => {
    const actualMeals = meals.filter((meal) => !meal.demo);
    const days = new Map<string, MealRecord[]>();
    for (const meal of actualMeals) {
      const rows = days.get(meal.mealDate) ?? [];
      rows.push(meal);
      days.set(meal.mealDate, rows);
    }
    const dailyTotals = [...days.entries()]
      .map(([date, rows]) => ({ date, ...sumNutrition(rows) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const totals = sumNutrition(actualMeals);
    const dayCount = days.size;
    const mealTypes = ["아침", "점심", "저녁", "간식"].map((type) => ({
      type,
      count: actualMeals.filter((meal) => meal.mealType === type).length,
    }));
    const mealTimes = ["아침", "점심", "저녁", "간식"].map((type) => {
      const minutes = actualMeals
        .filter((meal) => meal.mealType === type && meal.mealTime)
        .map((meal) => {
          const [hour, minute] = (meal.mealTime ?? "").split(":").map(Number);
          return hour * 60 + minute;
        })
        .filter(Number.isFinite);
      return {
        type,
        count: minutes.length,
        averageMinutes: minutes.length
          ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length)
          : null,
        earliestMinutes: minutes.length ? Math.min(...minutes) : null,
        latestMinutes: minutes.length ? Math.max(...minutes) : null,
      };
    });
    return { dayCount, dailyTotals, totals, mealTypes, mealTimes };
  }, [meals]);

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
  }

  function loadSavedFood(food: SavedFood) {
    setManual({
      ...emptyManual(selectedDate),
      foodName: food.name,
      servingAmount: String(food.servingAmount),
      servingUnit: food.servingUnit,
      calories: String(food.calories),
      carbs: String(food.carbs),
      protein: String(food.protein),
      fat: String(food.fat),
      sugar: String(food.sugar),
      sodium: String(food.sodium),
      fiber: String(food.fiber),
    });
    setActiveTab("manual");
  }

  function closeModal() {
    setModalOpen(false);
    setAnalysis(null);
    setAnalysisDrafts([]);
    setPhotoFile(null);
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
        sourceType: "manual",
        sourceLabel: "직접 입력",
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

  async function addFoodResult(food: FoodResult) {
    try {
      await saveMeal({
        mealDate: selectedDate,
        mealTime: new Date().toTimeString().slice(0, 5),
        mealType: "점심",
        foodName: food.name,
        sourceType: food.sourceType,
        sourceLabel: food.sourceLabel,
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
      closeModal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
    setAnalysisDrafts([]);
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
      setAnalysisDrafts(
        result.items.map((item) => ({
          name: item.name,
          amountMode: item.portionGrams ? "grams" : "percent",
          amount: item.portionGrams ? String(item.portionGrams) : "100",
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
            mealType: "점심",
            foodName: draft.name.trim() || item.name,
            sourceType: item.sourceType,
            sourceLabel:
              item.sourceType === "label"
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
            onClick={() => setActiveView("insights")}
          >
            인사이트
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
            음식 사진, 제품 검색, 직접 입력으로 기록할 수 있습니다. 확인된
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
        aria-label={activeView === "calendar" ? "선택한 날짜 영양 요약" : "월간 영양 요약"}
      >
        <SummaryCard
          label={activeView === "calendar" ? "오늘의 에너지" : "하루 평균 에너지"}
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.calories
              : monthInsights.totals.calories / Math.max(monthInsights.dayCount, 1),
          )}
          unit="kcal"
          goal={2000}
          primary
        />
        <SummaryCard
          label="탄수화물"
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.carbs
              : monthInsights.totals.carbs / Math.max(monthInsights.dayCount, 1),
          )}
          unit="g"
          goal={250}
        />
        <SummaryCard
          label="단백질"
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.protein
              : monthInsights.totals.protein / Math.max(monthInsights.dayCount, 1),
          )}
          unit="g"
          goal={100}
        />
        <SummaryCard
          label="지방"
          value={Math.round(
            activeView === "calendar"
              ? selectedTotals.fat
              : monthInsights.totals.fat / Math.max(monthInsights.dayCount, 1),
          )}
          unit="g"
          goal={65}
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
                  <span className="meal-icon" aria-hidden="true">
                    {MEAL_ICONS[meal.mealType] ?? "○"}
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
                사진, 제품 검색, 직접 입력 중 편한 방법을 골라주세요.
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
          month={viewMonth}
          insights={monthInsights}
          onChangeMonth={changeMonth}
        />
      ) : activeView === "foods" ? (
        <FoodListPanel
          loading={foodListLoading}
          meals={filteredAllMeals}
          dailyMeals={allMeals}
          query={foodListQuery}
          onQueryChange={setFoodListQuery}
          onEdit={openEdit}
        />
      ) : (
        <SavedFoodPanel
          foods={savedFoods}
          loading={savedFoodsLoading}
          onAdd={() => openSavedFoodEditor()}
          onAddToMeal={addSavedFoodToMeal}
          onDelete={(food) => setDeleteTarget({ kind: "savedFood", item: food })}
          onEdit={openSavedFoodEditor}
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
                제품 검색
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
                onClick={() => setActiveTab("manual")}
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
                    식약처 식품영양성분 DB 연결 시 제품명·업체명·기준량을 함께
                    확인합니다. 연결 전에는 기능을 살펴볼 수 있는 참고값이 표시돼요.
                  </p>
                  <div className="search-results">
                    {foodResults.map((food) => (
                      <button
                        className="food-result"
                        type="button"
                        key={food.id}
                        onClick={() => addFoodResult(food)}
                      >
                        <span>
                          <strong>{food.name}</strong>
                          <span>
                            {food.maker ? `${food.maker} · ` : ""}
                            {food.servingAmount}
                            {food.servingUnit} · {food.sourceLabel}
                          </span>
                        </span>
                        <span className="result-kcal">
                          {Math.round(food.calories)} kcal
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
                                  onChange={(event) =>
                                    setAnalysisDrafts((current) =>
                                      current.map((draft, draftIndex) =>
                                        draftIndex === index
                                          ? { ...draft, amount: event.target.value }
                                          : draft,
                                      ),
                                    )
                                  }
                                />
                                <span>
                                  {analysisDrafts[index]?.amountMode === "grams" ? "g" : "%"}
                                </span>
                              </div>
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
                  <div className="field">
                    <label htmlFor="food-name">음식 이름</label>
                    <input
                      id="food-name"
                      placeholder="예: 집에서 만든 닭가슴살 샐러드"
                      value={manual.foodName}
                      onChange={(event) =>
                        setManual({ ...manual, foodName: event.target.value })
                      }
                    />
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="serving-amount">섭취량</label>
                      <input
                        id="serving-amount"
                        inputMode="decimal"
                        value={manual.servingAmount}
                        onChange={(event) =>
                          setManual({ ...manual, servingAmount: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="serving-unit">단위</label>
                      <input
                        id="serving-unit"
                        value={manual.servingUnit}
                        onChange={(event) =>
                          setManual({ ...manual, servingUnit: event.target.value })
                        }
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
  query,
  onQueryChange,
  onEdit,
}: {
  loading: boolean;
  meals: MealRecord[];
  dailyMeals: MealRecord[];
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
            <span>칼로리 2,000 kcal · 탄 250g · 단 100g · 지 65g 기준</span>
          </div>
          <div className="daily-goal-list">
            {dailyTotals.map((day) => (
              <article className="daily-goal-card" key={day.date}>
                <strong>{day.date}</strong>
                {[
                  ["칼", day.calories, 2000, "kcal", "calories"],
                  ["탄", day.carbs, 250, "g", "carbs"],
                  ["단", day.protein, 100, "g", "protein"],
                  ["지", day.fat, 65, "g", "fat"],
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
      )}
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
  month,
  insights,
  onChangeMonth,
}: {
  month: Date;
  insights: {
    dayCount: number;
    dailyTotals: Array<ReturnType<typeof sumNutrition> & { date: string }>;
    totals: ReturnType<typeof sumNutrition>;
    mealTypes: Array<{ type: string; count: number }>;
    mealTimes: Array<{
      type: string;
      count: number;
      averageMinutes: number | null;
      earliestMinutes: number | null;
      latestMinutes: number | null;
    }>;
  };
  onChangeMonth: (offset: number) => void;
}) {
  const averageCalories =
    insights.totals.calories / Math.max(insights.dayCount, 1);
  const maxCalories = Math.max(
    2000,
    ...insights.dailyTotals.map((day) => day.calories),
  );
  const totalMeals = insights.mealTypes.reduce(
    (total, item) => total + item.count,
    0,
  );

  return (
    <section className="insights-panel" aria-labelledby="insights-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">월간 인사이트</p>
          <h2 id="insights-title">
            {month.getFullYear()}년 {month.getMonth() + 1}월 기록
          </h2>
          <p className="date-kicker">
            기록한 날짜를 기준으로 하루 평균을 계산합니다.
          </p>
        </div>
        <div className="month-controls">
          <button
            className="icon-button"
            type="button"
            aria-label="이전 달"
            onClick={() => onChangeMonth(-1)}
          >
            ←
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="다음 달"
            onClick={() => onChangeMonth(1)}
          >
            →
          </button>
        </div>
      </div>

      {insights.dayCount === 0 ? (
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
            <p>총 {totalMeals}개의 음식 기록</p>
          </article>
          <article className="insight-card">
            <span className="insight-label">하루 평균 열량</span>
            <strong>{Math.round(averageCalories).toLocaleString()}<small>kcal</small></strong>
            <p>기록이 있는 날짜 기준</p>
          </article>
          <article className="insight-card trend-card">
            <div>
              <span className="insight-label">일별 섭취 열량</span>
              <p>막대에 날짜별 총 섭취량을 표시합니다.</p>
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
              <span className="insight-label">평균 식사 시간</span>
              <p>시간이 입력된 기록을 기준으로 식사 리듬을 보여줍니다.</p>
            </div>
            <div className="meal-time-list">
              {insights.mealTimes.map((item) => (
                <div className="meal-time-row" key={item.type}>
                  <span>{item.type}</span>
                  {item.averageMinutes === null ? (
                    <small>시간 기록 없음</small>
                  ) : (
                    <>
                      <div className="time-track" aria-hidden="true">
                        <span
                          style={{ left: `${(item.averageMinutes / 1440) * 100}%` }}
                        />
                      </div>
                      <strong>{formatMinutes(item.averageMinutes)}</strong>
                      <small>
                        {item.count}회 · {formatMinutes(item.earliestMinutes!)}–
                        {formatMinutes(item.latestMinutes!)}
                      </small>
                    </>
                  )}
                </div>
              ))}
            </div>
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
