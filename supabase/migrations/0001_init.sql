create extension if not exists "pgcrypto";

create type public.app_role as enum ('user', 'merchant', 'admin');
create type public.kyc_status as enum ('pending', 'verified', 'rejected');
create type public.wallet_transaction_type as enum ('top_up', 'session_debit', 'refund', 'adjustment');
create type public.transaction_status as enum ('pending', 'success', 'failed');
create type public.business_type as enum ('gym', 'ev_charger', 'coworking', 'parking', 'lab', 'other');
create type public.geofence_type as enum ('circle', 'polygon');
create type public.billing_unit as enum ('per_second', 'per_minute', 'per_hour');
create type public.session_status as enum ('enter_detected', 'active', 'exit_detected', 'closed', 'disputed');
create type public.session_event_type as enum ('entered', 'billing_started', 'billing_updated', 'exited', 'stream_paused', 'stream_resumed', 'closed', 'error');
create type public.settlement_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.trigger_mode as enum ('geofence', 'qr', 'self_checkout');
create type public.qr_code_type as enum ('entry', 'exit');
create type public.operator_payout_status as enum ('accrued', 'transferred');

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'user'::public.app_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'admin'::public.app_role;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.app_role not null default 'user',
  kyc_status public.kyc_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance_crypto numeric(24, 8) not null default 0,
  balance_inr_equivalent numeric(24, 2) not null default 0,
  locked_balance numeric(24, 8) not null default 0,
  currency_code text not null default 'USDC',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type public.wallet_transaction_type not null,
  inr_amount numeric(24, 2) not null default 0,
  crypto_amount numeric(24, 8) not null default 0,
  exchange_rate numeric(24, 8) not null default 0,
  rate_locked_at timestamptz,
  razorpay_payment_id text,
  status public.transaction_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.merchants (
  id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null,
  business_type public.business_type not null,
  gstin text,
  pan_number text,
  bank_account_number text,
  bank_ifsc text,
  bank_account_name text,
  upi_id text,
  razorpay_contact_id text,
  razorpay_fund_account_id text,
  settlement_status public.settlement_status not null default 'pending',
  qr_secret text not null default encode(gen_random_bytes(32), 'hex'),
  onboarded_at timestamptz not null default timezone('utc', now())
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  description text,
  category public.business_type not null default 'other',
  address text not null,
  city text not null,
  lat numeric(10, 7) not null,
  lng numeric(10, 7) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.geofences (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  type public.geofence_type not null,
  center_lat numeric(10, 7),
  center_lng numeric(10, 7),
  radius_meters numeric(12, 2),
  polygon_coordinates jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  billing_unit public.billing_unit not null,
  rate_crypto numeric(24, 8) not null,
  rate_inr_equivalent numeric(24, 2) not null,
  base_fee_inr numeric(24, 2) not null default 0,
  minimum_charge_inr numeric(24, 2) not null default 0,
  maximum_cap_inr numeric(24, 2),
  grace_period_seconds integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  batch_date date not null,
  total_sessions integer not null default 0,
  gross_inr numeric(24, 2) not null default 0,
  platform_fee_inr numeric(24, 2) not null default 0,
  net_inr numeric(24, 2) not null default 0,
  status public.settlement_status not null default 'pending',
  razorpay_payout_id text,
  initiated_at timestamptz,
  completed_at timestamptz
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  pricing_plan_id uuid not null references public.pricing_plans(id) on delete restrict,
  status public.session_status not null default 'enter_detected',
  trigger_mode public.trigger_mode not null default 'geofence',
  qr_nonce_used text,
  entry_lat numeric(10, 7),
  entry_lng numeric(10, 7),
  exit_lat numeric(10, 7),
  exit_lng numeric(10, 7),
  entry_time timestamptz not null default timezone('utc', now()),
  exit_time timestamptz,
  duration_seconds integer not null default 0,
  locked_rate numeric(24, 8),
  crypto_charged numeric(24, 8) not null default 0,
  inr_equivalent numeric(24, 2) not null default 0,
  platform_fee_inr numeric(24, 2) not null default 0,
  platform_fee_rate numeric(12, 6) not null default 0.005,
  merchant_payout_inr numeric(24, 2) not null default 0,
  superfluid_stream_id text,
  settlement_batch_id uuid references public.settlement_batches(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index sessions_unique_active_per_user_venue
on public.sessions (user_id, venue_id)
where status in ('enter_detected', 'active', 'exit_detected');

create table public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_type public.session_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.tax_records (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  financial_year text not null,
  total_revenue_inr numeric(24, 2) not null default 0,
  platform_fees_paid numeric(24, 2) not null default 0,
  tds_deducted numeric(24, 2) not null default 0,
  gst_applicable boolean not null default false,
  gst_amount numeric(24, 2) not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.venue_qr_codes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  type public.qr_code_type not null,
  nonce text not null unique,
  signature text not null,
  expires_at timestamptz not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.operator_ledger (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  gross_inr numeric(24, 2) not null,
  fee_rate numeric(12, 6) not null,
  fee_inr numeric(24, 2) not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  settlement_batch_id uuid references public.settlement_batches(id) on delete set null
);

create table public.operator_payouts (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null,
  total_fee_collected_inr numeric(24, 2) not null default 0,
  session_count integer not null default 0,
  status public.operator_payout_status not null default 'accrued',
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_wallet_transactions_wallet_id_created_at on public.wallet_transactions(wallet_id, created_at desc);
create index idx_venues_merchant_id on public.venues(merchant_id);
create index idx_pricing_plans_venue_id on public.pricing_plans(venue_id);
create index idx_sessions_user_status on public.sessions(user_id, status);
create index idx_sessions_venue_status on public.sessions(venue_id, status);
create index idx_sessions_settlement_batch_id on public.sessions(settlement_batch_id);
create index idx_session_events_session_id on public.session_events(session_id, created_at desc);
create index idx_settlement_batches_merchant_date on public.settlement_batches(merchant_id, batch_date desc);
create index idx_notifications_user_id on public.notifications(user_id, created_at desc);
create index idx_operator_ledger_recorded_at on public.operator_ledger(recorded_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, kyc_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'user',
    'pending'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.notifications (user_id, type, title, body)
  values (
    new.id,
    'welcome',
    'Welcome to Detrix',
    'Your account and custodial wallet are ready.'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function public.set_updated_at();
create trigger venues_set_updated_at before update on public.venues
for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.merchants enable row level security;
alter table public.venues enable row level security;
alter table public.geofences enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.sessions enable row level security;
alter table public.session_events enable row level security;
alter table public.settlement_batches enable row level security;
alter table public.tax_records enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.venue_qr_codes enable row level security;
alter table public.operator_ledger enable row level security;
alter table public.operator_payouts enable row level security;

create policy "profiles own or admin select" on public.profiles
for select using (id = auth.uid() or public.is_admin());
create policy "profiles own update" on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "wallets own or admin" on public.wallets
for select using (user_id = auth.uid() or public.is_admin());
create policy "wallets own update or admin" on public.wallets
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "wallet tx own or admin" on public.wallet_transactions
for select using (
  exists (
    select 1 from public.wallets w
    where w.id = wallet_id and (w.user_id = auth.uid() or public.is_admin())
  )
);

create policy "merchants own or admin" on public.merchants
for select using (id = auth.uid() or public.is_admin());
create policy "merchants own update or admin" on public.merchants
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "venues merchant owner or admin select" on public.venues
for select using (
  merchant_id = auth.uid()
  or public.is_admin()
  or is_active = true
);
create policy "venues merchant owner or admin write" on public.venues
for all using (merchant_id = auth.uid() or public.is_admin())
with check (merchant_id = auth.uid() or public.is_admin());

create policy "geofences merchant owner or admin" on public.geofences
for all using (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and (v.merchant_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and (v.merchant_id = auth.uid() or public.is_admin())
  )
);

create policy "pricing merchant owner or admin select" on public.pricing_plans
for select using (
  exists (
    select 1 from public.venues v
    where v.id = venue_id
      and (v.merchant_id = auth.uid() or public.is_admin() or v.is_active = true)
  )
);
create policy "pricing merchant owner or admin write" on public.pricing_plans
for all using (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and (v.merchant_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and (v.merchant_id = auth.uid() or public.is_admin())
  )
);

create policy "sessions user merchant admin select" on public.sessions
for select using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.venues v
    where v.id = venue_id and v.merchant_id = auth.uid()
  )
);
create policy "sessions user create or admin" on public.sessions
for insert with check (user_id = auth.uid() or public.is_admin());
create policy "sessions user merchant update or admin" on public.sessions
for update using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.venues v
    where v.id = venue_id and v.merchant_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.venues v
    where v.id = venue_id and v.merchant_id = auth.uid()
  )
);

create policy "session events user merchant admin" on public.session_events
for select using (
  exists (
    select 1 from public.sessions s
    join public.venues v on v.id = s.venue_id
    where s.id = session_id
      and (
        s.user_id = auth.uid()
        or v.merchant_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy "settlement merchant or admin" on public.settlement_batches
for select using (merchant_id = auth.uid() or public.is_admin());

create policy "tax records merchant or admin" on public.tax_records
for select using (merchant_id = auth.uid() or public.is_admin());

create policy "notifications own or admin" on public.notifications
for select using (user_id = auth.uid() or public.is_admin());
create policy "notifications own update or admin" on public.notifications
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "audit logs admin only" on public.audit_logs
for select using (public.is_admin());

create policy "venue qr merchant or admin" on public.venue_qr_codes
for all using (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and (v.merchant_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.venues v
    where v.id = venue_id and (v.merchant_id = auth.uid() or public.is_admin())
  )
);

create policy "operator ledger admin only" on public.operator_ledger
for select using (public.is_admin());

create policy "operator payouts admin only" on public.operator_payouts
for select using (public.is_admin());
