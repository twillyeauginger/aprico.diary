import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type AppEnv = {
  DB?: D1Database;
};

export function getD1() {
  const database = (env as unknown as AppEnv).DB;
  if (!database) {
    throw new Error("식단 기록 데이터베이스가 아직 연결되지 않았습니다.");
  }
  return database;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (schemaReady) return schemaReady;
  const database = getD1();
  schemaReady = database
    .batch([
      database.prepare(`
        CREATE TABLE IF NOT EXISTS meal_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meal_date TEXT NOT NULL,
          meal_time TEXT,
          meal_type TEXT NOT NULL,
          food_name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_label TEXT NOT NULL,
          serving_amount REAL NOT NULL DEFAULT 1,
          serving_unit TEXT NOT NULL DEFAULT '인분',
          calories REAL NOT NULL DEFAULT 0,
          carbs REAL NOT NULL DEFAULT 0,
          protein REAL NOT NULL DEFAULT 0,
          fat REAL NOT NULL DEFAULT 0,
          sugar REAL NOT NULL DEFAULT 0,
          sodium REAL NOT NULL DEFAULT 0,
          fiber REAL NOT NULL DEFAULT 0,
          confidence REAL,
          photo_id TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS meal_entries_date_idx
        ON meal_entries (meal_date)
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS saved_foods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          serving_amount REAL NOT NULL DEFAULT 1,
          serving_unit TEXT NOT NULL DEFAULT '인분',
          calories REAL NOT NULL DEFAULT 0,
          carbs REAL NOT NULL DEFAULT 0,
          protein REAL NOT NULL DEFAULT 0,
          fat REAL NOT NULL DEFAULT 0,
          sugar REAL NOT NULL DEFAULT 0,
          sodium REAL NOT NULL DEFAULT 0,
          fiber REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS saved_foods_name_idx
        ON saved_foods (name)
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS photos (
          id TEXT PRIMARY KEY,
          object_key TEXT NOT NULL UNIQUE,
          content_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'uploaded',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS analysis_runs (
          id TEXT PRIMARY KEY,
          photo_id TEXT NOT NULL,
          status TEXT NOT NULL,
          model TEXT NOT NULL,
          result_json TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS analysis_runs_photo_idx
        ON analysis_runs (photo_id)
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS nutrition_goals (
          id INTEGER PRIMARY KEY,
          goals_json TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS calendar_day_types (
          day_date TEXT PRIMARY KEY,
          day_type TEXT NOT NULL DEFAULT 'default',
          is_complete INTEGER NOT NULL DEFAULT 0
        )
      `),
    ])
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null;
      throw error;
    });
  return schemaReady;
}
