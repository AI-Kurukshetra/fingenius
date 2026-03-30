# Architecture Overview — Fingenius Core Banking

## System Architecture

```
                    ┌─────────────────────┐
                    │   Vercel (Edge)      │
                    │   middleware.ts       │
                    │   Session refresh     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Next.js App Router │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │ (auth) pages   │  │  Public: login, register
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ (dashboard)    │  │  Protected: all features
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ api/v1/*       │  │  REST API endpoints
                    │  └────────────────┘  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
    │  Auth Layer     │  │  Business   │  │  Audit      │
    │  RBAC + Guards  │  │  Logic      │  │  Hash Chain │
    │  lib/auth/      │  │  lib/       │  │  lib/audit/ │
    └─────────┬──────┘  └─────┬──────┘  └──────┬──────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Supabase          │
                    │   PostgreSQL + RLS  │
                    │   Auth              │
                    │   Storage           │
                    └─────────────────────┘
```

## Key Design Decisions

### 1. Multi-Tenant by Default
Every table includes `tenant_id`. RLS policies enforce isolation at the database
level. Application code adds a second layer with `.eq("tenant_id", tenantId)`.
This double-enforcement prevents data leaks even if one layer has a bug.

### 2. Double-Entry Ledger
Financial transactions use a proper double-entry system. Every transaction has
balanced debit/credit entries. This ensures the books always balance and provides
a complete audit trail. Balances are derived from ledger entries, never stored
as a single mutable number.

### 3. Immutable Audit Trail
Audit logs use SHA256 hash chaining — each event includes the hash of the
previous event. This creates a tamper-evident chain. If any past event is
modified, all subsequent hashes break. This is critical for regulatory
compliance.

### 4. API-First Design
The frontend consumes the same `/api/v1` REST endpoints that external clients
would use. This means the backend can be decoupled and exposed to third parties
without any changes.

### 5. State Machine for Onboarding
Customer onboarding follows a strict state machine with 13 states. Transitions
are role-gated (e.g., only compliance_officer can approve KYC). This prevents
invalid state changes and provides a clear audit trail of who approved what.

### 6. Simulated Payments
Payment processing uses an adapter pattern. Currently a `SimulatedPaymentService`
handles all payments (instant success). When ready, a real Stripe adapter can be
swapped in without changing any calling code.
