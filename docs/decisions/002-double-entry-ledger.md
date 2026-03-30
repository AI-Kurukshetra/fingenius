# ADR-002: Double-Entry Ledger for Transactions

## Status
Accepted

## Context
Financial transactions need to be accurate, auditable, and tamper-evident.
A simple "update balance" approach is error-prone and doesn't provide an
audit trail.

## Decision
Implement a **double-entry bookkeeping** system:
- `ledger_transactions` — the transaction header (reference, status, etc.)
- `ledger_entries` — individual debit/credit postings
- Every transaction must have balanced entries (sum of debits = sum of credits)
- Validation enforced in `lib/ledger/posting.ts` before any DB write
- Idempotency keys prevent duplicate postings on retry

## Consequences
- Books always balance — mathematical guarantee
- Full audit trail of every financial movement
- Slightly more complex than simple balance updates
- Requires understanding of debit/credit accounting
- Account balances derived by summing entries (can be cached/materialized later)
