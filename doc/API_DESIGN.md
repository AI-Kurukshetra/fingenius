# API Design — Core Banking MVP

## API conventions
- Base path: `/api/v1`
- Auth: `Authorization: Bearer <jwt>` unless stated otherwise
- Tenant scope: `x-tenant-id: <uuid>` required on tenant-scoped endpoints
- Content type: `application/json`
- Idempotency: required for money-moving writes via `idempotency-key`
- Response envelope:
  - success: `{ "success": true, "data": {...}, "meta": {...} }`
  - error: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`
- Standard audit fields in mutating payloads where relevant: `request_id`, `actor_note` (optional)

## Error model (common)
- `400` malformed request
- `401` unauthenticated
- `403` forbidden (RBAC/RLS)
- `404` resource not found
- `409` state conflict (e.g., unbalanced posting, duplicate ref)
- `422` validation failure
- `429` rate-limited
- `500` internal error

## 1) `/auth`
- Main endpoints:
  - `POST /auth/login`
  - `POST /auth/logout`
  - `POST /auth/refresh`
  - `POST /auth/invite`
  - `POST /auth/accept-invite`
- Request example (`POST /auth/login`):
```json
{ "email": "ops@tenant.com", "password": "••••••••" }
```
- Response example:
```json
{ "success": true, "data": { "access_token": "jwt", "refresh_token": "rt", "expires_in": 3600 } }
```
- Auth requirements:
  - Login/refresh: public
  - Invite: `platform_admin|tenant_admin`
- Validation rules:
  - email format, password min length, invite role must exist for tenant
- Error cases:
  - invalid credentials, invited user already active, expired invite
- Audit logging:
  - `auth.login`, `auth.logout`, `auth.invite.sent`, `auth.invite.accepted`, `auth.refresh`

## 2) `/customers`
- Main endpoints:
  - `GET /customers`
  - `POST /customers`
  - `GET /customers/{customerId}`
  - `PATCH /customers/{customerId}`
  - `POST /customers/{customerId}/activate`
- Request example (`POST /customers`):
```json
{ "external_customer_ref": "CUST-1001", "type": "individual", "full_name": "Asha Rao", "email": "asha@example.com", "country_code": "IN" }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "kyc_pending" } }
```
- Auth requirements:
  - `relationship_manager|operations|tenant_admin`
- Validation rules:
  - unique `(tenant_id, external_customer_ref)`, country code ISO-2, email optional but valid
- Error cases:
  - duplicate external ref, invalid status transition
- Audit logging:
  - `customer.created`, `customer.updated`, `customer.activated`

## 3) `/accounts`
- Main endpoints:
  - `GET /accounts`
  - `POST /accounts`
  - `GET /accounts/{accountId}`
  - `PATCH /accounts/{accountId}`
  - `POST /accounts/{accountId}/freeze`
  - `POST /accounts/{accountId}/close`
- Request example (`POST /accounts`):
```json
{ "customer_id": "uuid", "product_id": "uuid", "currency": "INR", "initial_deposit_minor": 100000 }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "account_number": "00100012345", "status": "active" } }
```
- Auth requirements:
  - `operations|tenant_admin`
- Validation rules:
  - customer belongs to tenant, product active, supported currency
- Error cases:
  - product inactive, account already closed/frozen
- Audit logging:
  - `account.created`, `account.updated`, `account.frozen`, `account.closed`

## 4) `/transactions`
- Main endpoints:
  - `GET /transactions`
  - `POST /transactions`
  - `GET /transactions/{transactionId}`
  - `POST /transactions/{transactionId}/approve`
  - `POST /transactions/{transactionId}/reverse`
- Request example (`POST /transactions`):
```json
{ "reference": "TXN-20260314-001", "type": "transfer", "from_account_id": "uuid", "to_account_id": "uuid", "amount_minor": 25000, "currency": "INR", "narration": "Vendor payout" }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "initiated" } }
```
- Auth requirements:
  - create: `operations|customer` (policy-based)
  - approve/reverse: `operations|tenant_admin` (4-eyes optional)
- Validation rules:
  - `idempotency-key` required, positive amount, matching currency, balance checks, journal entries must balance before `posted`
- Error cases:
  - duplicate idempotency key, insufficient funds, unbalanced journal, invalid reversal state
- Audit logging:
  - `transaction.created`, `transaction.approved`, `transaction.posted`, `transaction.reversed`

## 5) `/loans`
- Main endpoints:
  - `GET /loans`
  - `GET /loans/{loanId}`
  - `POST /loans/{loanId}/disburse`
  - `POST /loans/{loanId}/repayments`
  - `POST /loans/{loanId}/close`
- Request example (`POST /loans/{loanId}/disburse`):
```json
{ "disbursement_account_id": "uuid", "amount_minor": 500000 }
```
- Response example:
```json
{ "success": true, "data": { "loan_id": "uuid", "status": "active", "disbursed_at": "2026-03-14T12:00:00Z" } }
```
- Auth requirements:
  - `operations|tenant_admin`
- Validation rules:
  - loan must be approved, disbursed amount <= approved principal
- Error cases:
  - already disbursed, loan not approved, repayment exceeds outstanding amount
- Audit logging:
  - `loan.disbursed`, `loan.repayment_posted`, `loan.closed`

## 6) `/products`
- Main endpoints:
  - `GET /products`
  - `POST /products`
  - `GET /products/{productId}`
  - `PATCH /products/{productId}`
  - `POST /products/{productId}/activate`
  - `POST /products/{productId}/deactivate`
- Request example (`POST /products`):
```json
{ "code": "SAV_BASIC", "name": "Basic Savings", "account_type": "savings", "currency": "INR", "min_balance_minor": 1000 }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "is_active": true } }
```
- Auth requirements:
  - `tenant_admin`
- Validation rules:
  - unique `(tenant_id, code)`, supported account type/currency
- Error cases:
  - duplicate code, active product linked to immutable pricing contract
- Audit logging:
  - `product.created`, `product.updated`, `product.activated`, `product.deactivated`

## 7) `/compliance`
- Main endpoints:
  - `GET /compliance/cases`
  - `POST /compliance/cases`
  - `GET /compliance/cases/{caseId}`
  - `POST /compliance/cases/{caseId}/assign`
  - `POST /compliance/cases/{caseId}/resolve`
- Request example (`POST /compliance/cases`):
```json
{ "type": "aml", "severity": "high", "customer_id": "uuid", "summary": "Structuring pattern detected" }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "open" } }
```
- Auth requirements:
  - `compliance_officer|tenant_admin`
- Validation rules:
  - type/severity enums, resolution reason required on resolve
- Error cases:
  - invalid status transition, assignee not in tenant
- Audit logging:
  - `compliance.case_created`, `compliance.case_assigned`, `compliance.case_resolved`

## 8) `/reports`
- Main endpoints:
  - `GET /reports/trial-balance`
  - `GET /reports/transactions`
  - `GET /reports/loan-book`
  - `GET /reports/compliance-summary`
- Request example:
```json
{ "from": "2026-03-01", "to": "2026-03-14", "format": "json" }
```
- Response example:
```json
{ "success": true, "data": { "rows": [], "generated_at": "2026-03-14T12:00:00Z" } }
```
- Auth requirements:
  - `tenant_admin|operations|compliance_officer` (report-specific)
- Validation rules:
  - max date range (e.g., 92 days), format enum `json|csv`
- Error cases:
  - invalid date range, unsupported format
- Audit logging:
  - `report.generated` with report type + filters

## 9) `/notifications`
- Main endpoints:
  - `GET /notifications`
  - `POST /notifications`
  - `POST /notifications/{notificationId}/retry`
  - `POST /notifications/{notificationId}/read`
- Request example (`POST /notifications`):
```json
{ "user_id": "uuid", "channel": "email", "subject": "Payment posted", "body": "Your transfer completed." }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "queued" } }
```
- Auth requirements:
  - send: `operations|tenant_admin|system`
  - read own notifications: authenticated user
- Validation rules:
  - channel enum, required target user and body
- Error cases:
  - target user not tenant member, invalid channel/template
- Audit logging:
  - `notification.queued`, `notification.sent`, `notification.failed`, `notification.read`

## 10) `/documents`
- Main endpoints:
  - `POST /documents/upload-url`
  - `POST /documents`
  - `GET /documents/{documentId}`
  - `POST /documents/{documentId}/verify`
  - `POST /documents/{documentId}/reject`
- Request example (`POST /documents`):
```json
{ "customer_id": "uuid", "loan_application_id": "uuid", "type": "id_proof", "storage_path": "tenants/t1/docs/d1.pdf", "checksum_sha256": "..." }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "uploaded" } }
```
- Auth requirements:
  - upload: authenticated customer/internal user
  - verify/reject: `operations|compliance_officer`
- Validation rules:
  - allowed mime types, max file size, checksum required
- Error cases:
  - invalid file metadata, verification on expired document
- Audit logging:
  - `document.uploaded`, `document.verified`, `document.rejected`

## 11) `/admin`
- Main endpoints:
  - `GET /admin/metrics`
  - `GET /admin/users`
  - `POST /admin/users/{userId}/roles`
  - `DELETE /admin/users/{userId}/roles/{roleId}`
  - `POST /admin/tenants/{tenantId}/suspend`
- Request example (`POST /admin/users/{userId}/roles`):
```json
{ "role_id": "uuid" }
```
- Response example:
```json
{ "success": true, "data": { "user_id": "uuid", "roles": ["operations"] } }
```
- Auth requirements:
  - `platform_admin` for cross-tenant actions, `tenant_admin` for tenant-local actions
- Validation rules:
  - role exists and belongs to tenant, cannot remove final admin role without replacement
- Error cases:
  - privilege escalation attempt, locked tenant
- Audit logging:
  - `admin.role_granted`, `admin.role_revoked`, `admin.tenant_suspended`

## 12) `/integrations`
- Main endpoints:
  - `GET /integrations`
  - `POST /integrations`
  - `PATCH /integrations/{integrationId}`
  - `POST /integrations/{integrationId}/test`
  - `POST /integrations/{integrationId}/disable`
- Request example (`POST /integrations`):
```json
{ "type": "payment_gateway", "provider": "stripe", "name": "Stripe Primary", "config": { "api_key": "enc:..." } }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "active" } }
```
- Auth requirements:
  - `tenant_admin|platform_admin`
- Validation rules:
  - provider/type combo supported, encrypted secrets only
- Error cases:
  - duplicate active provider config, failed connectivity test
- Audit logging:
  - `integration.created`, `integration.updated`, `integration.tested`, `integration.disabled`

## 13) `/webhooks`
- Main endpoints:
  - `POST /webhooks/inbound/{provider}`
  - `GET /webhooks/subscriptions`
  - `POST /webhooks/subscriptions`
  - `PATCH /webhooks/subscriptions/{webhookId}`
- Request example (`POST /webhooks/inbound/stripe`):
```json
{ "id": "evt_123", "type": "payment_intent.succeeded", "data": { "object": {} } }
```
- Response example:
```json
{ "success": true, "data": { "accepted": true } }
```
- Auth requirements:
  - inbound: provider signature header (`Stripe-Signature`) instead of bearer
  - subscription management: `tenant_admin`
- Validation rules:
  - verify signature, enforce replay window, idempotent event processing by provider event id
- Error cases:
  - invalid signature, stale timestamp, duplicate event
- Audit logging:
  - `webhook.received`, `webhook.processed`, `webhook.failed`, `webhook.subscription_updated`

## 14) `/payments`
- Main endpoints:
  - `POST /payments/transfers`
  - `GET /payments/transfers/{transferId}`
  - `POST /payments/transfers/{transferId}/cancel`
  - `POST /payments/payouts`
- Request example (`POST /payments/transfers`):
```json
{ "source_account_id": "uuid", "destination": { "type": "bank_account", "reference": "ext_123" }, "amount_minor": 120000, "currency": "INR" }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "provider": "stripe", "status": "pending" } }
```
- Auth requirements:
  - `operations|tenant_admin`
- Validation rules:
  - `idempotency-key` required, payment rails enabled, AML/KYC checks clear
- Error cases:
  - payment rail unavailable, compliance hold, provider decline
- Audit logging:
  - `payment.initiated`, `payment.provider_updated`, `payment.cancelled`, `payment.failed`

## 15) `/audit`
- Main endpoints:
  - `GET /audit/events`
  - `GET /audit/events/{eventId}`
  - `GET /audit/export`
  - `POST /audit/verify-chain`
- Request example (`GET /audit/events` query):
```json
{ "entity_name": "transaction", "entity_id": "uuid", "from": "2026-03-01", "to": "2026-03-14" }
```
- Response example:
```json
{ "success": true, "data": { "items": [{ "id": "uuid", "action": "transaction.posted", "event_hash": "..." }] } }
```
- Auth requirements:
  - `compliance_officer|tenant_admin|platform_admin` (read-only)
- Validation rules:
  - bounded date ranges, allowed filters
- Error cases:
  - unauthorized export scope, chain verification mismatch
- Audit logging:
  - `audit.viewed`, `audit.exported`, `audit.chain_verified`

## 16) `/kyc`
- Main endpoints:
  - `POST /kyc/checks`
  - `GET /kyc/checks/{checkId}`
  - `POST /kyc/checks/{checkId}/approve`
  - `POST /kyc/checks/{checkId}/reject`
- Request example (`POST /kyc/checks`):
```json
{ "customer_id": "uuid", "document_ids": ["uuid"], "provider": "internal" }
```
- Response example:
```json
{ "success": true, "data": { "id": "uuid", "status": "in_review" } }
```
- Auth requirements:
  - create: `relationship_manager|operations`
  - approve/reject: `compliance_officer`
- Validation rules:
  - customer must be tenant-scoped, required docs by customer type
- Error cases:
  - missing mandatory docs, duplicate open KYC check
- Audit logging:
  - `kyc.check_created`, `kyc.approved`, `kyc.rejected`

## 17) `/aml`
- Main endpoints:
  - `POST /aml/screenings`
  - `GET /aml/alerts`
  - `POST /aml/alerts/{alertId}/escalate`
  - `POST /aml/alerts/{alertId}/close`
- Request example (`POST /aml/screenings`):
```json
{ "subject_type": "transaction", "subject_id": "uuid", "rules": ["velocity_24h", "sanctions_name_match"] }
```
- Response example:
```json
{ "success": true, "data": { "screening_id": "uuid", "result": "flagged", "alerts": ["uuid"] } }
```
- Auth requirements:
  - `compliance_officer|tenant_admin`
- Validation rules:
  - allowed subject types (`customer|transaction|payment`), rules whitelist
- Error cases:
  - unknown subject, alert already closed, invalid escalation target
- Audit logging:
  - `aml.screening_run`, `aml.alert_escalated`, `aml.alert_closed`

## Cross-cutting auth + validation requirements
- JWT must map to a valid user session and tenant membership.
- RBAC permission checks happen before business logic.
- RLS must still enforce tenant isolation for data access.
- Use Zod schemas for every payload and response contract.
- Sensitive fields (`config`, `secret`, tokens) never returned in plaintext.

## Cross-cutting audit logging requirements
Log all mutating endpoints with:
- `tenant_id`, `actor_user_id`, `action`, `entity_name`, `entity_id`
- `request_id`, source IP, user agent
- `before_data`/`after_data` snapshots when practical
- `event_hash` + `previous_hash` chain for tamper evidence
