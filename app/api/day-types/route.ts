import type { DayType } from "../../nutrition-dashboard";
import { ensureSchema, getD1 } from "../../../db";

export async function GET(request: Request) {
  await ensureSchema();
  const month = new URL(request.url).searchParams.get("month") ?? "";
  const rows = await getD1()
    .prepare(
      "SELECT day_date, day_type, is_complete FROM calendar_day_types WHERE day_date LIKE ?",
    )
    .bind(`${month}%`)
    .all<{ day_date: string; day_type: DayType; is_complete: number }>();
  return Response.json({
    dayTypes: Object.fromEntries(rows.results.map((row) => [row.day_date, row.day_type])),
    completedDays: Object.fromEntries(
      rows.results.map((row) => [row.day_date, Boolean(row.is_complete)]),
    ),
  });
}

export async function PUT(request: Request) {
  await ensureSchema();
  const body = (await request.json()) as {
    date?: string;
    dayType?: DayType;
    isComplete?: boolean;
  };
  if (!body.date?.match(/^\d{4}-\d{2}-\d{2}$/) ||
      !["default", "exercise", "rest"].includes(body.dayType ?? "") ||
      typeof body.isComplete !== "boolean") {
    return Response.json({ error: "날짜 또는 날짜 유형이 올바르지 않습니다." }, { status: 400 });
  }
  await getD1()
    .prepare(
      `INSERT INTO calendar_day_types (day_date, day_type, is_complete) VALUES (?, ?, ?)
       ON CONFLICT(day_date) DO UPDATE SET
         day_type = excluded.day_type,
         is_complete = excluded.is_complete`,
    )
    .bind(body.date, body.dayType, body.isComplete ? 1 : 0)
    .run();
  return Response.json({ ok: true });
}
