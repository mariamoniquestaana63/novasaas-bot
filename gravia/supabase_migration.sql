-- ── Gravia Supabase Migration ─────────────────────────────────────────────────
-- Run in: Supabase dashboard → SQL Editor → New Query

-- ── 1. Profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile"  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. Subscriptions ──────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text,
  status                 text not null default 'trialing',
  plan                   text not null default 'free',
  billing_interval       text not null default 'month',  -- 'month' | 'year'
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint subscriptions_user_id_key unique (user_id)
);

alter table public.subscriptions enable row level security;
create policy "Users can view own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

-- ── 3. Waitlist ───────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
create policy "Anyone can join waitlist"
  on public.waitlist for insert with check (true);

-- ── 4. updated_at trigger (shared) ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at     before update on public.profiles     for each row execute procedure public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute procedure public.set_updated_at();
