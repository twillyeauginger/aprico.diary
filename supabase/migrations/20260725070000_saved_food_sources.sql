alter table public.saved_foods
  add column if not exists source_type text not null default 'manual'
  check (
    source_type in ('database', 'label', 'ai_estimate', 'manual', 'reference')
  );

alter table public.saved_foods
  add column if not exists source_label text not null default '직접 등록';

insert into public.saved_foods (
  user_id,
  name,
  source_type,
  source_label,
  serving_amount,
  serving_unit,
  calories,
  carbs,
  protein,
  fat,
  sugar,
  sodium,
  fiber
)
select
  recent.user_id,
  recent.food_name,
  recent.source_type,
  recent.source_label,
  recent.serving_amount,
  recent.serving_unit,
  recent.calories,
  recent.carbs,
  recent.protein,
  recent.fat,
  recent.sugar,
  recent.sodium,
  recent.fiber
from (
  select distinct on (
    meals.user_id,
    lower(trim(meals.food_name)),
    meals.source_type
  )
    meals.*
  from public.meals
  order by
    meals.user_id,
    lower(trim(meals.food_name)),
    meals.source_type,
    meals.created_at desc
) as recent
where not exists (
  select 1
  from public.saved_foods
  where saved_foods.user_id = recent.user_id
    and lower(trim(saved_foods.name)) = lower(trim(recent.food_name))
    and saved_foods.source_type = recent.source_type
);

create or replace function public.save_meal_food_to_database()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.saved_foods
    where saved_foods.user_id = new.user_id
      and lower(trim(saved_foods.name)) = lower(trim(new.food_name))
      and saved_foods.source_type = new.source_type
  ) then
    insert into public.saved_foods (
      user_id,
      name,
      source_type,
      source_label,
      serving_amount,
      serving_unit,
      calories,
      carbs,
      protein,
      fat,
      sugar,
      sodium,
      fiber
    )
    values (
      new.user_id,
      new.food_name,
      new.source_type,
      new.source_label,
      new.serving_amount,
      new.serving_unit,
      new.calories,
      new.carbs,
      new.protein,
      new.fat,
      new.sugar,
      new.sodium,
      new.fiber
    );
  end if;
  return new;
end;
$$;

drop trigger if exists save_meal_food_to_database on public.meals;

create trigger save_meal_food_to_database
after insert or update of food_name, source_type on public.meals
for each row
execute function public.save_meal_food_to_database();
