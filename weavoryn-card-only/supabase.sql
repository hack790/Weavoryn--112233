-- Run this in Supabase SQL Editor. Safe to re-run on an existing orders table.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  customer jsonb not null,
  items jsonb not null,
  subtotal numeric not null,
  discount numeric not null default 0,
  shipping numeric not null default 0,
  total numeric not null,
  currency text not null default 'USD',
  payment_provider text,
  payment_reference text,
  status text not null default 'pending',
  paid boolean not null default false,
  refunded numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists currency text not null default 'USD';
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid boolean not null default false;
alter table public.orders add column if not exists refunded numeric not null default 0;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','processing','shipped','cancelled','refunded','failed'));
alter table public.orders alter column status set default 'pending';

create unique index if not exists orders_payment_reference_unique
  on public.orders(payment_reference) where payment_reference is not null;

alter table public.orders enable row level security;
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders for select using (auth.uid() = user_id);
