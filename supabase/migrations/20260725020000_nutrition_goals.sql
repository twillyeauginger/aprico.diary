create table if not exists public.nutrition_goals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  goal_type text not null default '체중 유지 및 완만한 체지방 감량',
  calories numeric not null default 1650,
  carbs numeric not null default 215,
  protein numeric not null default 85,
  fat numeric not null default 50,
  exercise_calories_min numeric not null default 1700,
  exercise_calories_max numeric not null default 1750,
  exercise_carbs_min numeric not null default 225,
  exercise_carbs_max numeric not null default 240,
  exercise_protein_min numeric not null default 85,
  exercise_protein_max numeric not null default 90,
  exercise_fat numeric not null default 50,
  rest_calories numeric not null default 1600,
  rest_carbs_min numeric not null default 195,
  rest_carbs_max numeric not null default 205,
  rest_protein numeric not null default 85,
  rest_fat numeric not null default 50,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;

create policy "Users can read their own nutrition goals"
  on public.nutrition_goals for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own nutrition goals"
  on public.nutrition_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own nutrition goals"
  on public.nutrition_goals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
