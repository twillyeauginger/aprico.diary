update public.calendar_day_types
set day_type = 'default',
    updated_at = now()
where day_type = 'rest';

alter table public.calendar_day_types
  drop constraint if exists calendar_day_types_day_type_check;

alter table public.calendar_day_types
  add constraint calendar_day_types_day_type_check
  check (day_type in ('default', 'exercise'));
