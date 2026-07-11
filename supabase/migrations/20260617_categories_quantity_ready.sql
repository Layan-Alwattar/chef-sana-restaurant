-- Chef Sana's Restaurant — categories, order quantity, and ready-notifications.
-- Apply this to the `chef-sana-restaurant` project (ref wktrdrdhvgnojojvghci).
-- Safe to re-run.

-- ===== Admin-defined categories (a meal can belong to several) =====
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_categories (
  meal_id bigint not null references public.meals(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  primary key (meal_id, category_id)
);
create index if not exists meal_categories_category_idx on public.meal_categories(category_id);

alter table public.categories enable row level security;
alter table public.meal_categories enable row level security;

drop policy if exists "categories public read" on public.categories;
drop policy if exists "categories admin insert" on public.categories;
drop policy if exists "categories admin update" on public.categories;
drop policy if exists "categories admin delete" on public.categories;
create policy "categories public read"  on public.categories for select using (true);
create policy "categories admin insert" on public.categories for insert with check (public.is_admin());
create policy "categories admin update" on public.categories for update using (public.is_admin()) with check (public.is_admin());
create policy "categories admin delete" on public.categories for delete using (public.is_admin());

drop policy if exists "meal_categories public read" on public.meal_categories;
drop policy if exists "meal_categories admin insert" on public.meal_categories;
drop policy if exists "meal_categories admin delete" on public.meal_categories;
create policy "meal_categories public read"  on public.meal_categories for select using (true);
create policy "meal_categories admin insert" on public.meal_categories for insert with check (public.is_admin());
create policy "meal_categories admin delete" on public.meal_categories for delete using (public.is_admin());

-- ===== Orders: quantity, customer email, private per-browser token =====
alter table public.orders
  add column if not exists quantity integer not null default 1,
  add column if not exists customer_email text,
  add column if not exists client_token uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_quantity_positive') then
    alter table public.orders add constraint orders_quantity_positive check (quantity >= 1);
  end if;
end $$;

-- Coins = meal points x quantity, computed server-side so the browser can't fake it.
create or replace function public.set_order_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
begin
  select coalesce(points, 0) into v_points from public.meals where id = NEW.meal_id;
  NEW.points := coalesce(v_points, 0) * greatest(coalesce(NEW.quantity, 1), 1);
  return NEW;
end;
$$;

drop trigger if exists orders_set_points on public.orders;
create trigger orders_set_points
  before insert on public.orders
  for each row execute function public.set_order_points();

-- ===== Realtime: push category changes to everyone's tabs =====
do $$
begin
  begin
    alter publication supabase_realtime add table public.categories;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.meal_categories;
  exception when duplicate_object then null;
  end;
end $$;
