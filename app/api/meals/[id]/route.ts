import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../../db";
import { mealEntries } from "../../../../db/schema";

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
    const mealDate = String(body.mealDate ?? "");
    const foodName = String(body.foodName ?? "").trim();

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return Response.json({ error: "기록 번호를 확인해주세요." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate)) {
      return Response.json({ error: "날짜를 확인해주세요." }, { status: 400 });
    }
    if (!foodName) {
      return Response.json({ error: "음식 이름을 입력해주세요." }, { status: 400 });
    }

    const [meal] = await getDb()
      .update(mealEntries)
      .set({
        mealDate,
        mealTime: String(body.mealTime ?? "").slice(0, 5) || null,
        mealType: String(body.mealType ?? "기타").slice(0, 20),
        foodName: foodName.slice(0, 120),
        sourceType: "manual",
        sourceLabel: "사용자 수정",
        servingAmount: asNumber(body.servingAmount, 1),
        servingUnit: String(body.servingUnit ?? "인분").slice(0, 20),
        calories: asNumber(body.calories),
        carbs: asNumber(body.carbs),
        protein: asNumber(body.protein),
        fat: asNumber(body.fat),
        sugar: asNumber(body.sugar),
        sodium: asNumber(body.sodium),
        fiber: asNumber(body.fiber),
        confidence: null,
        photoId: body.photoId ? String(body.photoId).slice(0, 500) : null,
      })
      .where(eq(mealEntries.id, numericId))
      .returning();

    if (!meal) {
      return Response.json(
        { error: "수정할 음식 기록을 찾지 못했습니다." },
        { status: 404 },
      );
    }
    return Response.json({ meal });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "기록을 수정하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return Response.json({ error: "기록 번호를 확인해주세요." }, { status: 400 });
    }
    await getDb().delete(mealEntries).where(eq(mealEntries.id, numericId));
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "기록을 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
