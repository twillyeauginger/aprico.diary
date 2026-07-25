alter table public.calendar_day_types
  add column if not exists is_complete boolean not null default false;
