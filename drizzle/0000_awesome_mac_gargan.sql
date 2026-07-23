CREATE TABLE `analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`status` text NOT NULL,
	`model` text NOT NULL,
	`result_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meal_date` text NOT NULL,
	`meal_type` text NOT NULL,
	`food_name` text NOT NULL,
	`source_type` text NOT NULL,
	`source_label` text NOT NULL,
	`serving_amount` real DEFAULT 1 NOT NULL,
	`serving_unit` text DEFAULT '인분' NOT NULL,
	`calories` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`sugar` real DEFAULT 0 NOT NULL,
	`sodium` real DEFAULT 0 NOT NULL,
	`fiber` real DEFAULT 0 NOT NULL,
	`confidence` real,
	`photo_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_object_key_unique` ON `photos` (`object_key`);