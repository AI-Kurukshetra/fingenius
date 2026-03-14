# DECISIONS

## 2026-03-14 — Multi-tenant by default
All business tables include `tenant_id`; RLS enforces tenant membership checks using `(select auth.uid())`.

## 2026-03-14 — Ledger integrity over convenience
Transactions require balanced debit/credit entries before posting; ledger entries are immutable.

## 2026-03-14 — API-first boundary
All core capabilities are exposed via `app/api/v1/*` routes with Zod validation before business logic.

## 2026-03-14 — Tamper-evident audit trail
Audit records are append-only with hash-chain linkage (`event_hash`, `previous_hash`).

## 2026-03-14 — Stripe as initial payment rail
MVP supports one integration to reduce complexity while validating payment flow architecture.

## 2026-03-14 — Separate transaction intent from accounting postings
`transactions` stores business intent/state while `journal_entries` stores immutable double-entry postings against `gl_accounts` for ledger integrity.

## 2026-03-14 — Centralized RBAC with bridge tables
Use `users` + `roles` + `permissions` with `user_roles` and `role_permissions` bridges to keep permissioning explicit and auditable per tenant.

## 2026-03-14 — Versioned API with explicit domain groups
Adopt `/api/v1` and stable resource groups (`/auth`, `/customers`, `/accounts`, etc.) to keep external contracts clear while allowing internal evolution.

## 2026-03-14 — Idempotency mandatory for money movement
Require `idempotency-key` for transaction/payment creation endpoints to prevent duplicate postings on retries.

## 2026-03-14 — Centralize Supabase public connection config
Use a single helper to resolve Supabase URL + publishable key (with temporary anon-key fallback) so auth/session wiring remains consistent across browser, server, and middleware clients.

## 2026-03-14 — App-level RBAC with tenant-scoped role assignments
Use `user_role_assignments` for active role grants (`admin`, `ops`, `compliance_officer`, `teller`, `customer_support`) and map legacy `tenant_memberships.role` values as fallback during transition.

## 2026-03-14 — Session lifecycle recorded separately from Supabase cookies
Persist hashed session tokens in `auth_sessions` to support auditability and explicit session revocation during logout.

## 2026-03-14 — Prefer Turbopack compatibility over typed route experiment
Removed `experimental.typedRoutes` from Next config to keep `next dev --turbopack` working reliably in the MVP environment.

## 2026-03-14 — Seed via idempotent SQL bootstrap
Provide `supabase/seed.sql` that can be safely re-run and uses `app.bootstrap_admin_email` to bind admin privileges to an existing auth user rather than hardcoding credentials.

## 2026-03-14 — Add command-based seeding for local/dev UX
Provide `yarn seed` (`scripts/seed.mjs`) that reads existing env keys and bootstraps data without requiring manual SQL editor workflows.

## 2026-03-14 — Align with Next.js async dynamic APIs
Treat `searchParams` as async in App Router pages and `await` it to avoid runtime errors in Next.js 15/Turbopack.

## 2026-03-14 — Centralized reusable auth/admin UI primitives
Adopt in-repo UI primitives (`components/ui/*`) and interactive client modules for auth/admin/profile screens to keep premium UX consistent without changing backend business contracts.

## 2026-03-14 — Access-denied should be explicit, not silent redirect
Use a dedicated `/unauthorized` route for permission failures (e.g., admin-only areas) so users receive a clear security state and recovery path.

## 2026-03-14 — Homepage should be an authenticated product entrypoint, not a static marketing page
Design `app/page.tsx` as an interactive landing surface with auth-aware CTAs and live tenant KPI summaries (when available) while keeping backend contracts untouched and preserving existing route destinations.

## 2026-03-14 — Dual integration surface: server actions for UI and `/api/v1` for external callers
Implement each core workflow with both dashboard server actions (for first-party UX) and secure API routes (for programmatic use), both enforcing the same tenant scope and RBAC checks.

## 2026-03-14 — Redirect-query feedback for mutation UX
Use server actions that redirect with `?message=` / `?error=` plus pending submit controls so every mutation has explicit success/error feedback without silent failures.

## 2026-03-14 — Seeder-defined superadmin baseline
Treat seeded bootstrap admin as a superadmin by granting `tenant_memberships.role = platform_admin` and `user_role_assignments.role = admin`; allow the Node seeder to auto-create the auth user via service role when `SEED_SUPERADMIN_PASSWORD` is provided, while keeping SQL seeding idempotent and backward-compatible with the legacy config key.

## 2026-03-14 — Public surfaces share one auth-aware navigation shell
Use a shared `PublicLayout` + `PublicNavbar` for all unauthenticated-facing pages (`/`, `(auth)` pages, `/unauthorized`) so branding, navigation links, CTA behavior, and responsive/mobile interactions remain consistent without duplicating navbar logic per page.

## 2026-03-14 — Explicit submit type for server-action form buttons
Because shared UI buttons default to `type="button"`, any button inside a `<form action={...}>` must pass `type="submit"` explicitly to guarantee server actions (such as logout) are triggered.

## 2026-03-14 — Standardize password visibility UX through one reusable input
Use a shared password input with an eye-toggle control (`components/ui/password-input.tsx`) across auth and profile security forms so password-entry interactions remain consistent and accessible throughout public and protected surfaces.

## 2026-03-14 — Fail fast for authenticated users without tenant assignment
Do not silently redirect authenticated-but-unassigned users through dashboard pages to `/login`; instead, stop login with a clear tenant-assignment error, default email-confirm callback to `/login`, and route any authenticated/no-context dashboard access to explicit unauthorized messaging.

## 2026-03-14 — Admin access assignment must be identity-first, not UUID-first
Expose assignable users in admin UI by name/email, and when granting or revoking role access always synchronize both `user_role_assignments` and `tenant_memberships` so database access (RLS scope) and app permissions stay consistent.

## 2026-03-14 — Model super admin as platform membership + admin permissions
Treat `super_admin` as a first-class UI/API role while persisting it as `tenant_memberships.role = platform_admin` (scope authority) plus `user_role_assignments.role = admin` (app permission matrix), and preserve platform-admin membership during role-sync reconciliation.

## 2026-03-14 — Optional dev fallback for signup email-rate limits
When Supabase email sends are rate-limited, allow an explicit non-production fallback (`AUTH_ALLOW_RATE_LIMIT_SIGNUP_FALLBACK=true`) that creates users through service-role admin APIs with `email_confirm=true`; keep fallback disabled by default and preserve normal email-confirm signup in production.

## 2026-03-14 — Dashboard mutations use client API submissions with soft refresh
To avoid full-page reload UX from redirect-based server actions, dashboard forms submit via client-side `fetch` to `/api/v1` endpoints, show explicit in-form loading states, and update data with `router.refresh()`; this keeps interactions responsive while preserving server-side data reads and existing RBAC enforcement.
