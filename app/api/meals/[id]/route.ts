import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../../db";
import { mealEntries } from "../../../../db/schema";

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
