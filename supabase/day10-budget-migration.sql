-- Day 10: budget features + recipe meal types.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query →
-- paste → Run). Safe to re-run: every statement checks before creating.

-- 1. Your own ingredient prices. One row per ingredient name you've
--    corrected; anything without a row falls back to the starter prices in
--    src/utils/defaultPrices.js. Same shape of idea as ingredient_aisles
--    (Day 9): keyed by lowercase ingredient name, per user.
create table if not exists ingredient_prices (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ingredient_name text not null check (ingredient_name = lower(ingredient_name)),
  pack_price numeric(8, 2) not null check (pack_price >= 0),
  pack_size numeric not null check (pack_size > 0),
  pack_unit text not null,
  -- grams (or ml) in one item, so "2 onions" can be costed against a price per kg
  each_amount numeric check (each_amount > 0),
  -- cupboard staple: costed per recipe, left out of the weekly shop total
  is_pantry boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, ingredient_name)
);

alter table ingredient_prices enable row level security;

drop policy if exists "Users manage own ingredient prices" on ingredient_prices;
create policy "Users manage own ingredient prices"
  on ingredient_prices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Which meals a recipe suits (breakfast / lunch / dinner). Empty = any,
--    so every existing recipe keeps working without being re-saved. Used by
--    the meal plan generator so it doesn't put a curry in a breakfast slot.
alter table recipes
  add column if not exists meal_types text[] not null default '{}';
