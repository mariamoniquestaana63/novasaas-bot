-- Run this in your Supabase project: SQL Editor → New query → paste + Run

-- Subscriptions table
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  paymongo_payment_id    text,
  status                 text not null default 'incomplete',
  plan                   text not null default 'starter',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint subscriptions_user_id_key unique (user_id)
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

-- RLS: users read their own row; writes go through service key only
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Waitlist table
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
-- No select policy — only service key can read waitlist entries
