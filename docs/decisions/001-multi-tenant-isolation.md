# ADR-001: Multi-Tenant Isolation Strategy

## Status
Accepted

## Context
Fingenius serves multiple organizations (tenants). Each tenant's data must be
completely isolated — a user in Tenant A must never see Tenant B's data.

## Decision
Use **shared database with row-level isolation**:
- Every business table has a `tenant_id` UUID column
- Supabase RLS policies filter rows by tenant
- Application code also filters by `tenant_id` (defense in depth)
- Tenant context extracted from JWT in API middleware

## Consequences
- Simple deployment (single database)
- RLS + application filtering provides two layers of protection
- Must be disciplined: every new table needs `tenant_id` + RLS
- Cannot do tenant-specific schema customization (acceptable for MVP)
