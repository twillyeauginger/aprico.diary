create table if not exists public.calendar_day_types (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_date date not null,
  day_type text not null default 'default'
    check (day_type in ('default', 'exercise', 'rest')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_date)
);

alter table public.calendar_day_types enable row level security;

create policy "Users can read their own calendar day types"
  on public.calendar_day_types for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own calendar day types"
  on public.calendar_day_types for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own calendar day types"
  on public.calendar_day_types for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
