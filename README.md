# Cloud-Native Core Banking MVP

## Architecture Overview

This repository is the foundation for a fintech core banking MVP designed around:

- **Authentication** with Supabase Auth (SSR-safe clients)
- **Role-based access control** via tenant memberships and role-permission mapping
- **Audit logging** with immutable records and hash chaining
- **Multi-tenant isolation** at schema and policy level (`tenant_id` + RLS)
- **API-first design** under `app/api/v1/*` with Zod-validated contracts

The initial scope prioritizes:

1. Customer onboarding
2. Account management
3. Transaction processing (ledger-backed)
4. Simple loan origination
5. Compliance monitoring
6. Admin dashboard metrics
7. Public API layer
8. One payment integration (`stripe`)

Advanced AI features are intentionally excluded at this stage.

## Core Modules

- `lib/supabase/*`: Browser/server/middleware Supabase clients
- `lib/auth/rbac.ts`: Role and permission model
- `lib/tenancy/context.ts`: Tenant context extraction and enforcement
- `lib/audit/*`: Tamper-evident audit event hashing and logger
- `lib/ledger/posting.ts`: Double-entry posting balance checks
- `lib/validations/*`: Zod schemas as contract source of truth
- `app/api/v1/*`: API-first endpoint skeletons
- `supabase/migrations/*`: Database schema, RLS, integrity controls

## Folder Structure

```text
.
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── accounts/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── loans/page.tsx
│   │   ├── compliance/page.tsx
│   │   └── admin/page.tsx
│   └── api/v1/
│       ├── onboarding/route.ts
│       ├── accounts/route.ts
│       ├── transactions/route.ts
│       ├── loans/route.ts
│       ├── compliance/events/route.ts
│       └── admin/metrics/route.ts
├── lib/
│   ├── auth/rbac.ts
│   ├── audit/{hash-chain.ts,logger.ts}
│   ├── tenancy/context.ts
│   ├── ledger/posting.ts
│   ├── validations/*.ts
│   └── supabase/{client.ts,server.ts,middleware.ts}
├── openapi/core-banking-v1.yaml
├── supabase/migrations/20260314120300_initial_core_banking_mvp.sql
└── doc/*.md
```

## MVP Plan (Phases)

1. **Phase 1: Foundation**
   - Auth plumbing, tenant model, RBAC matrix
   - RLS policies and immutable audit tables
   - API contracts and endpoint scaffolding
2. **Phase 2: Core Journeys**
   - Onboarding workflow + KYC status tracking
   - Account opening + basic lifecycle
   - Double-entry transaction posting pipeline with idempotency
3. **Phase 3: Lending + Compliance**
   - Loan application intake and underwriting statuses
   - Compliance event capture and case handling queue
4. **Phase 4: Admin + Integration**
   - Admin dashboard metrics and operational tooling
   - Stripe transfer initiation/reconciliation path
5. **Phase 5: Hardening**
   - Unit tests + E2E coverage for critical journeys
   - Monitoring/alerts, API key management, audit export

## Start

```bash
pnpm install
pnpm dev
```

## Bootstrap Empty DB

If your database has no records, run the demo seeder.

1. Ensure `.env` (or `.env.local`) has:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SEED_SUPERADMIN_EMAIL`
2. Optional: add `SEED_SUPERADMIN_PASSWORD` to auto-create this auth user if missing.
3. Run:

```bash
pnpm seed
```

This seeds:
- one tenant (`demo-bank`)
- superadmin assignment (`platform_admin` membership + `admin` role assignment)
- 2 customers
- 2 accounts
- 1 posted ledger transaction
- 1 loan application
- 1 compliance alert
- 1 payment transfer

Alternative SQL-only seed is available at [`supabase/seed.sql`](supabase/seed.sql).
