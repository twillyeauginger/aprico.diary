import { and, asc, gte, lt } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { mealEntries } from "../../../db/schema";

const sourceTypes = new Set([
  "database",
  "label",
  "ai_estimate",
  "manual",
  "reference",
]);

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("올바른 월을 선택해주세요.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const nextDate = new Date(year, monthNumber, 1);
  const end = `${nextDate.getFullYear()}-${String(
    nextDate.getMonth() + 1,
  ).padStart(2, "0")}-01`;
  return { start, end };
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const { start, end } = monthBounds(
      url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7),
    );
    const meals = await getDb()
      .select()
      .from(mealEntries)
      .where(
        and(
          gte(mealEntries.mealDate, start),
          lt(mealEntries.mealDate, end),
        ),
      )
      .orderBy(asc(mealEntries.mealDate), asc(mealEntries.createdAt));
    return Response.json({ meals });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "기록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const mealDate = String(body.mealDate ?? "");
    const foodName = String(body.foodName ?? "").trim();
    const sourceType = String(body.sourceType ?? "manual");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate)) {
      return Response.json({ error: "날짜를 확인해주세요." }, { status: 400 });
    }
    if (!foodName) {
      return Response.json({ error: "음식 이름을 입력해주세요." }, { status: 400 });
    }
    if (!sourceTypes.has(sourceType)) {
      return Response.json({ error: "알 수 없는 데이터 출처입니다." }, { status: 400 });
    }

    const [meal] = await getDb()
      .insert(mealEntries)
      .values({
        mealDate,
        mealType: String(body.mealType ?? "기타").slice(0, 20),
        foodName: foodName.slice(0, 120),
        sourceType,
        sourceLabel: String(body.sourceLabel ?? "직접 입력").slice(0, 80),
        servingAmount: asNumber(body.servingAmount, 1),
        servingUnit: String(body.servingUnit ?? "인분").slice(0, 20),
        calories: asNumber(body.calories),
        carbs: asNumber(body.carbs),
        protein: asNumber(body.protein),
        fat: asNumber(body.fat),
        sugar: asNumber(body.sugar),
        sodium: asNumber(body.sodium),
        fiber: asNumber(body.fiber),
        confidence:
          body.confidence === null || body.confidence === undefined
            ? null
            : Math.min(1, asNumber(body.confidence)),
        photoId: body.photoId ? String(body.photoId) : null,
      })
      .returning();

    return Response.json({ meal }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "기록을 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
