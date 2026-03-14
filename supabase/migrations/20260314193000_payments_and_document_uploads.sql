-- Payments + document uploads hardening

-- Extend payment transfers for Stripe lifecycle + idempotency + reconciliation metadata
alter table if exists payment_transfers
  add column if not exists idempotency_key text,
  add column if not exists created_by uuid references user_profiles(id),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists last_error text,
  add column if not exists reconciled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_payment_transfers_tenant_idempotency
  on payment_transfers(tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_payment_transfers_tenant_status
  on payment_transfers(tenant_id, status, created_at desc);

-- Enrich onboarding document metadata for real uploads
alter table if exists customer_documents
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  add column if not exists uploaded_by uuid references user_profiles(id);

create index if not exists idx_customer_documents_tenant_status
  on customer_documents(tenant_id, status, created_at desc);

-- Create private storage bucket for customer documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-documents',
  'customer-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Tenant-scoped storage policies. Object path convention:
--   {tenant_id}/{customer_id}/{generated-file-name}
drop policy if exists "tenant read customer documents" on storage.objects;
create policy "tenant read customer documents"
on storage.objects for select
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.is_active = true
      and tm.tenant_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists "tenant insert customer documents" on storage.objects;
create policy "tenant insert customer documents"
on storage.objects for insert
with check (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.is_active = true
      and tm.tenant_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists "tenant update customer documents" on storage.objects;
create policy "tenant update customer documents"
on storage.objects for update
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.is_active = true
      and tm.tenant_id::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.is_active = true
      and tm.tenant_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists "tenant delete customer documents" on storage.objects;
create policy "tenant delete customer documents"
on storage.objects for delete
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.is_active = true
      and tm.tenant_id::text = split_part(name, '/', 1)
  )
);
