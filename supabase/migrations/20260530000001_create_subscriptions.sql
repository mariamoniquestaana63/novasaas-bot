create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text,
  status                 text not null default 'incomplete',
  plan                   text not null default 'starter',
  current_period_end     timestamptz,
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

-- RLS: users can only read their own row; writes go through service key only
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);
