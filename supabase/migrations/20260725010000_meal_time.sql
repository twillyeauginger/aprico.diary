alter table public.meals
  add column if not exists meal_time time;
