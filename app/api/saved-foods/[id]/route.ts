import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../../db";
import { savedFoods } from "../../../../db/schema";

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const { id } = await context.params;
    const numericId = Number(id);
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!Number.isInteger(numericId) || numericId <= 0 || !name) {
      return Response.json({ error: "음식 정보를 확인해주세요." }, { status: 400 });
    }
    const [food] = await getDb()
      .update(savedFoods)
      .set({
        name: name.slice(0, 120),
        servingAmount: asNumber(body.servingAmount, 1),
        servingUnit: String(body.servingUnit ?? "인분").slice(0, 20),
        calories: asNumber(body.calories),
        carbs: asNumber(body.carbs),
        protein: asNumber(body.protein),
        fat: asNumber(body.fat),
        sugar: asNumber(body.sugar),
        sodium: asNumber(body.sodium),
        fiber: asNumber(body.fiber),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(savedFoods.id, numericId))
      .returning();
    if (!food) {
      return Response.json({ error: "음식을 찾지 못했습니다." }, { status: 404 });
    }
    return Response.json({ food });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "수정하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return Response.json({ error: "음식 번호를 확인해주세요." }, { status: 400 });
  }
  await getDb().delete(savedFoods).where(eq(savedFoods.id, numericId));
  return new Response(null, { status: 204 });
}
