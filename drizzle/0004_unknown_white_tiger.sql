CREATE TABLE `nutrition_goals` (
	`id` integer PRIMARY KEY NOT NULL,
	`goals_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
