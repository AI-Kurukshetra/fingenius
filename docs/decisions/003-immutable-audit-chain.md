# ADR-003: Immutable Audit Log with Hash Chain

## Status
Accepted

## Context
Regulatory compliance requires a tamper-evident audit trail. We need to prove
that no historical events have been modified after the fact.

## Decision
Use **SHA256 hash chaining** for audit logs:
- Each audit event includes `event_hash` (SHA256 of current event data)
- Each event includes `previous_hash` (hash of the preceding event)
- This creates a blockchain-like chain where modifying any past event
  breaks all subsequent hashes
- Verification function in `lib/audit/hash-chain.ts`

## Consequences
- Tamper-evident: any modification to past events is detectable
- Compliance-friendly: meets audit trail requirements
- Append-only: audit logs can never be updated or deleted
- Verification is O(n) — acceptable for compliance checks
- Hash chain must be per-tenant to avoid cross-tenant dependencies
