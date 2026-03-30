---
name: refactor
description: >
  Refactor code for better readability, performance, or maintainability.
  Follows fingenius patterns: tenant isolation, Zod validation, RBAC,
  and double-entry ledger conventions.
---

# Refactor Skill

## What This Does
When invoked, this skill analyzes specified code and suggests or applies
refactoring improvements while preserving all existing behavior.

## Refactoring Principles

### 1. Safety First
- Never change behavior — only structure
- Run `pnpm typecheck` after every change
- Verify tenant isolation is maintained
- Ensure audit logging is preserved

### 2. Common Refactoring Patterns

**Extract shared query builders:**
```typescript
// Before: repeated in every API route
const { data, error } = await supabase
  .from("accounts")
  .select("*")
  .eq("tenant_id", tenantId)

// After: reusable helper
const { data, error } = await tenantQuery(supabase, "accounts", tenantId)
  .select("*")
```

**Consolidate validation:**
```typescript
// Before: inline validation
if (!body.tenantId) return fail("Missing tenantId", 400)
if (!body.customerId) return fail("Missing customerId", 400)

// After: Zod schema
const parsed = MySchema.safeParse(body)
if (!parsed.success) return fail(parsed.error.message, 422)
```

**Simplify permission checks:**
```typescript
// Before: repeated permission logic
if (!hasPermissionInContext(ctx, "account:create") &&
    !hasPermissionInContext(ctx, "admin:manage")) {
  return fail("Forbidden", 403)
}

// After: helper with multiple permissions
if (!hasAnyPermission(ctx, ["account:create", "admin:manage"])) {
  return fail("Forbidden", 403)
}
```

### 3. What NOT to Refactor
- Working audit logging — even if verbose
- RLS policies — changes need migration
- Ledger posting logic — financial correctness > elegance
- Zod schemas — they're the source of truth

## How to Use
Run `/refactor <file-or-description>` or ask Claude to "refactor this code".
It will analyze, suggest changes, and apply them with safety checks.
