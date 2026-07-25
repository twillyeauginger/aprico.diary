import { DEFAULT_GOALS, type NutritionGoals } from "../../nutrition-dashboard";
import { ensureSchema, getD1 } from "../../../db";

function clean(body: Record<string, unknown>): NutritionGoals {
  return Object.fromEntries(
    Object.entries(DEFAULT_GOALS).map(([key, fallback]) => [
      key,
      key === "goalType"
        ? String(body[key] ?? fallback).trim().slice(0, 120)
        : Math.max(1, Number(body[key]) || Number(fallback)),
    ]),
  ) as NutritionGoals;
}

export async function GET() {
  await ensureSchema();
  const row = await getD1()
    .prepare("SELECT goals_json FROM nutrition_goals WHERE id = 1")
    .first<{ goals_json: string }>();
  return Response.json({
    goals: row ? { ...DEFAULT_GOALS, ...JSON.parse(row.goals_json) } : DEFAULT_GOALS,
  });
}

export async function PUT(request: Request) {
  await ensureSchema();
  const goals = clean((await request.json()) as Record<string, unknown>);
  await getD1()
    .prepare(
      `INSERT INTO nutrition_goals (id, goals_json, updated_at)
       VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET goals_json = excluded.goals_json,
       updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(JSON.stringify(goals))
    .run();
  return Response.json({ goals });
}
