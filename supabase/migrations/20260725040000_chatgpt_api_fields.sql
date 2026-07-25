alter table public.saved_foods
  add column if not exists weight_grams numeric,
  add column if not exists source text,
  add column if not exists notes text;

alter table public.meals
  add column if not exists weight_grams numeric,
  add column if not exists notes text;
