# TASKS

Status key: `[ ]` todo, `[x]` done, `[~]` in-progress, `[!]` blocked

- [x] [2026-03-14 12:03] Bootstrap project foundation (Next.js + TypeScript + Tailwind + Supabase + Zod + pnpm)
- [x] [2026-03-14 12:03] Define API-first folder structure and initial endpoint scaffolding
- [x] [2026-03-14 12:03] Propose initial multi-tenant schema with RBAC, ledger, audit, and RLS
- [x] [2026-03-14 12:09] Write concise hackathon PRD with users, goals, roles, features, metrics, risks, and phased roadmap
- [x] [2026-03-14 12:11] Design detailed MVP database schema blueprint for all core entities and relationships
- [x] [2026-03-14 12:16] Create grouped MVP API design with endpoints, examples, auth, validation, errors, and audit logging requirements
- [x] [2026-03-14 12:21] Update DB/auth connection wiring to Supabase public config (URL + publishable key) without changing business logic/routes
- [x] [2026-03-14 12:29] Implement authentication + authorization layer (Supabase auth flows, RBAC guards, session tracking, permission admin flow, auth audit events, starter auth UI)
- [x] [2026-03-14 12:29] Implement Supabase auth UI and session flows
- [x] [2026-03-14 12:35] Remove Turbopack-incompatible Next config option (`experimental.typedRoutes`)
- [x] [2026-03-14 12:42] Add idempotent Supabase seeder for empty DB bootstrap and admin role provisioning by email
- [x] [2026-03-14 12:48] Add `yarn seed` command using env-file Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_EMAIL`)
- [x] [2026-03-14 12:52] Fix Next.js 15 async dynamic API usage by awaiting `searchParams` in auth/admin pages
- [x] [2026-03-14 13:05] Upgrade auth/authz UI to polished fintech experience (interactive auth flows, admin control center, audit explorer, profile/security center, unauthorized screen, reusable UI system)
- [x] [2026-03-14 13:20] Redesign and implement interactive fintech landing homepage with auth-aware CTAs, live tenant KPI section, feature explorer, trust/integration/FAQ modules, and production navigation wiring
- [x] [2026-03-14 14:05] Implement customer onboarding end-to-end (API + DB writes + UI)
- [x] [2026-03-14 14:05] Implement account opening and account detail workflows
- [x] [2026-03-14 14:05] Implement ledger transaction posting and reversal operations
- [x] [2026-03-14 14:05] Implement simple loan origination workflow
- [x] [2026-03-14 14:05] Implement compliance alert triage workflow
- [x] [2026-03-14 14:05] Build admin dashboard with operational metrics
- [x] [2026-03-14 14:10] Add superadmin bootstrap support in SQL + Node seeders (auto-create auth user option, platform_admin membership, admin role assignment)
- [x] [2026-03-14 14:19] Add shared public layout + responsive auth-aware navbar across homepage, auth pages, and unauthorized route
- [x] [2026-03-14 14:24] Fix dashboard sign-out button to submit logout server action correctly
- [x] [2026-03-14 14:29] Add eye-toggle password visibility control across auth and profile password inputs
- [x] [2026-03-14 14:34] Fix login loop for authenticated users without tenant assignment by returning explicit login error and unauthorized guard
- [x] [2026-03-14 14:44] Implement admin user directory and UI-based access assignment flow (no UUID input) with tenant membership + role sync
- [x] [2026-03-14 14:48] Add explicit `super_admin` visibility/management flow in admin UI with backend mapping to `platform_admin` membership
- [x] [2026-03-14 15:06] Handle Supabase signup email-rate-limit with clearer UX and optional dev fallback user creation
- [x] [2026-03-14 15:20] Eliminate full-page reloads on dashboard mutations by switching forms to client API submits with loading indicators and soft refresh
- [ ] Integrate Stripe payments and reconciliation lifecycle
- [ ] Add unit tests (Vitest) for validations, API handlers, and ledger logic
- [ ] Add Playwright E2E tests for critical user journeys
