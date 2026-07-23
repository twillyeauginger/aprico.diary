create extension if not exists pgcrypto;

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_date date not null,
  meal_type text not null,
  food_name text not null,
  source_type text not null check (
    source_type in ('database', 'label', 'ai_estimate', 'manual', 'reference')
  ),
  source_label text not null,
  serving_amount numeric(10, 2) not null default 1 check (serving_amount >= 0),
  serving_unit text not null default '인분',
  calories numeric(10, 2) not null default 0 check (calories >= 0),
  carbs numeric(10, 2) not null default 0 check (carbs >= 0),
  protein numeric(10, 2) not null default 0 check (protein >= 0),
  fat numeric(10, 2) not null default 0 check (fat >= 0),
  sugar numeric(10, 2) not null default 0 check (sugar >= 0),
  sodium numeric(10, 2) not null default 0 check (sodium >= 0),
  fiber numeric(10, 2) not null default 0 check (fiber >= 0),
  confidence numeric(4, 3) check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  photo_path text,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_date_idx
  on public.meals (user_id, meal_date);

alter table public.meals enable row level security;

create policy "Users can read their own meals"
  on public.meals
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own meals"
  on public.meals
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own meals"
  on public.meals
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own meals"
  on public.meals
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'meal-photos',
  'meal-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own meal photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can read their own meal photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own meal photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
