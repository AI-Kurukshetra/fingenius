-- MVP demo data seeder (idempotent)
-- Usage:
-- 1) Run in Supabase SQL editor (or prepend in the same SQL batch):
--      select set_config('app.bootstrap_superadmin_email', 'superadmin@demo.bank', false);
-- 2) Execute this script content.

begin;

do $$
declare
  v_superadmin_email text := coalesce(
    nullif(current_setting('app.bootstrap_superadmin_email', true), ''),
    nullif(current_setting('app.bootstrap_admin_email', true), '')
  );
  v_superadmin_user_id uuid;
  v_tenant_id uuid;
  v_customer_1 uuid;
  v_customer_2 uuid;
  v_account_1 uuid;
  v_account_2 uuid;
  v_transaction_id uuid;
begin
  if v_superadmin_email is null then
    raise exception 'Missing bootstrap superadmin email. Run: select set_config(''app.bootstrap_superadmin_email'', ''superadmin@demo.bank'', false);';
  end if;

  select id
    into v_superadmin_user_id
  from auth.users
  where lower(email) = lower(v_superadmin_email)
  limit 1;

  if v_superadmin_user_id is null then
    raise exception 'No auth.users row found for %. Create this user first, then re-run seed.', v_superadmin_email;
  end if;

  insert into public.tenants (code, legal_name, country_code, base_currency, is_active)
  values ('demo-bank', 'Demo Bank Ltd', 'IN', 'INR', true)
  on conflict (code) do update
    set legal_name = excluded.legal_name,
        country_code = excluded.country_code,
        base_currency = excluded.base_currency,
        is_active = true,
        updated_at = now()
  returning id into v_tenant_id;

  insert into public.user_profiles (id, full_name, email)
  select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
    lower(u.email)
  from auth.users u
  where u.id = v_superadmin_user_id
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  insert into public.tenant_memberships (tenant_id, user_id, role, is_active)
  values (v_tenant_id, v_superadmin_user_id, 'platform_admin', true)
  on conflict (tenant_id, user_id, role) do update
    set is_active = true;

  insert into public.user_role_assignments (tenant_id, user_id, role, created_by)
  values (v_tenant_id, v_superadmin_user_id, 'admin', v_superadmin_user_id)
  on conflict (tenant_id, user_id, role) do nothing;

  with upsert as (
    insert into public.customers (
      tenant_id,
      external_customer_ref,
      full_name,
      email,
      kyc_status,
      risk_tier
    )
    values
      (v_tenant_id, 'CUST-0001', 'Asha Rao', 'asha.rao@example.com', 'verified', 'low'),
      (v_tenant_id, 'CUST-0002', 'Raj Patel', 'raj.patel@example.com', 'pending', 'medium')
    on conflict (tenant_id, external_customer_ref) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          kyc_status = excluded.kyc_status,
          risk_tier = excluded.risk_tier
    returning id, external_customer_ref
  )
  select id into v_customer_1 from upsert where external_customer_ref = 'CUST-0001';

  if v_customer_1 is null then
    select id into v_customer_1
    from public.customers
    where tenant_id = v_tenant_id
      and external_customer_ref = 'CUST-0001'
    limit 1;
  end if;

  with upsert as (
    insert into public.customers (
      tenant_id,
      external_customer_ref,
      full_name,
      email,
      kyc_status,
      risk_tier
    )
    values (v_tenant_id, 'CUST-0002', 'Raj Patel', 'raj.patel@example.com', 'pending', 'medium')
    on conflict (tenant_id, external_customer_ref) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          kyc_status = excluded.kyc_status,
          risk_tier = excluded.risk_tier
    returning id
  )
  select id into v_customer_2 from upsert;

  if v_customer_2 is null then
    select id into v_customer_2
    from public.customers
    where tenant_id = v_tenant_id
      and external_customer_ref = 'CUST-0002'
    limit 1;
  end if;

  insert into public.accounts (
    tenant_id,
    customer_id,
    account_number,
    product_code,
    currency,
    status
  )
  values
    (v_tenant_id, v_customer_1, '0010000001', 'SAVINGS', 'INR', 'active'),
    (v_tenant_id, v_customer_2, '0010000002', 'CURRENT', 'INR', 'active')
  on conflict (tenant_id, account_number) do update
    set customer_id = excluded.customer_id,
        product_code = excluded.product_code,
        currency = excluded.currency,
        status = excluded.status;

  select id into v_account_1
  from public.accounts
  where tenant_id = v_tenant_id
    and account_number = '0010000001'
  limit 1;

  select id into v_account_2
  from public.accounts
  where tenant_id = v_tenant_id
    and account_number = '0010000002'
  limit 1;

  insert into public.ledger_transactions (
    tenant_id,
    reference,
    description,
    status,
    idempotency_key,
    created_by
  )
  values (
    v_tenant_id,
    'TXN-SEED-0001',
    'Seed transfer between demo accounts',
    'pending',
    'seed-idempotency-0001',
    v_superadmin_user_id
  )
  on conflict (tenant_id, reference) do update
    set description = excluded.description,
        idempotency_key = excluded.idempotency_key
  returning id into v_transaction_id;

  if not exists (
    select 1
    from public.ledger_entries le
    where le.transaction_id = v_transaction_id
  ) then
    insert into public.ledger_entries (
      tenant_id,
      transaction_id,
      account_id,
      direction,
      amount_minor,
      currency
    )
    values
      (v_tenant_id, v_transaction_id, v_account_1, 'debit', 50000, 'INR'),
      (v_tenant_id, v_transaction_id, v_account_2, 'credit', 50000, 'INR');
  end if;

  update public.ledger_transactions
  set status = 'posted', posted_at = coalesce(posted_at, now())
  where id = v_transaction_id
    and status <> 'posted';

  insert into public.loan_applications (
    tenant_id,
    customer_id,
    principal_minor,
    term_months,
    annual_rate_bps,
    purpose,
    status
  )
  select
    v_tenant_id,
    v_customer_2,
    250000,
    12,
    1400,
    'Working capital',
    'under_review'
  where not exists (
    select 1
    from public.loan_applications la
    where la.tenant_id = v_tenant_id
      and la.customer_id = v_customer_2
      and la.purpose = 'Working capital'
  );

  insert into public.compliance_alerts (
    tenant_id,
    customer_id,
    event_type,
    severity,
    status,
    summary
  )
  select
    v_tenant_id,
    v_customer_2,
    'aml_flag',
    'medium',
    'open',
    'Seed AML review case'
  where not exists (
    select 1
    from public.compliance_alerts ca
    where ca.tenant_id = v_tenant_id
      and ca.customer_id = v_customer_2
      and ca.summary = 'Seed AML review case'
  );

  insert into public.payment_transfers (
    tenant_id,
    account_id,
    provider,
    provider_reference,
    amount_minor,
    currency,
    status
  )
  values (
    v_tenant_id,
    v_account_1,
    'stripe',
    'tr_seed_0001',
    120000,
    'INR',
    'pending'
  )
  on conflict (tenant_id, provider_reference) do update
    set amount_minor = excluded.amount_minor,
        currency = excluded.currency,
        status = excluded.status;

  raise notice 'Seed complete. Tenant ID: %, Superadmin User ID: %', v_tenant_id, v_superadmin_user_id;
end $$;

commit;
