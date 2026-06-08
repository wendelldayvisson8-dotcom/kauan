
-- ===== Profiles =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ===== Roles =====
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- ===== Wallets =====
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  locked_cents bigint not null default 0 check (locked_cents >= 0),
  total_deposited_cents bigint not null default 0,
  total_withdrawn_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','bet','payout','loss','withdraw_hold','withdraw_paid','withdraw_refund','adjustment')),
  amount_cents bigint not null,
  balance_after_cents bigint not null,
  ref_table text,
  ref_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
create index idx_wt_user on public.wallet_transactions(user_id, created_at desc);

-- ===== Game rounds =====
create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_cents bigint not null check (bet_cents > 0),
  rows_cleared int not null default 0,
  current_multiplier numeric(10,4) not null default 1,
  status text not null default 'active' check (status in ('active','cashed','lost')),
  payout_cents bigint not null default 0,
  server_seed text not null,
  steps jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.game_rounds enable row level security;
create index idx_rounds_user on public.game_rounds(user_id, started_at desc);
create unique index uniq_one_active_round on public.game_rounds(user_id) where status = 'active';

-- ===== Withdrawals =====
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  pix_key text not null,
  pix_key_type text not null check (pix_key_type in ('cpf','email','phone','random')),
  status text not null default 'pending' check (status in ('pending','approved','paid','denied','refunded')),
  admin_note text,
  provider text,
  provider_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.withdrawals enable row level security;
create index idx_with_user on public.withdrawals(user_id, created_at desc);
create index idx_with_status on public.withdrawals(status, created_at desc);

-- ===== Deposits: link to user =====
alter table public.deposits add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_deposits_user on public.deposits(user_id, created_at desc);

-- Remove old public-read; add proper policies
drop policy if exists deposits_public_read on public.deposits;

-- ===== updated_at triggers =====
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();
create trigger trg_wallets_updated before update on public.wallets
  for each row execute function public.update_updated_at_column();
create trigger trg_withdrawals_updated before update on public.withdrawals
  for each row execute function public.update_updated_at_column();

-- ===== Auto-create profile + wallet + default role on signup =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));

  insert into public.wallets (user_id) values (new.id);

  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS policies =====
-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_select_admin" on public.profiles for select using (public.has_role(auth.uid(),'admin'));
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);

-- user_roles
create policy "roles_select_own" on public.user_roles for select using (auth.uid() = user_id);
create policy "roles_select_admin" on public.user_roles for select using (public.has_role(auth.uid(),'admin'));

-- wallets
create policy "wallets_select_own" on public.wallets for select using (auth.uid() = user_id);
create policy "wallets_select_admin" on public.wallets for select using (public.has_role(auth.uid(),'admin'));

-- wallet_transactions
create policy "wt_select_own" on public.wallet_transactions for select using (auth.uid() = user_id);
create policy "wt_select_admin" on public.wallet_transactions for select using (public.has_role(auth.uid(),'admin'));

-- game_rounds
create policy "rounds_select_own" on public.game_rounds for select using (auth.uid() = user_id);
create policy "rounds_select_admin" on public.game_rounds for select using (public.has_role(auth.uid(),'admin'));

-- withdrawals
create policy "with_select_own" on public.withdrawals for select using (auth.uid() = user_id);
create policy "with_select_admin" on public.withdrawals for select using (public.has_role(auth.uid(),'admin'));
create policy "with_update_admin" on public.withdrawals for update using (public.has_role(auth.uid(),'admin'));

-- deposits
create policy "dep_select_own" on public.deposits for select using (auth.uid() = user_id);
create policy "dep_select_admin" on public.deposits for select using (public.has_role(auth.uid(),'admin'));
