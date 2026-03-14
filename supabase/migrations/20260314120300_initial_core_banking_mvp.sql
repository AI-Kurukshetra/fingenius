create extension if not exists "pgcrypto";

create type user_role as enum (
  'platform_admin',
  'tenant_admin',
  'operations',
  'compliance_officer',
  'relationship_manager',
  'customer'
);

create type account_status as enum ('pending', 'active', 'frozen', 'closed');
create type loan_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed');
create type ledger_status as enum ('pending', 'posted', 'reversed');
create type payment_provider as enum ('stripe');

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  legal_name text not null,
  country_code char(2) not null,
  base_currency char(3) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, role)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_customer_ref text not null,
  full_name text not null,
  email text not null,
  kyc_status text not null default 'pending',
  risk_tier text not null default 'medium',
  created_at timestamptz not null default now(),
  unique (tenant_id, external_customer_ref)
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  account_number text not null,
  product_code text not null,
  currency char(3) not null,
  status account_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (tenant_id, account_number)
);

create table if not exists ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  reference text not null,
  description text not null,
  status ledger_status not null default 'pending',
  idempotency_key text,
  posted_at timestamptz,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, reference)
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  transaction_id uuid not null references ledger_transactions(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  direction text not null check (direction in ('debit', 'credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create table if not exists loan_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  principal_minor bigint not null check (principal_minor > 0),
  term_months int not null check (term_months > 0),
  annual_rate_bps int not null check (annual_rate_bps > 0),
  purpose text not null,
  status loan_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create table if not exists compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  event_type text not null,
  severity text not null,
  status text not null default 'open',
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists payment_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  provider payment_provider not null default 'stripe',
  provider_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_reference)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid not null references user_profiles(id) on delete restrict,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  event_hash text not null,
  previous_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_memberships_user_id on tenant_memberships(user_id);
create index if not exists idx_customers_tenant_id on customers(tenant_id);
create index if not exists idx_accounts_tenant_customer on accounts(tenant_id, customer_id);
create index if not exists idx_ledger_transactions_tenant_created on ledger_transactions(tenant_id, created_at desc);
create index if not exists idx_ledger_entries_transaction_id on ledger_entries(transaction_id);
create index if not exists idx_loan_applications_tenant_status on loan_applications(tenant_id, status);
create index if not exists idx_compliance_alerts_tenant_status on compliance_alerts(tenant_id, status);
create index if not exists idx_audit_logs_tenant_created on audit_logs(tenant_id, created_at desc);

create or replace function enforce_posted_txn_balance()
returns trigger
language plpgsql
as $$
declare
  debit_total bigint;
  credit_total bigint;
begin
  if new.status = 'posted' then
    select
      coalesce(sum(case when direction = 'debit' then amount_minor else 0 end), 0),
      coalesce(sum(case when direction = 'credit' then amount_minor else 0 end), 0)
    into debit_total, credit_total
    from ledger_entries
    where transaction_id = new.id;

    if debit_total = 0 or credit_total = 0 or debit_total <> credit_total then
      raise exception 'Ledger transaction % is unbalanced', new.id;
    end if;

    new.posted_at := coalesce(new.posted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_posted_txn_balance on ledger_transactions;
create trigger trg_enforce_posted_txn_balance
before update of status on ledger_transactions
for each row
execute function enforce_posted_txn_balance();

create or replace function prevent_mutation_on_immutable_tables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table is immutable';
end;
$$;

drop trigger if exists trg_immutable_ledger_entries on ledger_entries;
create trigger trg_immutable_ledger_entries
before update or delete on ledger_entries
for each row
execute function prevent_mutation_on_immutable_tables();

drop trigger if exists trg_immutable_audit_logs on audit_logs;
create trigger trg_immutable_audit_logs
before update or delete on audit_logs
for each row
execute function prevent_mutation_on_immutable_tables();

alter table tenants enable row level security;
alter table user_profiles enable row level security;
alter table tenant_memberships enable row level security;
alter table customers enable row level security;
alter table accounts enable row level security;
alter table ledger_transactions enable row level security;
alter table ledger_entries enable row level security;
alter table loan_applications enable row level security;
alter table compliance_alerts enable row level security;
alter table payment_transfers enable row level security;
alter table audit_logs enable row level security;

create policy "tenant memberships visible to self"
on tenant_memberships
for select
using (user_id = (select auth.uid()));

create policy "tenant scoped customers"
on customers
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = customers.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = customers.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped accounts"
on accounts
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = accounts.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = accounts.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped ledger transactions"
on ledger_transactions
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = ledger_transactions.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = ledger_transactions.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped ledger entries"
on ledger_entries
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = ledger_entries.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = ledger_entries.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped loans"
on loan_applications
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = loan_applications.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = loan_applications.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped compliance"
on compliance_alerts
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = compliance_alerts.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = compliance_alerts.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped transfers"
on payment_transfers
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = payment_transfers.tenant_id
      and tm.is_active = true
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = payment_transfers.tenant_id
      and tm.is_active = true
  )
);

create policy "tenant scoped audit logs"
on audit_logs
for select
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = audit_logs.tenant_id
      and tm.is_active = true
  )
);
