---
name: db-check
description: >
  Check database schema, RLS policies, and migration status.
  Validates that all tables have tenant isolation, RLS enabled,
  and proper indexes. Use when adding new tables or modifying schema.
---

# Database Check Skill

## What This Does
When invoked, this skill reviews the Supabase database schema and migrations
for correctness, security, and compliance with fingenius conventions.

## Checks Performed

### 1. Tenant Isolation
- Every business table has a `tenant_id` column
- `tenant_id` is NOT NULL and references `tenants(id)`
- RLS policy exists filtering by `tenant_id`

### 2. RLS Policies
- RLS is ENABLED on every table (no exceptions)
- SELECT policies use `(select auth.uid())` for performance
- INSERT/UPDATE policies validate tenant membership

### 3. Audit Trail
- `audit_logs` table has hash chain columns (`event_hash`, `previous_hash`)
- Critical tables have triggers or application-level audit logging

### 4. Migration Safety
- Migrations are timestamped: `YYYYMMDDHHMMSS_name.sql`
- No destructive operations without explicit backup plan
- New columns have sensible defaults
- Indexes on frequently queried columns (`tenant_id`, `status`, `created_at`)

### 5. Schema Conventions
- UUIDs for primary keys (`gen_random_uuid()`)
- `created_at` with `DEFAULT now()` on all tables
- Status columns use CHECK constraints with valid enum values
- Amount columns use `_minor` suffix (stored in minor units, e.g., cents)

## How to Use
Run `/db-check` or ask Claude to "check the database schema".
It will read migrations, validate conventions, and report issues.
