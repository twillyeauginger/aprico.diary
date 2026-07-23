"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

type SourceType = "database" | "label" | "ai_estimate" | "manual" | "reference";

type MealRecord = {
  id: number | string;
  mealDate: string;
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

type FoodResult = {
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

type AnalysisItem = {
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

type AnalysisResult = {
  imageType: "meal" | "nutrition_label" | "package" | "unknown";
  summary: string;
  items: AnalysisItem[];
  needsUserConfirmation: boolean;
  warnings: string[];
  photoId: string;
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
  return {
    mealDate: selectedDate,
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

export function NutritionDashboard() {
  const todayRef = useRef(new Date());
  const today = todayRef.current;
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "photo" | "manual">(
    "search",
  );
  const [manual, setManual] = useState(emptyManual(selectedDate));
  const [query, setQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/meals?month=${monthKey(viewMonth)}`);
        if (!response.ok) throw new Error("기록을 불러오지 못했습니다.");
        const body = (await response.json()) as { meals: MealRecord[] };
        if (cancelled) return;
        if (body.meals.length === 0) {
          setMeals(demoMeals(today));
          setIsDemo(true);
        } else {
          setMeals(body.meals);
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
  }, [viewMonth, today]);

  useEffect(() => {
    setManual((current) => ({ ...current, mealDate: selectedDate }));
  }, [selectedDate]);

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
    () => meals.filter((meal) => meal.mealDate === selectedDate),
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

  function showToast(message: string) {
    setToast(message);
  }

  function openAdd(tab: "search" | "photo" | "manual" = "search") {
    setActiveTab(tab);
    setModalOpen(true);
    setManual(emptyManual(selectedDate));
  }

  function closeModal() {
    setModalOpen(false);
    setAnalysis(null);
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
  }

  async function saveMeal(
    payload: Omit<MealRecord, "id">,
    successMessage = "기록에 추가했어요.",
  ) {
    const response = await fetch("/api/meals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "저장하지 못했습니다.");
    }
    const body = (await response.json()) as { meal: MealRecord };
    setMeals((current) =>
      isDemo ? [body.meal] : [...current.filter((meal) => !meal.demo), body.meal],
    );
    setIsDemo(false);
    showToast(successMessage);
    return body.meal;
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manual.foodName.trim()) return;
    try {
      await saveMeal({
        mealDate: manual.mealDate,
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

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(query.trim())}`);
      const body = (await response.json()) as { foods?: FoodResult[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "검색하지 못했습니다.");
      setFoodResults(body.foods ?? []);
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

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
  }

  async function analyzePhoto() {
    if (!photoFile) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const uploadData = new FormData();
      uploadData.append("file", photoFile);
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
      if (!response.ok) throw new Error(body.error ?? "사진을 분석하지 못했습니다.");
      setAnalysis(body);
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
      for (const item of analysis.items) {
        await saveMeal(
          {
            mealDate: selectedDate,
            mealType: "점심",
            foodName: item.name,
            sourceType: item.sourceType,
            sourceLabel:
              item.sourceType === "label"
                ? "영양정보 사진 표시값"
                : "GPT 사진 추정",
            servingAmount: item.portionGrams ?? 1,
            servingUnit: item.portionGrams ? "g" : item.portionText || "인분",
            calories: item.nutrition.calories,
            carbs: item.nutrition.carbs,
            protein: item.nutrition.protein,
            fat: item.nutrition.fat,
            sugar: item.nutrition.sugar,
            sodium: item.nutrition.sodium,
            fiber: item.nutrition.fiber,
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
      const response = await fetch(`/api/meals/${meal.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("삭제하지 못했습니다.");
      setMeals((current) => current.filter((item) => item.id !== meal.id));
      showToast("기록을 삭제했어요.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "삭제하지 못했습니다.");
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
        <div className="brand" aria-label="한끼록 홈">
          <span className="brand-mark">한</span>
          한끼록
        </div>
        <nav className="top-nav" aria-label="주요 메뉴">
          <button className="active" type="button">
            캘린더
          </button>
          <button type="button" onClick={() => openAdd()}>
            오늘 기록
          </button>
          <button type="button" onClick={() => showToast("인사이트는 다음 단계에서 열려요.")}>
            인사이트
          </button>
        </nav>
        <div className="profile-dot" aria-label="개인 기록">
          나
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">My nutrition journal</p>
          <h1>
            먹은 것을 가볍게,
            <br />
            영양은 분명하게.
          </h1>
        </div>
        <div>
          <p className="hero-copy">
            사진 한 장이나 제품명만으로 기록을 시작하세요. 확인한 영양정보와
            추정값을 구분해 보여드려요.
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

      <section className="summary-grid" aria-label="선택한 날짜 영양 요약">
        <SummaryCard
          label="오늘의 에너지"
          value={Math.round(selectedTotals.calories)}
          unit="kcal"
          goal={2000}
          primary
        />
        <SummaryCard
          label="탄수화물"
          value={Math.round(selectedTotals.carbs)}
          unit="g"
          goal={250}
        />
        <SummaryCard
          label="단백질"
          value={Math.round(selectedTotals.protein)}
          unit="g"
          goal={100}
        />
        <SummaryCard
          label="지방"
          value={Math.round(selectedTotals.fat)}
          unit="g"
          goal={65}
        />
      </section>

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
                      <span>·</span>
                      <span>
                        {meal.servingAmount}
                        {meal.servingUnit}
                      </span>
                      <span
                        className={`source-badge ${sourceClass(meal.sourceType)}`}
                      >
                        {SOURCE_LABELS[meal.sourceType]}
                      </span>
                    </div>
                  </div>
                  <div className="meal-calories">
                    <strong>{Math.round(meal.calories)}</strong>
                    <span>kcal</span>
                  </div>
                  <button
                    className="delete-meal"
                    type="button"
                    aria-label={`${meal.foodName} 삭제`}
                    onClick={() => deleteMeal(meal)}
                  >
                    ×
                  </button>
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
                            <div>
                              <h4>{item.name}</h4>
                              <p>
                                {item.portionText} ·{" "}
                                {Math.round(item.nutrition.calories)} kcal · 단백질{" "}
                                {Math.round(item.nutrition.protein)}g
                              </p>
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
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
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
