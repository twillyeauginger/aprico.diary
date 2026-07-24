CREATE TABLE `saved_foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`serving_amount` real DEFAULT 1 NOT NULL,
	`serving_unit` text DEFAULT '인분' NOT NULL,
	`calories` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`sugar` real DEFAULT 0 NOT NULL,
	`sodium` real DEFAULT 0 NOT NULL,
	`fiber` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_foods_name_idx` ON `saved_foods` (`name`);