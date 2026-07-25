import { asc } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { savedFoods } from "../../../db/schema";

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

function values(body: Record<string, unknown>) {
  const requestedSourceType = String(body.sourceType ?? "manual");
  return {
    name: String(body.name ?? "").trim().slice(0, 120),
    sourceType: sourceTypes.has(requestedSourceType)
      ? requestedSourceType
      : "manual",
    sourceLabel: String(body.sourceLabel ?? "직접 등록").slice(0, 80),
    servingAmount: asNumber(body.servingAmount, 1),
    servingUnit: String(body.servingUnit ?? "인분").slice(0, 20),
    calories: asNumber(body.calories),
    carbs: asNumber(body.carbs),
    protein: asNumber(body.protein),
    fat: asNumber(body.fat),
    sugar: asNumber(body.sugar),
    sodium: asNumber(body.sodium),
    fiber: asNumber(body.fiber),
  };
}

export async function GET() {
  await ensureSchema();
  const foods = await getDb()
    .select()
    .from(savedFoods)
    .orderBy(asc(savedFoods.name));
  return Response.json({ foods });
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = values(
      (await request.json()) as Record<string, unknown>,
    );
    if (!payload.name) {
      return Response.json({ error: "음식 이름을 입력해주세요." }, { status: 400 });
    }
    const [food] = await getDb()
      .insert(savedFoods)
      .values(payload)
      .returning();
    return Response.json({ food }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
