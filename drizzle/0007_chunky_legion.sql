ALTER TABLE `saved_foods` ADD `source_type` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_foods` ADD `source_label` text DEFAULT '직접 등록' NOT NULL;--> statement-breakpoint
INSERT INTO `saved_foods` (
	`name`,
	`source_type`,
	`source_label`,
	`serving_amount`,
	`serving_unit`,
	`calories`,
	`carbs`,
	`protein`,
	`fat`,
	`sugar`,
	`sodium`,
	`fiber`
)
SELECT
	meal.`food_name`,
	meal.`source_type`,
	meal.`source_label`,
	meal.`serving_amount`,
	meal.`serving_unit`,
	meal.`calories`,
	meal.`carbs`,
	meal.`protein`,
	meal.`fat`,
	meal.`sugar`,
	meal.`sodium`,
	meal.`fiber`
FROM `meal_entries` AS meal
WHERE meal.`id` = (
	SELECT MAX(recent.`id`)
	FROM `meal_entries` AS recent
	WHERE lower(trim(recent.`food_name`)) = lower(trim(meal.`food_name`))
		AND recent.`source_type` = meal.`source_type`
)
AND NOT EXISTS (
	SELECT 1
	FROM `saved_foods`
	WHERE lower(trim(`saved_foods`.`name`)) = lower(trim(meal.`food_name`))
		AND `saved_foods`.`source_type` = meal.`source_type`
);--> statement-breakpoint
CREATE TRIGGER `save_meal_food_to_database_insert`
AFTER INSERT ON `meal_entries`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM `saved_foods`
	WHERE lower(trim(`saved_foods`.`name`)) = lower(trim(NEW.`food_name`))
		AND `saved_foods`.`source_type` = NEW.`source_type`
)
BEGIN
	INSERT INTO `saved_foods` (
		`name`,
		`source_type`,
		`source_label`,
		`serving_amount`,
		`serving_unit`,
		`calories`,
		`carbs`,
		`protein`,
		`fat`,
		`sugar`,
		`sodium`,
		`fiber`
	)
	VALUES (
		NEW.`food_name`,
		NEW.`source_type`,
		NEW.`source_label`,
		NEW.`serving_amount`,
		NEW.`serving_unit`,
		NEW.`calories`,
		NEW.`carbs`,
		NEW.`protein`,
		NEW.`fat`,
		NEW.`sugar`,
		NEW.`sodium`,
		NEW.`fiber`
	);
END;--> statement-breakpoint
CREATE TRIGGER `save_meal_food_to_database_update`
AFTER UPDATE OF `food_name`, `source_type` ON `meal_entries`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM `saved_foods`
	WHERE lower(trim(`saved_foods`.`name`)) = lower(trim(NEW.`food_name`))
		AND `saved_foods`.`source_type` = NEW.`source_type`
)
BEGIN
	INSERT INTO `saved_foods` (
		`name`,
		`source_type`,
		`source_label`,
		`serving_amount`,
		`serving_unit`,
		`calories`,
		`carbs`,
		`protein`,
		`fat`,
		`sugar`,
		`sodium`,
		`fiber`
	)
	VALUES (
		NEW.`food_name`,
		NEW.`source_type`,
		NEW.`source_label`,
		NEW.`serving_amount`,
		NEW.`serving_unit`,
		NEW.`calories`,
		NEW.`carbs`,
		NEW.`protein`,
		NEW.`fat`,
		NEW.`sugar`,
		NEW.`sodium`,
		NEW.`fiber`
	);
END;
