# Fintech MVP QA/UAT Checklist (Module-wise, Flow-wise, Role-wise)

## Document purpose
This checklist is a practical manual QA/UAT guide for testing the fintech MVP end-to-end by role.
It is aligned with the current app routes, API contracts, RBAC permissions, DB tables, and audit events.

## Roles under test
- `admin`
- `ops`
- `compliance_officer` (Compliance Officer)
- `teller`
- `customer_support` (Customer Support)

## Test setup prerequisites
- Seed at least one tenant with all 5 role users.
- Ensure all users have verified login credentials.
- Start app and Supabase services.
- Prepare at least 3 customers for lifecycle tests:
  - `cust_a`: new onboarding
  - `cust_b`: ready for account opening
  - `cust_c`: existing account + transaction history
- Prepare at least 2 active accounts and 1 frozen account.
- Keep browser devtools Network tab open for API status verification.
- Keep Supabase SQL editor open for DB verification queries.

## Common verification standards (apply to every module)
For every test case, confirm all 8 dimensions:
1. UI interaction works (no dead buttons).
2. Real API call is made (`2xx/4xx/5xx` visible in Network tab).
3. Backend logic executes correctly (response payload and status code).
4. DB state is updated/read correctly.
5. Loading state appears while request is pending.
6. Success or error feedback is shown.
7. Permissions are enforced in UI and backend.
8. UI refreshes/reacts after mutation (`router.refresh` behavior).

## Useful DB verification queries
```sql
-- Latest audit events
select created_at, action, resource_type, resource_id, actor_id, metadata
from audit_logs
order by created_at desc
limit 100;

-- Active role assignments
select tenant_id, user_id, role, created_at
from user_role_assignments
order by created_at desc;

-- Session table
select tenant_id, user_id, ip_address, user_agent, revoked_at, expires_at, last_seen_at
from auth_sessions
order by last_seen_at desc;
```

---

## Module 1: Public Homepage and Public Pages
### Purpose
Validate unauthenticated/public experience and route entry points.

### Flow summary
- Open `/`
- Navigate public CTAs (login/register)
- Verify auth-aware CTA behavior after login

### Roles allowed
- All roles (when unauthenticated/authenticated)

### Roles restricted
- None for viewing public pages

### Step-by-step test cases by role
1. Role: Any (logged out)
   - Open `/`
   - Click `Create workspace` and `Sign in`
   - Verify navigation to `/register` and `/login`
2. Role: Any (logged in)
   - Open `/`
   - Verify primary CTA changes to `Open dashboard`
   - Verify secondary CTA points to `/admin` for admin, `/profile` for others

### Expected result
- Public page renders with no auth errors.
- CTAs route correctly based on auth state.
- KPI section shows loading fallback before data resolves.

### Negative test cases
- Access dashboard page directly while logged out -> redirect to `/login`.

### Audit log expectations
- None for homepage view/navigation itself.

### Notes/dependencies
- Depends on valid middleware/session refresh.

---

## Module 2: Authentication and Session Management
### Purpose
Validate signup, login, logout, password reset/update, and session revocation end-to-end.

### Flow summary
- Signup -> email callback -> login -> dashboard
- Forgot password -> reset -> login with new password
- Logout and revoke sessions

### Roles allowed
- All roles

### Roles restricted
- None for auth basics

### Step-by-step test cases by role
1. Role: Any
   - Signup via `/register` with valid full name, email, password >= 8
   - Confirm success banner/message
   - Verify `POST /api/v1/auth/signup` behavior if using API path
2. Role: Any
   - Login via `/login`
   - Verify redirect to `/accounts`
   - Verify auth session row inserted in `auth_sessions`
3. Role: Any
   - Logout from dashboard header
   - Verify redirect to `/login?message=Signed out`
   - Verify session rows marked `revoked_at` for user
4. Role: Any
   - Trigger forgot password from `/forgot-password`
   - Complete `/reset-password`
   - Login using new password
5. Role: Any
   - Open `/profile` -> Security tab -> `Revoke All Sessions`
   - Verify all active sessions revoked

### Expected result
- Forms block invalid local validation.
- Submit buttons disable while pending.
- Success/error alerts are visible.
- API returns proper status codes (`201/200/401/422`).
- DB updates: `auth_sessions` and `user_profiles` reflect changes.

### Negative test cases
- Invalid email/password format -> inline errors and no submit.
- Wrong password login -> 401/invalid credentials.
- User without tenant assignment -> login blocked with explicit message.
- Expired reset session -> redirect to login with error.

### Audit log expectations
- `auth.login`
- `auth.logout`
- `auth.password_reset`
- `auth.sessions_revoked`

### Notes/dependencies
- Depends on Supabase Auth + callback route `/auth/callback`.

---

## Module 3: Role-Based Access Control (RBAC)
### Purpose
Verify role grants/revokes and permission enforcement in UI + API.

### Flow summary
- Admin grants role from `/admin`
- User permissions update immediately after refresh
- Restricted roles cannot call protected actions

### Roles allowed
- `admin` (manage permissions)

### Roles restricted
- `ops`, `compliance_officer`, `teller`, `customer_support` cannot manage role assignments

### Step-by-step test cases by role
1. Role: admin
   - Open `/admin` -> Role Management
   - Grant `ops` to a test user
   - Re-login as that user and verify ops modules/actions unlocked
2. Role: admin
   - Revoke same role
   - Verify access removed from UI and API
3. Role: non-admin roles
   - Attempt to open `/admin`
   - Attempt `POST /api/v1/admin/permissions`

### Expected result
- Role changes persist in `user_role_assignments`.
- Tenant memberships sync correctly.
- Non-admin access is denied at route and API level.

### Negative test cases
- Tenant scope mismatch payload -> `403 Tenant scope violation`.
- Invalid role value -> `422`.

### Audit log expectations
- `permission.granted`
- `permission.revoked`

### Notes/dependencies
- Depends on `user_role_assignments` + `tenant_memberships` sync logic.

---

## Module 4: Customer Onboarding
### Purpose
Validate onboarding lifecycle: customer profile, KYC, AML, documents, review actions, status transitions.

### Flow summary
- Create onboarding record
- Move through status transitions
- Submit KYC/AML
- Upload documents
- Perform review approve/reject actions

### Roles allowed
- `admin`: full
- `ops`: create/edit onboarding
- `compliance_officer`: review actions + queue
- `teller`: read-only (customer/account read)
- `customer_support`: read-only

### Roles restricted
- `teller`, `customer_support` cannot create/update onboarding data

### Step-by-step test cases by role
1. Role: ops/admin
   - Open `/customers`
   - Create customer (external ref, name, email, country, risk)
   - Open detail page `/customers/[id]`
2. Role: ops/admin
   - Execute allowed status transitions (buttons in status card)
   - Confirm disallowed transitions are blocked
3. Role: ops/admin
   - In `kyc_pending`, submit KYC form
   - In `aml_pending`, submit AML form
4. Role: ops/admin
   - Upload PDF/JPG/PNG/WebP document <= 10 MB
   - Open protected `View` link (`/api/v1/onboarding/{customerId}/documents/{documentId}/download`)
5. Role: compliance_officer/admin
   - Open `/customers/queue`
   - Approve/reject KYC and AML review actions
   - Verify status updates and review history
6. Role: teller/customer_support
   - Open customer list/detail and verify read-only behavior

### Expected result
- Customer row created in `customers` with onboarding fields.
- KYC/AML upserts in `customer_kyc_details` and `customer_aml_details`.
- Document uploads persist in `customer_documents` and server filesystem storage under tenant/customer path.
- Review actions append `onboarding_reviews` entries.
- Queue reflects real statuses (`kyc_submitted`, `aml_submitted`, `aml_approved`, `compliance_review`).

### Negative test cases
- Upload unsupported mime type -> `422 Unsupported document mime type`.
- Upload >10 MB -> `422`.
- Invalid transition -> `422 Transition not allowed`.
- Unauthorized review action -> `403 Forbidden`.

### Audit log expectations
- `customer.onboarded`
- `onboarding.profile_updated`
- `onboarding.kyc_updated`
- `onboarding.aml_updated`
- `onboarding.document_uploaded`
- `onboarding.status_transition`
- `onboarding.review.<action>`

### Notes/dependencies
- Account opening module depends on onboarding reaching `ready_for_account_opening` or `profile_complete`.

---

## Module 5: Account Management
### Purpose
Validate account opening, listing, filtering, and lifecycle status updates.

### Flow summary
- Open account for customer
- View account portfolio
- Update status (active/frozen/closed)

### Roles allowed
- `admin`, `ops` (write/read)
- `teller`, `customer_support` (read)

### Roles restricted
- `compliance_officer` (no account read/write by default permission set)
- `teller`, `customer_support` cannot create/update

### Step-by-step test cases by role
1. Role: ops/admin
   - Open `/accounts`
   - Create account for eligible customer
   - Verify new account appears in table after refresh
2. Role: ops/admin
   - Apply status changes active->frozen->active->closed
   - Verify closed accounts cannot transition further
3. Role: teller/customer_support
   - Open `/accounts`
   - Verify table visible and no create/update controls
4. Role: compliance_officer
   - Open `/accounts` and verify unauthorized redirect

### Expected result
- Account row inserted in `accounts` with generated account number.
- Status transitions enforce server-side rules.
- Filters (`status`, `product`, search) update UI correctly.

### Negative test cases
- Account create for non-eligible onboarding status -> `422`.
- Unauthorized PATCH status call -> `403`.
- Invalid status transition -> `422`.

### Audit log expectations
- `account.created`
- `account.status_changed`

### Notes/dependencies
- Depends on onboarding customer state and tenant-scoped customer existence.

---

## Module 6: Transaction Processing
### Purpose
Validate transaction posting and reversal with idempotency and RBAC.

### Flow summary
- Create balanced debit/credit posting
- Persist transaction and entries
- Reverse posted transaction

### Roles allowed
- Create: `admin`, `ops`, `teller`
- Read: `admin`, `ops`, `teller`, `customer_support`
- Reverse: `admin` only (by permission map)

### Roles restricted
- `compliance_officer` cannot read/create/reverse transactions by default
- `teller`, `ops`, `customer_support` cannot reverse

### Step-by-step test cases by role
1. Role: ops/teller/admin
   - Open `/transactions`
   - Create transaction with active debit/credit accounts
   - Include optional idempotency key
2. Role: ops/teller/admin
   - Re-submit same payload + same `idempotency-key`
   - Verify dedup behavior
3. Role: admin
   - Reverse a posted transaction
   - Verify reversal entry appears and original remains posted
4. Role: customer_support
   - View transaction journal and filters only

### Expected result
- `ledger_transactions` row moves `pending` -> `posted`.
- `ledger_entries` inserted as immutable entries.
- Reversal creates new transaction with opposite directions.
- UI shows success/error and pending button state.

### Negative test cases
- Missing idempotency header -> `428`.
- Unbalanced postings -> `409`.
- Non-existent account in postings -> `404`.
- Reverse non-posted transaction -> `409`.
- Unauthorized reverse -> `403`.

### Audit log expectations
- `transaction.posted`
- `transaction.reversed`

### Notes/dependencies
- Depends on active accounts and valid tenant scope.

---

## Module 7: General Ledger
### Purpose
Validate ledger integrity and immutability behavior behind transaction processing.

### Flow summary
- Post transaction -> create balanced entries
- Reversal -> mirror entries
- Verify immutable ledger behavior

### Roles allowed
- Operationally via transaction roles (`admin`, `ops`, `teller` create; `admin` reverse)
- Read indirectly via transaction/admin pages

### Roles restricted
- Direct mutation outside transaction APIs is not allowed in app flow

### Step-by-step test cases by role
1. Role: ops/admin
   - Post new transaction
   - Query `ledger_entries` grouped by transaction id
2. Role: admin
   - Reverse posted transaction
   - Compare original and reversal entries (direction inverted)
3. Role: customer_support/teller
   - Confirm read visibility only through transaction UI

### Expected result
- For each posted transaction: total debit == total credit.
- Ledger entries are append-only in normal flow.
- Transaction status timeline remains consistent.

### Negative test cases
- Attempt invalid posting payload (mismatched currency/amount issues) -> server rejects.
- Attempt reverse already reversed transaction idempotently -> `already_reversed` response.

### Audit log expectations
- Same as transaction module (`transaction.posted`, `transaction.reversed`).

### Notes/dependencies
- No separate GL UI page currently; GL is validated via transaction module + DB checks.

---

## Module 8: Loan Origination
### Purpose
Validate loan application creation, pipeline filtering, and decisioning.

### Flow summary
- Submit loan application
- Review pipeline
- Approve/reject/update status

### Roles allowed
- Create: `admin`, `ops`
- Decide: `admin`
- Read: `admin`, `ops` (and any role with `report:read`)

### Roles restricted
- `compliance_officer`, `teller`, `customer_support` restricted by default
- Non-admin roles cannot decide applications

### Step-by-step test cases by role
1. Role: ops/admin
   - Open `/loans`
   - Submit new application
2. Role: ops/admin
   - Use status and search filters in pipeline
3. Role: admin
   - Approve/reject an `under_review` application
4. Role: restricted roles
   - Verify unauthorized access or no action controls

### Expected result
- `loan_applications` row created with initial status `under_review`.
- Decision updates status correctly.
- UI cards update after refresh.

### Negative test cases
- Invalid principal/rate/term -> `422`.
- Non-existent customer -> `404`.
- Non-admin decision attempt -> `403`.

### Audit log expectations
- `loan.application_submitted`
- `loan.application_decided`

### Notes/dependencies
- Depends on customer existence in same tenant.

---

## Module 9: Compliance Monitoring
### Purpose
Validate compliance alert creation, triage status updates, and queue visibility.

### Flow summary
- Log compliance event
- Filter alerts by status/severity
- Update alert status through investigation lifecycle

### Roles allowed
- Create: `admin` (`compliance:manage`)
- Update: `admin`, `compliance_officer`
- Read: `admin`, `compliance_officer`

### Roles restricted
- `ops`, `teller`, `customer_support` cannot access compliance module by default

### Step-by-step test cases by role
1. Role: admin
   - Open `/compliance`
   - Create alert (`eventType`, `severity`, `summary`, optional customer)
2. Role: compliance_officer/admin
   - Update alert status `open -> in_review -> closed`
3. Role: compliance_officer/admin
   - Verify filters (status/severity/search)
4. Role: restricted roles
   - Verify unauthorized redirect and API `403`

### Expected result
- `compliance_alerts` row created and updated in DB.
- Alert queue updates after mutations.
- Feedback banners shown for create/update results.

### Negative test cases
- Invalid enum values -> `422`.
- Unauthorized create/update -> `403`.

### Audit log expectations
- `compliance.alert_created`
- `compliance.alert_status_updated`

### Notes/dependencies
- Customer-linked alerts depend on valid customer id.

---

## Module 10: Audit Logging
### Purpose
Verify that critical auth, permission, and business actions produce immutable audit records.

### Flow summary
- Trigger actions across modules
- Inspect audit tab in `/admin`
- Validate metadata and actor attribution

### Roles allowed
- Read: `admin`, `compliance_officer` (`audit:read`)
- Generate events: all roles through permitted actions

### Roles restricted
- Users without `audit:read` cannot access audit log UI

### Step-by-step test cases by role
1. Role: admin
   - Perform one action in each module (login, role change, onboarding create, account create, transaction post, loan decision, compliance update, payment create)
   - Open `/admin` -> Audit Logs tab
2. Role: compliance_officer
   - Verify read access to compliance-related events where exposed
3. Role: non-`audit:read` roles
   - Verify no direct audit access

### Expected result
- Audit table shows event with:
  - `action`
  - `resource_type`
  - `resource_id`
  - `actor_id`
  - metadata JSON
- Events ordered by `created_at desc`.

### Negative test cases
- Force failed mutation; confirm no false-success audit record is written.

### Audit log expectations
- Validate all major actions listed in prior modules.

### Notes/dependencies
- Admin page uses tenant filter; verify tenant isolation.

---

## Module 11: Admin Dashboard
### Purpose
Validate admin operational control center (metrics, role management, permission matrix, audit explorer).

### Flow summary
- Open `/admin`
- Review metrics cards
- Manage role assignments
- Search/filter user directory and audit entries

### Roles allowed
- `admin` only

### Roles restricted
- `ops`, `compliance_officer`, `teller`, `customer_support`

### Step-by-step test cases by role
1. Role: admin
   - Open `/admin` and verify all tabs render
   - Check metrics counts vs DB counts (`customers`, `accounts`, `posted transactions`, `open alerts`, `active sessions`)
2. Role: admin
   - Assign and revoke roles for a user
   - Verify directory updates and badges reflect changes
3. Role: admin
   - Use audit search + action filter
4. Role: non-admin roles
   - Verify redirect to `/unauthorized?reason=admin_permission_required`

### Expected result
- Metrics are real, not static.
- Role changes persist and sync access.
- Audit tab is filterable and accurate.

### Negative test cases
- Invalid user id/role payload -> `422`.
- Cross-tenant role mutation attempt -> `403`.

### Audit log expectations
- `permission.granted`
- `permission.revoked`

### Notes/dependencies
- Uses service role for user directory join logic; verify no client secret exposure.

---

## Module 12: Notifications
### Purpose
Validate current notifications foundation status and permission behavior.

### Flow summary
- Confirm permission model presence
- Confirm absence/presence of concrete notification module actions

### Roles allowed
- `customer_support` has `notification:send` permission in RBAC matrix

### Roles restricted
- Other roles do not rely on this permission currently

### Step-by-step test cases by role
1. Role: admin
   - Open permission matrix in `/admin` and verify `notification:send` mapped to `customer_support`
2. Role: customer_support
   - Verify there is no broken/broken-link notification page or fake action

### Expected result
- RBAC permission exists in matrix.
- No non-functional placeholder flow exposed to end users.

### Negative test cases
- If notification endpoints are introduced later, unauthorised roles must get `403`.

### Audit log expectations
- None currently tied to a dedicated notification module flow.

### Notes/dependencies
- Current state is permission foundation only; no dedicated notification UI/API workflow yet.

---

## Module 13: Payment Integration Foundation
### Purpose
Validate payment transfer creation/reconciliation in simulated-success mode with future Stripe-ready abstraction.

### Flow summary
- Create transfer from `/payments`
- Persist transfer row
- Reconcile transfer status
- Verify no live Stripe API dependency

### Roles allowed
- Create: `admin`, `ops`, `teller`
- Read/reconcile: roles with transaction/report/audit read (`admin`, `ops`, `teller`, `customer_support`)

### Roles restricted
- `compliance_officer` no payment access by default

### Step-by-step test cases by role
1. Role: ops/teller/admin
   - Open `/payments`
   - Create transfer with active account and amount
   - Verify success message and row in transfer ledger
2. Role: admin/ops/teller/customer_support
   - Click `Reconcile` on transfer
   - Verify status remains consistent and `reconciled_at` updates
3. Role: restricted role (`compliance_officer`)
   - Verify unauthorized access

### Expected result
- `payment_transfers` gets row with provider `stripe`, simulated provider reference (`sim_*`), status `succeeded`.
- `idempotency_key` dedup works on repeated request.
- No external Stripe network dependency required for successful flow.

### Negative test cases
- Missing `idempotency-key` -> `428`.
- Non-active account transfer -> `422`.
- Cross-tenant transfer request -> `403`.
- Unauthorized transfer create -> `403`.

### Audit log expectations
- `payment.initiated`
- `payment.reconciled` or `payment.provider_updated`

### Notes/dependencies
- Current implementation intentionally uses simulated payment service abstraction.
- Stripe webhook endpoint is deferred/scaffolded for future integration.

---

## Recommended order to test modules
1. Public homepage and public pages
2. Authentication and session management
3. RBAC and admin role assignment
4. Customer onboarding
5. Account management
6. Transaction processing
7. General ledger verification
8. Loan origination
9. Compliance monitoring
10. Payment integration foundation
11. Audit logging sweep
12. Notifications foundation checks
13. Full cross-module regression

## Cross-module dependency checks
- Customer onboarding completion -> account opening eligibility.
- Active accounts -> transaction and payment initiation.
- Transactions -> ledger entries integrity.
- Role changes in admin -> immediate access changes in other modules.
- Session revocation/password update -> auth behavior on next requests.
- Compliance/customer links -> alert attribution correctness.
- Every mutation -> corresponding audit event.

## Compact master end-to-end regression checklist
- [ ] Signup, login, logout, password reset/update all pass.
- [ ] Each role can access only allowed pages and actions.
- [ ] Customer onboarding full lifecycle passes with review queue.
- [ ] Accounts can be created and lifecycle transitions enforced.
- [ ] Transactions post/reverse with correct idempotency behavior.
- [ ] Ledger entries remain balanced and consistent with transactions.
- [ ] Loans can be submitted and decided per role permissions.
- [ ] Compliance alerts create/update/filter correctly.
- [ ] Admin dashboard metrics and user role management are accurate.
- [ ] Payments create/reconcile in simulated mode with DB persistence.
- [ ] Empty-state, loading, success, and error UI states appear everywhere.
- [ ] Audit logs exist for all critical actions.

## Role-permission summary matrix across modules
| Module | admin | ops | compliance_officer | teller | customer_support |
|---|---|---|---|---|---|
| Public pages | View | View | View | View | View |
| Auth/session | Full self-service | Full self-service | Full self-service | Full self-service | Full self-service |
| RBAC admin | Manage grants/revokes | Denied | Denied | Denied | Denied |
| Customer onboarding | Create/Edit/Review | Create/Edit | Review | Read-only | Read-only |
| Account management | Create/Update/Read | Create/Update/Read | Denied | Read-only | Read-only |
| Transactions | Create/Reverse/Read | Create/Read | Denied | Create/Read | Read-only |
| General ledger | Via txn create/reverse/read | Via txn create/read | Denied | Via txn create/read | Read-only via txn view |
| Loan origination | Create/Decide/Read | Create/Read | Denied | Denied | Denied |
| Compliance | Create/Update/Read | Denied | Update/Read | Denied | Denied |
| Audit logs | Read | Denied | Read | Denied | Denied |
| Admin dashboard | Full | Denied | Denied | Denied | Denied |
| Notifications foundation | View matrix/manage roles | N/A | N/A | N/A | Permission holder (`notification:send`) |
| Payments foundation | Create/Reconcile/Read | Create/Reconcile/Read | Denied | Create/Reconcile/Read | Reconcile/Read |

## Current known functional gaps to track separately
- Dedicated notifications module (UI/API for sending notifications) is not yet implemented.
- Live Stripe adapter/webhook processing is intentionally deferred; simulated-success provider is active.
