# PRD — Core Banking MVP (Hackathon Version)

## Target Users
- Fintech operations teams at early-stage neobanks/EMIs
- Compliance officers who need visibility into risky activity
- Relationship managers onboarding SMB/retail customers
- End customers using basic account + payment + loan services

## Problem Statement
Early fintech teams struggle to launch safely because core banking capabilities are fragmented across spreadsheets, ad-hoc scripts, and disconnected tools. They need a single platform foundation that supports onboarding, account operations, transaction posting, and compliance oversight without compromising ledger integrity or auditability.

## MVP Goals
- Launch a working, API-first core banking backbone in weeks, not months
- Enable secure multi-tenant operations with role-based access control
- Support critical customer journeys: onboarding, account lifecycle, payments, and simple loans
- Preserve financial correctness with double-entry ledger rules and immutable audit trails
- Provide an internal admin view for operational control and monitoring

## User Roles
- `platform_admin`: manages platform-wide tenant setup and oversight
- `tenant_admin`: manages tenant users, permissions, and operations
- `operations`: runs account and transaction operations
- `compliance_officer`: reviews alerts, AML/sanctions flags, and audit data
- `relationship_manager`: handles onboarding and loan origination support
- `customer`: accesses own accounts, transactions, and loan applications

## Must-Have Features
- Authentication (Supabase Auth) with protected dashboard routes
- Multi-tenant-ready data model (`tenant_id`) with strict RLS policies
- RBAC enforcement for API routes and internal workflows
- Customer onboarding flow with KYC status and risk tier
- Account management (create, view, status changes)
- Transaction processing with idempotency and double-entry validation
- Immutable, tamper-evident audit logging for critical actions
- Simple loan origination (application submission + review statuses)
- Compliance monitoring (event ingestion, alerts, basic triage queue)
- Admin dashboard with key operational metrics
- API layer with Zod-validated contracts and versioned endpoints (`/api/v1`)
- One payment integration (Stripe) for transfer initiation and status tracking

## Non-Goals
- AI underwriting, fraud scoring, or autonomous decision engines
- Advanced treasury, liquidity, and complex risk modeling
- Full multi-jurisdiction regulatory automation
- High-frequency payments optimization and real-time FX engine
- Highly customized white-label frontends

## Success Metrics (First 6–8 Weeks)
- Onboarding: 80%+ of test customers complete onboarding without manual DB edits
- Reliability: 99%+ successful API requests across core MVP endpoints
- Ledger integrity: 0 unbalanced posted transactions
- Auditability: 100% of critical mutations produce audit log entries
- Compliance response: 90% of critical alerts reviewed within 24 hours (pilot)
- Delivery speed: core flows demoable end-to-end by end of phase 3

## Risks
- Schema or RLS design errors causing cross-tenant data exposure
- Incomplete idempotency handling causing duplicate transaction posting
- Missing audit logging on edge-case mutations
- Payment provider integration delays or webhook mismatch failures
- Ambiguity in compliance workflow responsibilities during pilot
- Limited test coverage under hackathon timelines

## Phased Roadmap
1. Foundation (Week 1)
- Auth, tenant model, RBAC map, RLS setup, API skeletons, audit base
2. Core Banking Flows (Weeks 2–3)
- Customer onboarding, account opening, transaction posting and reversal basics
3. Lending + Compliance (Week 4)
- Loan application lifecycle and compliance alert capture/triage
4. Admin + Payments (Week 5)
- Admin dashboard metrics and Stripe transfer workflow
5. Hardening (Week 6+)
- Test coverage, monitoring, incident playbooks, and production-readiness checks
