import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mealEntries = sqliteTable(
  "meal_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mealDate: text("meal_date").notNull(),
    mealType: text("meal_type").notNull(),
    foodName: text("food_name").notNull(),
    sourceType: text("source_type").notNull(),
    sourceLabel: text("source_label").notNull(),
    servingAmount: real("serving_amount").notNull().default(1),
    servingUnit: text("serving_unit").notNull().default("인분"),
    calories: real("calories").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    protein: real("protein").notNull().default(0),
    fat: real("fat").notNull().default(0),
    sugar: real("sugar").notNull().default(0),
    sodium: real("sodium").notNull().default(0),
    fiber: real("fiber").notNull().default(0),
    confidence: real("confidence"),
    photoId: text("photo_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("meal_entries_date_idx").on(table.mealDate)],
);

export const savedFoods = sqliteTable(
  "saved_foods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    servingAmount: real("serving_amount").notNull().default(1),
    servingUnit: text("serving_unit").notNull().default("인분"),
    calories: real("calories").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    protein: real("protein").notNull().default(0),
    fat: real("fat").notNull().default(0),
    sugar: real("sugar").notNull().default(0),
    sodium: real("sodium").notNull().default(0),
    fiber: real("fiber").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("saved_foods_name_idx").on(table.name)],
);

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("uploaded"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const analysisRuns = sqliteTable(
  "analysis_runs",
  {
    id: text("id").primaryKey(),
    photoId: text("photo_id").notNull(),
    status: text("status").notNull(),
    model: text("model").notNull(),
    resultJson: text("result_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("analysis_runs_photo_idx").on(table.photoId)],
);
