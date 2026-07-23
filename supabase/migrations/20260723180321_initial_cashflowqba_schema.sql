create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  phone_e164 text not null,
  full_name text not null,
  whatsapp_consent boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (phone_e164)
);

create table public.payment_options (
  id text primary key,
  provider text not null check (provider in ('trondealer', 'manual')),
  asset text not null,
  network text not null,
  enabled boolean not null default false,
  stablecoin boolean not null default false,
  address_type text not null,
  min_amount_usd numeric(14, 2) not null check (min_amount_usd >= 0),
  max_amount_usd numeric(14, 2) not null check (max_amount_usd >= min_amount_usd),
  min_confirmations integer not null default 0 check (min_confirmations >= 0),
  estimated_confirmation_time text not null,
  warning text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (asset, network)
);

create table public.delivery_methods (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  currency text not null check (currency in ('USD', 'EUR', 'CUP', 'MLC')),
  type text not null check (type in ('cash', 'bank_transfer', 'card_topup', 'balance')),
  zone text not null,
  active boolean not null default false,
  min_amount numeric(14, 2) not null check (min_amount >= 0),
  max_amount numeric(14, 2) not null check (max_amount >= min_amount),
  fee numeric(14, 2) not null default 0 check (fee >= 0),
  estimated_min_hours integer not null check (estimated_min_hours >= 0),
  estimated_max_hours integer not null check (estimated_max_hours >= estimated_min_hours),
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.quotes (
  id uuid primary key default extensions.gen_random_uuid(),
  amount_delivered numeric(14, 2) not null check (amount_delivered > 0),
  service_fee numeric(14, 2) not null check (service_fee >= 0),
  delivery_fee numeric(14, 2) not null check (delivery_fee >= 0),
  total_to_pay_usd numeric(14, 2) not null check (total_to_pay_usd > 0),
  fee_percentage numeric(7, 4) not null check (fee_percentage >= 0),
  delivery_method_code text not null,
  municipality text not null,
  delivery_speed text not null check (delivery_speed in ('standard', 'priority')),
  payment_option_id text not null references public.payment_options(id),
  status text not null check (status in ('active', 'consumed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique,
  quote_id uuid not null unique references public.quotes(id),
  tracking_token_hash text not null unique,
  sender_customer_id uuid references public.customers(id),
  sender_name text not null,
  sender_phone_e164 text not null,
  beneficiary_name text not null,
  beneficiary_phone_e164 text not null,
  municipality text not null,
  delivery_address text not null,
  notes text not null default '',
  is_surprise boolean not null default false,
  notify_sender boolean not null default true,
  notify_beneficiary boolean not null default true,
  payment_status text not null,
  delivery_status text not null,
  amount_delivered numeric(14, 2) not null,
  total_locked_usd numeric(14, 2) not null,
  quote_expires_at timestamptz not null,
  payment_detected_at timestamptz,
  payment_confirmed_at timestamptz,
  payment_swept_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.payment_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('trondealer', 'manual')),
  asset text not null,
  network text not null,
  address text not null default '',
  address_type text not null,
  amount_due_usd numeric(14, 2) not null check (amount_due_usd > 0),
  amount_due_native numeric(36, 18),
  amount_received_usd numeric(14, 2) not null default 0 check (amount_received_usd >= 0),
  amount_received_native numeric(36, 18),
  price_usd numeric(24, 8),
  status text not null,
  confirmations integer not null default 0 check (confirmations >= 0),
  min_confirmations integer not null default 0 check (min_confirmations >= 0),
  expires_at timestamptz not null,
  quote_locked_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index payment_intents_one_active_per_order
on public.payment_intents (order_id)
where status in ('created', 'awaiting_payment', 'detected', 'confirming');

create table public.payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  provider text not null,
  event_type text not null,
  provider_status text,
  deduplication_key text not null unique,
  label text not null default '',
  tx_hash text not null default '',
  output_index text not null default '',
  asset text not null default '',
  network text not null default '',
  amount_usd numeric(14, 2),
  amount_native numeric(36, 18),
  price_usd numeric(24, 8),
  confirmations integer check (confirmations >= 0),
  min_confirmations integer check (min_confirmations >= 0),
  occurred_at timestamptz,
  outcome text not null check (outcome in ('applied', 'unknown', 'order_not_found')),
  raw_payload jsonb,
  received_at timestamptz not null default timezone('utc', now())
);

create table public.agents (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  phone_e164 text not null,
  zone text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  agent_id uuid references public.agents(id) on delete restrict,
  status text not null,
  assigned_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notification_events (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  event_type text not null,
  template text not null,
  recipient text not null,
  channel text not null default 'whatsapp',
  status text not null check (status in ('pending', 'sent', 'failed', 'retrying', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  error text,
  scheduled_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  referrer_customer_id uuid not null references public.customers(id),
  referred_customer_id uuid references public.customers(id),
  code text not null unique,
  status text not null default 'pending',
  qualifying_order_id uuid references public.orders(id),
  reward_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.service_announcements (
  id uuid primary key default extensions.gen_random_uuid(),
  message text not null,
  type text not null check (type in ('info', 'promotion', 'warning')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at)
);

create index orders_payment_status_idx on public.orders (payment_status, created_at desc);
create index orders_delivery_status_idx on public.orders (delivery_status, created_at desc);
create index orders_municipality_idx on public.orders (municipality);
create index payment_events_tx_idx on public.payment_events (tx_hash, output_index);
create index payment_events_intent_idx on public.payment_events (payment_intent_id, received_at);
create index notification_events_status_idx on public.notification_events (status, scheduled_at);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_updated_at();
create trigger payment_options_set_updated_at
before update on public.payment_options
for each row execute function private.set_updated_at();
create trigger delivery_methods_set_updated_at
before update on public.delivery_methods
for each row execute function private.set_updated_at();
create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function private.set_updated_at();
create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();
create trigger payment_intents_set_updated_at
before update on public.payment_intents
for each row execute function private.set_updated_at();
create trigger agents_set_updated_at
before update on public.agents
for each row execute function private.set_updated_at();
create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function private.set_updated_at();
create trigger notification_events_set_updated_at
before update on public.notification_events
for each row execute function private.set_updated_at();
create trigger referrals_set_updated_at
before update on public.referrals
for each row execute function private.set_updated_at();
create trigger service_announcements_set_updated_at
before update on public.service_announcements
for each row execute function private.set_updated_at();

alter table public.customers enable row level security;
alter table public.payment_options enable row level security;
alter table public.delivery_methods enable row level security;
alter table public.quotes enable row level security;
alter table public.orders enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_events enable row level security;
alter table public.agents enable row level security;
alter table public.deliveries enable row level security;
alter table public.notification_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.referrals enable row level security;
alter table public.service_announcements enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

insert into public.payment_options (
  id, provider, asset, network, enabled, stablecoin, address_type,
  min_amount_usd, max_amount_usd, min_confirmations,
  estimated_confirmation_time, warning
) values
(
  'usdt-bsc', 'trondealer', 'USDT', 'bsc', true, true, 'evm',
  20, 1500, 15, 'Entre 1 y 5 minutos',
  'Envía únicamente USDT por BSC / BEP-20.'
),
(
  'eur-manual', 'manual', 'EUR', 'manual', true, false, 'other',
  20, 1500, 0, 'Confirmación manual',
  'El pago se coordina por WhatsApp mediante IBAN o Bizum.'
);

insert into public.delivery_methods (
  code, name, currency, type, zone, active, min_amount, max_amount,
  fee, estimated_min_hours, estimated_max_hours, description
) values (
  'usd_cash_havana', 'USD en efectivo en La Habana', 'USD', 'cash',
  'havana', true, 20, 1500, 0, 1, 24,
  'Entrega de efectivo sujeta a disponibilidad operativa.'
);
