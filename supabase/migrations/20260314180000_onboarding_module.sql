-- Customer Onboarding Module: extended profile, KYC, AML, documents, status workflow, compliance reviews

-- Onboarding status: workflow states for customer onboarding lifecycle
create type onboarding_status as enum (
  'draft',                    -- profile not yet complete
  'profile_complete',         -- basic profile saved, can proceed to KYC
  'kyc_pending',             -- KYC form to fill
  'kyc_submitted',           -- KYC submitted, awaiting verification
  'kyc_verified',            -- KYC verified by compliance
  'kyc_rejected',            -- KYC rejected
  'aml_pending',             -- AML form to fill
  'aml_submitted',           -- AML submitted, awaiting review
  'aml_approved',            -- AML approved
  'compliance_review',       -- in compliance queue
  'approved',                -- fully approved
  'rejected',                -- onboarding rejected
  'ready_for_account_opening' -- can open accounts
);

-- Extend customers with profile and onboarding workflow
alter table customers
  add column if not exists type text not null default 'individual' check (type in ('individual', 'business')),
  add column if not exists phone text,
  add column if not exists country_code char(2),
  add column if not exists onboarding_status text not null default 'draft';

-- Backfill existing rows: treat as profile_complete so they can continue KYC or open accounts (legacy)
update customers
set onboarding_status = 'profile_complete'
where onboarding_status = 'draft' and created_at < now();

-- Constrain onboarding_status to enum-like values
alter table customers
  add constraint chk_onboarding_status check (
    onboarding_status in (
      'draft', 'profile_complete', 'kyc_pending', 'kyc_submitted', 'kyc_verified', 'kyc_rejected',
      'aml_pending', 'aml_submitted', 'aml_approved', 'compliance_review', 'approved', 'rejected',
      'ready_for_account_opening'
    )
  );

-- KYC details (1:1 with customer)
create table if not exists customer_kyc_details (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  id_type text not null,
  id_number text not null,
  id_country char(2) not null,
  date_of_birth date,
  nationality char(2),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postal_code text,
  country char(2) not null,
  verified_at timestamptz,
  verified_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

create index if not exists idx_customer_kyc_tenant on customer_kyc_details(tenant_id);
create index if not exists idx_customer_kyc_customer on customer_kyc_details(customer_id);

-- AML-related onboarding information (1:1 with customer)
create table if not exists customer_aml_details (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  source_of_funds text not null,
  expected_monthly_volume_minor bigint,
  purpose_of_account text not null,
  pep_declaration boolean not null default false,
  sanctioned_country_exposure boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id)
);

create index if not exists idx_customer_aml_tenant on customer_aml_details(tenant_id);
create index if not exists idx_customer_aml_customer on customer_aml_details(customer_id);

-- Document upload placeholders (1:N per customer)
create table if not exists customer_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  document_type text not null check (document_type in ('id_proof', 'address_proof', 'income_proof', 'contract', 'statement', 'other')),
  storage_path text not null default 'pending',
  file_name text,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'verified', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_documents_tenant on customer_documents(tenant_id);
create index if not exists idx_customer_documents_customer on customer_documents(customer_id);

-- Compliance/admin review actions (audit trail for onboarding decisions)
create table if not exists onboarding_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  reviewer_id uuid not null references user_profiles(id) on delete restrict,
  action text not null check (action in ('kyc_approve', 'kyc_reject', 'aml_approve', 'aml_reject', 'compliance_approve', 'compliance_reject', 'request_changes')),
  comment text,
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_reviews_tenant on onboarding_reviews(tenant_id);
create index if not exists idx_onboarding_reviews_customer on onboarding_reviews(customer_id);
create index if not exists idx_onboarding_reviews_created on onboarding_reviews(tenant_id, created_at desc);

-- RLS for new tables
alter table customer_kyc_details enable row level security;
alter table customer_aml_details enable row level security;
alter table customer_documents enable row level security;
alter table onboarding_reviews enable row level security;

create policy "tenant scoped customer_kyc_details"
on customer_kyc_details for all
using (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = customer_kyc_details.tenant_id and tm.is_active = true
  )
)
with check (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = customer_kyc_details.tenant_id and tm.is_active = true
  )
);

create policy "tenant scoped customer_aml_details"
on customer_aml_details for all
using (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = customer_aml_details.tenant_id and tm.is_active = true
  )
)
with check (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = customer_aml_details.tenant_id and tm.is_active = true
  )
);

create policy "tenant scoped customer_documents"
on customer_documents for all
using (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = customer_documents.tenant_id and tm.is_active = true
  )
)
with check (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = customer_documents.tenant_id and tm.is_active = true
  )
);

create policy "tenant scoped onboarding_reviews"
on onboarding_reviews for all
using (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = onboarding_reviews.tenant_id and tm.is_active = true
  )
)
with check (
  exists (
    select 1 from tenant_memberships tm
    where tm.user_id = (select auth.uid()) and tm.tenant_id = onboarding_reviews.tenant_id and tm.is_active = true
  )
);
