create table if not exists public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  serving_amount numeric(10, 2) not null default 1 check (serving_amount > 0),
  serving_unit text not null default '인분',
  calories numeric(10, 2) not null default 0 check (calories >= 0),
  carbs numeric(10, 2) not null default 0 check (carbs >= 0),
  protein numeric(10, 2) not null default 0 check (protein >= 0),
  fat numeric(10, 2) not null default 0 check (fat >= 0),
  sugar numeric(10, 2) not null default 0 check (sugar >= 0),
  sodium numeric(10, 2) not null default 0 check (sodium >= 0),
  fiber numeric(10, 2) not null default 0 check (fiber >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_foods_user_name_idx
  on public.saved_foods (user_id, name);

alter table public.saved_foods enable row level security;

create policy "Users can read their own saved foods"
  on public.saved_foods for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own saved foods"
  on public.saved_foods for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved foods"
  on public.saved_foods for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved foods"
  on public.saved_foods for delete to authenticated
  using ((select auth.uid()) = user_id);
