# CLAUDE.md — Fingenius Core Banking MVP

> This file is read by Claude Code at the start of every conversation.
> It provides project context, rules, and conventions.

## Project Overview

Fingenius is a cloud-native core banking MVP — an API-first fintech backend for neobanks and EMIs. It provides customer onboarding, account management, double-entry ledger transactions, loan origination, compliance monitoring, and payment processing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 — strict mode |
| Database + Auth | Supabase (PostgreSQL, RLS, SSR auth) |
| Styling | Tailwind CSS v3 |
| Components | shadcn/ui primitives |
| Validation | Zod (single source of truth for schemas) |
| URL state | nuqs |
| Package manager | pnpm — never npm or yarn |
| Testing | Vitest (unit), Playwright (E2E) |
| Deployment | Vercel |

## Key Architecture Patterns

### Multi-Tenant Isolation
- Every table has `tenant_id` column
- Every query MUST include `.eq("tenant_id", tenantId)`
- RLS policies enforce tenant isolation at the database level
- Never skip tenant scoping — this is a security boundary

### Double-Entry Ledger
- All financial transactions use balanced debit/credit postings
- `ledger_transactions` + `ledger_entries` tables
- Validation: sum of debits must equal sum of credits
- Idempotency keys prevent duplicate postings

### RBAC (Role-Based Access Control)
- Roles: admin, ops, compliance_officer, teller, customer_support
- Permission matrix in `lib/auth/rbac.ts`
- Always check permissions before mutations
- Use `hasPermissionInContext()` for authorization

### Audit Logging
- Immutable SHA256 hash-chain in `audit_logs` table
- Every mutation must call `safeLogAuditEvent()`
- Never skip audit logging — it's a compliance requirement

### Onboarding State Machine
- 13-state workflow defined in `lib/onboarding/state-machine.ts`
- Transitions are role-gated
- States: draft -> profile_complete -> kyc_pending -> ... -> approved

## Project Structure

```
app/
  (auth)/           # Login, register, password reset
  (dashboard)/      # Protected pages (accounts, customers, etc.)
  api/v1/           # REST API endpoints
lib/
  auth/             # RBAC, guards, session management
  audit/            # Hash-chain verification
  ledger/           # Double-entry posting validation
  onboarding/       # State machine
  payments/         # Payment service abstraction
  supabase/         # Client/server Supabase clients
  validations/      # Zod schemas
components/
  ui/               # shadcn/ui primitives
  [feature]/        # Feature-scoped components
mcp-server/         # MCP server for AI tool access
supabase/
  migrations/       # SQL migration files
```

## Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm test:e2e     # Playwright
pnpm seed         # Bootstrap demo data
pnpm mcp          # Run MCP server
```

## Rules

### Do
- Always scope queries by `tenant_id`
- Validate all inputs with Zod before DB writes
- Log all mutations to audit trail
- Use `@/` path alias for imports
- Use Supabase server client in API routes (`lib/supabase/server.ts`)
- Check permissions before any write operation
- Support idempotency for financial operations

### Don't
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code
- Never use `any` — use `unknown` + Zod narrowing
- Never skip RLS on any table
- Never commit secrets (`.env.local` is gitignored)
- Never use npm or yarn — always pnpm
- Never bypass tenant isolation
- Never modify audit logs — they are immutable

## API Conventions

- Base path: `/api/v1`
- Auth: Bearer token via Supabase JWT
- Tenant scoping: `x-tenant-id` header
- Validation: Zod schemas in `lib/validations/`
- Response helpers: `ok(data, status)` and `fail(message, status)`
- Idempotency: `idempotency-key` header for financial operations

## Database

- Supabase PostgreSQL with RLS enabled on all tables
- Migrations in `supabase/migrations/` with timestamps
- Key tables: tenants, customers, accounts, ledger_transactions, ledger_entries, loan_applications, compliance_events, payment_transfers, audit_logs
- Schema types in `types/database.ts`
