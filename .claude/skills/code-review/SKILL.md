---
name: code-review
description: >
  Review code changes for correctness, security, and convention compliance.
  Checks for: tenant isolation, audit logging, RBAC, Zod validation,
  TypeScript strictness, and Supabase best practices.
---

# Code Review Skill

## What This Does
When invoked, this skill reviews the current git diff (or specified files) against
the fingenius project conventions and security requirements.

## Review Checklist

### 1. Security
- [ ] All queries scoped by `tenant_id` — no cross-tenant data leaks
- [ ] Service role key never exposed to client code
- [ ] All user inputs validated with Zod before DB writes
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] Sensitive data not logged or exposed in error messages

### 2. Financial Integrity
- [ ] Ledger transactions are balanced (debits = credits)
- [ ] Idempotency keys used for financial operations
- [ ] Audit logging present for all mutations (`safeLogAuditEvent`)
- [ ] No direct balance modifications — only through ledger postings

### 3. Authorization
- [ ] Permission checks before write operations (`hasPermissionInContext`)
- [ ] Role-gated state transitions in onboarding
- [ ] API routes check auth context before processing

### 4. TypeScript Quality
- [ ] No `any` types — use `unknown` with narrowing
- [ ] No `!` non-null assertions — handle nulls explicitly
- [ ] Types inferred from Zod schemas where possible
- [ ] Strict mode compliance

### 5. Conventions
- [ ] Uses `@/` path alias
- [ ] Server client used in API routes (not browser client)
- [ ] Error responses use `fail()` helper
- [ ] Success responses use `ok()` helper
- [ ] pnpm used (not npm/yarn)

## How to Use
Run `/code-review` or ask Claude to "review my changes". It will:
1. Run `git diff` to see what changed
2. Read the changed files
3. Check each item on the checklist above
4. Report findings with file:line references
