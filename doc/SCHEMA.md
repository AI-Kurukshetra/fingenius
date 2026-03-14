# SCHEMA

## Migration History
- `20260314120300_initial_core_banking_mvp.sql`
- `20260314122100_authn_authz_layer.sql`
- `20260314180000_onboarding_module.sql` — customer onboarding: extended profile, KYC, AML, documents, status workflow, compliance reviews
- `20260314193000_payments_and_document_uploads.sql` — payment transfer lifecycle metadata + idempotency, customer document upload metadata, private Storage bucket + tenant RLS policies for uploaded files

## Implemented AuthN/AuthZ Additions
- `user_role_assignments` (tenant-scoped role grants)
- `auth_sessions` (session tracking/revocation)
- `user_profiles` trigger from `auth.users` inserts
- `audit_logs` insert policy for authenticated tenant members

## Implemented Payments/Document Upload Additions
- Current runtime behavior: payment creation/reconciliation uses simulated-success provider service with DB writes only; Stripe adapter is deferred but table contract remains compatible.
- `payment_transfers` columns:
  - `idempotency_key text` (tenant-scoped uniqueness for retry safety)
  - `created_by uuid` (audit attribution)
  - `metadata jsonb` (provider state snapshot)
  - `last_error text` (provider failure reason)
  - `reconciled_at timestamptz`, `updated_at timestamptz`
- `customer_documents` columns:
  - `mime_type text`, `file_size_bytes bigint`, `uploaded_by uuid`
- Document file runtime storage:
  - files are currently written to server filesystem (default `./uploads/customer-documents`, configurable with `DOCUMENT_UPLOAD_ROOT`)
  - `customer_documents.storage_path` stores tenant/customer relative file path
  - files are delivered via authenticated API route `/api/v1/onboarding/{customerId}/documents/{documentId}/download`
  - note: migration-created Supabase Storage bucket/policies remain in schema history but are not used by current runtime flow

## Scope
Initial MVP schema blueprint for these core entities:
- Customer, Account, Transaction, Product, Loan, LoanApplication, Document, AuditLog, User, Role, Permission, Fee, Interest, Compliance, GLAccount, JournalEntry, Notification, Session, Integration, Webhook.

Assumption: platform has a `tenants` table (`id uuid pk`) used for institution scoping. All business tables are tenant-scoped unless marked global.

## Global conventions
- ID type: `uuid` (`gen_random_uuid()`)
- Money: `bigint` in minor units (`amount_minor`)
- Currency: `char(3)` ISO-4217
- Timestamps: `timestamptz`
- Audit fields (default): `created_at`, `updated_at`, `created_by`, `updated_by`
- Tenant scope: `tenant_id uuid not null references tenants(id)` on scoped tables
- Soft delete where needed: `deleted_at timestamptz null`

## Enums (proposed)
- `user_status`: `invited | active | suspended | disabled`
- `customer_status`: `prospect | kyc_pending | active | restricted | closed`
- `account_status`: `pending | active | dormant | frozen | closed`
- `account_type`: `savings | current | loan | wallet`
- `transaction_type`: `transfer | payment | deposit | withdrawal | fee | interest | reversal`
- `transaction_status`: `initiated | approved | posted | failed | reversed`
- `loan_application_status`: `draft | submitted | under_review | approved | rejected | withdrawn`
- `loan_status`: `pending_disbursement | active | delinquent | restructured | closed | written_off`
- `document_type`: `id_proof | address_proof | income_proof | contract | statement | other`
- `document_status`: `uploaded | verified | rejected | expired`
- `compliance_type`: `kyc | aml | sanctions | fraud | pep`
- `compliance_status`: `open | in_review | escalated | resolved | false_positive`
- `severity_level`: `low | medium | high | critical`
- `gl_account_type`: `asset | liability | equity | income | expense`
- `gl_account_status`: `active | inactive | blocked`
- `journal_direction`: `debit | credit`
- `notification_channel`: `email | sms | in_app | webhook`
- `notification_status`: `queued | sent | delivered | failed | read`
- `session_status`: `active | revoked | expired`
- `integration_type`: `payment_gateway | kyc_provider | messaging | analytics`
- `integration_status`: `active | inactive | error`
- `webhook_status`: `active | paused | failed`
- `fee_type`: `flat | percentage | tiered`
- `interest_method`: `simple | compound | reducing_balance`

## Table designs

### 1) `users`
- Columns:
  - `id uuid` (maps to `auth.users.id`)
  - `tenant_id uuid`
  - `email text`
  - `full_name text`
  - `phone text null`
  - `status user_status`
  - `last_login_at timestamptz null`
  - `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid null`, `updated_by uuid null`
- PK: `id`
- FKs: `tenant_id -> tenants.id`
- Indexes: `(tenant_id, email unique)`, `(tenant_id, status)`, `(tenant_id, last_login_at desc)`
- Tenant scope: required (`tenant_id`)

### 2) `roles`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `code text` (e.g., `tenant_admin`)
  - `name text`
  - `description text null`
  - `is_system boolean default false`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`
- Indexes: `(tenant_id, code unique)`, `(tenant_id, is_system)`
- Tenant scope: required

### 3) `permissions`
- Columns:
  - `id uuid`
  - `code text` (e.g., `transaction:post`)
  - `name text`
  - `description text null`
  - `created_at timestamptz`, `updated_at timestamptz`
- PK: `id`
- FKs: none (global catalog)
- Indexes: `(code unique)`
- Tenant scope: global (not tenant-scoped)

### 4) `products`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `code text`
  - `name text`
  - `account_type account_type`
  - `currency char(3)`
  - `min_balance_minor bigint default 0`
  - `is_active boolean default true`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`
- Indexes: `(tenant_id, code unique)`, `(tenant_id, is_active)`
- Tenant scope: required

### 5) `customers`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `external_customer_ref text`
  - `type text` (`individual|business`)
  - `full_name text`
  - `email text null`
  - `phone text null`
  - `country_code char(2)`
  - `status customer_status`
  - `risk_rating severity_level default 'medium'`
  - `kyc_completed_at timestamptz null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`
- Indexes: `(tenant_id, external_customer_ref unique)`, `(tenant_id, status)`, `(tenant_id, email)`, `(tenant_id, phone)`
- Tenant scope: required

### 6) `accounts`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `customer_id uuid`
  - `product_id uuid`
  - `account_number text`
  - `iban text null`
  - `currency char(3)`
  - `status account_status`
  - `available_balance_minor bigint default 0`
  - `ledger_balance_minor bigint default 0`
  - `opened_at timestamptz`
  - `closed_at timestamptz null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `customer_id -> customers.id`, `product_id -> products.id`
- Indexes: `(tenant_id, account_number unique)`, `(tenant_id, customer_id)`, `(tenant_id, status)`
- Tenant scope: required

### 7) `transactions`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `reference text`
  - `type transaction_type`
  - `status transaction_status`
  - `from_account_id uuid null`
  - `to_account_id uuid null`
  - `amount_minor bigint`
  - `currency char(3)`
  - `idempotency_key text`
  - `narration text null`
  - `posted_at timestamptz null`
  - `reversed_transaction_id uuid null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `from_account_id -> accounts.id`, `to_account_id -> accounts.id`, `reversed_transaction_id -> transactions.id`
- Indexes: `(tenant_id, reference unique)`, `(tenant_id, idempotency_key unique)`, `(tenant_id, status, created_at desc)`, `(tenant_id, from_account_id)`, `(tenant_id, to_account_id)`
- Tenant scope: required

### 8) `gl_accounts`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `code text`
  - `name text`
  - `type gl_account_type`
  - `status gl_account_status`
  - `currency char(3)`
  - `parent_gl_account_id uuid null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `parent_gl_account_id -> gl_accounts.id`
- Indexes: `(tenant_id, code unique)`, `(tenant_id, type)`, `(tenant_id, status)`
- Tenant scope: required

### 9) `journal_entries`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `transaction_id uuid`
  - `gl_account_id uuid`
  - `account_id uuid null`
  - `direction journal_direction`
  - `amount_minor bigint`
  - `currency char(3)`
  - `entry_sequence int`
  - `created_at timestamptz`, `created_by uuid null`
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `transaction_id -> transactions.id`, `gl_account_id -> gl_accounts.id`, `account_id -> accounts.id`
- Indexes: `(tenant_id, transaction_id)`, `(tenant_id, gl_account_id, created_at desc)`, `(tenant_id, account_id, created_at desc)`, `(tenant_id, transaction_id, entry_sequence unique)`
- Tenant scope: required
- Note: immutable after insert

### 10) `fees`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `product_id uuid null`
  - `account_id uuid null`
  - `name text`
  - `fee_type fee_type`
  - `flat_amount_minor bigint null`
  - `rate_bps int null`
  - `min_fee_minor bigint null`
  - `max_fee_minor bigint null`
  - `is_active boolean default true`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `product_id -> products.id`, `account_id -> accounts.id`
- Indexes: `(tenant_id, is_active)`, `(tenant_id, product_id)`, `(tenant_id, account_id)`
- Tenant scope: required

### 11) `interest`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `product_id uuid null`
  - `account_id uuid null`
  - `method interest_method`
  - `rate_bps int`
  - `accrual_frequency text` (`daily|monthly`)
  - `posting_gl_account_id uuid`
  - `is_active boolean default true`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `product_id -> products.id`, `account_id -> accounts.id`, `posting_gl_account_id -> gl_accounts.id`
- Indexes: `(tenant_id, is_active)`, `(tenant_id, product_id)`, `(tenant_id, account_id)`
- Tenant scope: required

### 12) `loan_applications`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `customer_id uuid`
  - `product_id uuid null`
  - `requested_amount_minor bigint`
  - `currency char(3)`
  - `term_months int`
  - `annual_rate_bps int`
  - `purpose text`
  - `status loan_application_status`
  - `decision_reason text null`
  - `submitted_at timestamptz null`
  - `decided_at timestamptz null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `customer_id -> customers.id`, `product_id -> products.id`
- Indexes: `(tenant_id, customer_id, created_at desc)`, `(tenant_id, status, created_at desc)`
- Tenant scope: required

### 13) `loans`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `loan_application_id uuid`
  - `customer_id uuid`
  - `account_id uuid`
  - `principal_minor bigint`
  - `outstanding_principal_minor bigint`
  - `currency char(3)`
  - `annual_rate_bps int`
  - `term_months int`
  - `status loan_status`
  - `disbursed_at timestamptz null`
  - `maturity_date date null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `loan_application_id -> loan_applications.id`, `customer_id -> customers.id`, `account_id -> accounts.id`
- Indexes: `(tenant_id, customer_id)`, `(tenant_id, status)`, `(tenant_id, disbursed_at desc)`
- Tenant scope: required

### 14) `documents`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `customer_id uuid null`
  - `loan_application_id uuid null`
  - `type document_type`
  - `status document_status`
  - `storage_path text`
  - `file_name text`
  - `mime_type text`
  - `file_size_bytes bigint`
  - `checksum_sha256 text`
  - `verified_at timestamptz null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `customer_id -> customers.id`, `loan_application_id -> loan_applications.id`
- Indexes: `(tenant_id, customer_id)`, `(tenant_id, loan_application_id)`, `(tenant_id, type, status)`
- Tenant scope: required

### 15) `compliance`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `customer_id uuid null`
  - `transaction_id uuid null`
  - `type compliance_type`
  - `severity severity_level`
  - `status compliance_status`
  - `rule_code text`
  - `summary text`
  - `assigned_to uuid null`
  - `resolved_at timestamptz null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `customer_id -> customers.id`, `transaction_id -> transactions.id`, `assigned_to -> users.id`
- Indexes: `(tenant_id, status, severity, created_at desc)`, `(tenant_id, customer_id)`, `(tenant_id, transaction_id)`
- Tenant scope: required

### 16) `audit_logs`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `actor_user_id uuid`
  - `entity_name text`
  - `entity_id uuid`
  - `action text` (`create|update|delete|approve|post|reverse|login|logout`)
  - `request_id text null`
  - `ip_address inet null`
  - `user_agent text null`
  - `before_data jsonb null`
  - `after_data jsonb null`
  - `event_hash text`
  - `previous_hash text null`
  - `created_at timestamptz`
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `actor_user_id -> users.id`
- Indexes: `(tenant_id, created_at desc)`, `(tenant_id, entity_name, entity_id)`, `(tenant_id, actor_user_id, created_at desc)`, `(tenant_id, request_id)`
- Tenant scope: required
- Note: append-only/immutable

### 17) `notifications`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `user_id uuid`
  - `channel notification_channel`
  - `status notification_status`
  - `subject text`
  - `body text`
  - `template_code text null`
  - `metadata jsonb null`
  - `sent_at timestamptz null`
  - `read_at timestamptz null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `user_id -> users.id`
- Indexes: `(tenant_id, user_id, status, created_at desc)`, `(tenant_id, channel, status)`
- Tenant scope: required

### 18) `sessions`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `user_id uuid`
  - `status session_status`
  - `refresh_token_hash text`
  - `ip_address inet null`
  - `user_agent text null`
  - `last_seen_at timestamptz`
  - `expires_at timestamptz`
  - `revoked_at timestamptz null`
  - `created_at timestamptz`
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `user_id -> users.id`
- Indexes: `(tenant_id, user_id, status)`, `(tenant_id, expires_at)`, `(refresh_token_hash unique)`
- Tenant scope: required

### 19) `integrations`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `type integration_type`
  - `provider text` (e.g., `stripe`)
  - `name text`
  - `status integration_status`
  - `config_encrypted jsonb`
  - `last_healthcheck_at timestamptz null`
  - `last_error text null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`
- Indexes: `(tenant_id, type, provider)`, `(tenant_id, status)`
- Tenant scope: required

### 20) `webhooks`
- Columns:
  - `id uuid`
  - `tenant_id uuid`
  - `integration_id uuid`
  - `event_type text`
  - `target_url text`
  - `secret_hash text`
  - `status webhook_status`
  - `retry_count int default 0`
  - `last_delivered_at timestamptz null`
  - `last_response_code int null`
  - `last_error text null`
  - audit fields
- PK: `id`
- FKs: `tenant_id -> tenants.id`, `integration_id -> integrations.id`
- Indexes: `(tenant_id, integration_id, event_type unique)`, `(tenant_id, status)`, `(tenant_id, last_delivered_at desc)`
- Tenant scope: required

## Relationship map
- `users` M:N `roles` via bridge `user_roles(user_id, role_id, tenant_id)`.
- `roles` M:N `permissions` via bridge `role_permissions(role_id, permission_id)`.
- `customers` 1:N `accounts`, `loan_applications`, `documents`, `compliance`.
- `products` 1:N `accounts`, `loan_applications`, `fees`, `interest`.
- `transactions` 1:N `journal_entries`; each posted transaction must have balanced debit/credit journal totals.
- `accounts` connect operational balances to customer holdings; `journal_entries` connect accounting impact through `gl_accounts`.
- `loan_applications` 1:0..1 `loans` (approved applications become loans).
- `transactions` may trigger `fees`, `interest` accrual postings, `compliance` events, `notifications`, and `audit_logs`.
- `integrations` 1:N `webhooks` for external provider callbacks and outbound events.
- `sessions` and `audit_logs` tie security/access behavior to `users`.

## Integrity and security rules (must enforce)
- RLS enabled on all tenant-scoped tables using `tenant_id` + membership checks.
- `transactions` post only when related `journal_entries` are balanced.
- `journal_entries` and `audit_logs` are immutable (no update/delete except privileged archival flow).
- `idempotency_key` unique per tenant for transaction create APIs.
- Cross-tenant foreign key mismatches blocked at write time.

## Recommended next migration slices
1. Auth/RBAC tables: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`
2. Core banking: `products`, `customers`, `accounts`, `transactions`, `gl_accounts`, `journal_entries`
3. Lending/compliance/docs: `loan_applications`, `loans`, `documents`, `compliance`
4. Ops and integration: `fees`, `interest`, `notifications`, `integrations`, `webhooks`, `audit_logs`
