/**
 * Core business-logic benchmarks.
 *
 * Run with:  pnpm vitest bench --run
 */

import { bench, describe } from "vitest";

// ─── Ledger ──────────────────────────────────────────────────────────────────
import { assertBalancedPostings, type Posting } from "../lib/ledger/posting";

// ─── Auth / RBAC ─────────────────────────────────────────────────────────────
import { hasPermission, getPermissionsForRoles, type Role } from "../lib/auth/rbac";

// ─── Audit hash chain ────────────────────────────────────────────────────────
import { computeAuditHash } from "../lib/audit/hash-chain";

// ─── Onboarding state-machine ────────────────────────────────────────────────
import {
  canTransition,
  isReviewActionAllowed,
  type OnboardingStatus,
  type OnboardingReviewAction,
} from "../lib/onboarding/state-machine";

// ─── Zod validation schemas ──────────────────────────────────────────────────
import { transactionSchema } from "../lib/validations/transaction";
import { createAccountSchema } from "../lib/validations/account";
import { loanApplicationSchema } from "../lib/validations/loan";

// ═══════════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const CUSTOMER_ID = "00000000-0000-0000-0000-000000000002";
const ACCOUNT_ID_A = "00000000-0000-0000-0000-000000000003";
const ACCOUNT_ID_B = "00000000-0000-0000-0000-000000000004";

const smallPostings: Posting[] = [
  { accountId: ACCOUNT_ID_A, direction: "debit", amountMinor: 5000, currency: "USD" },
  { accountId: ACCOUNT_ID_B, direction: "credit", amountMinor: 5000, currency: "USD" },
];

// Simulate a multi-leg transaction (e.g. fee split)
const largePostings: Posting[] = Array.from({ length: 50 }, (_, i) => ({
  accountId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  direction: (i % 2 === 0 ? "debit" : "credit") as "debit" | "credit",
  amountMinor: 1000,
  currency: "USD",
}));

const auditInput = {
  tenantId: TENANT_ID,
  actorId: CUSTOMER_ID,
  action: "transaction.create",
  resourceType: "transaction",
  resourceId: ACCOUNT_ID_A,
  at: "2025-01-01T00:00:00.000Z",
  previousHash: null,
};

const auditInputWithPrev = {
  ...auditInput,
  previousHash: "a".repeat(64),
};

const validTransaction = {
  tenantId: TENANT_ID,
  reference: "TXN-REF-001",
  description: "Wire transfer to supplier",
  postings: smallPostings,
};

const validAccount = {
  tenantId: TENANT_ID,
  customerId: CUSTOMER_ID,
  productCode: "SAVINGS" as const,
  currency: "USD",
  initialDepositMinor: 10000,
};

const validLoan = {
  tenantId: TENANT_ID,
  customerId: CUSTOMER_ID,
  principalMinor: 500000,
  termMonths: 36,
  annualRateBps: 1200,
  purpose: "Working capital loan for SME",
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Ledger — assertBalancedPostings
// ═══════════════════════════════════════════════════════════════════════════════

describe("ledger: assertBalancedPostings", () => {
  bench("2-leg transaction (small)", () => {
    assertBalancedPostings(smallPostings);
  });

  bench("50-leg transaction (large)", () => {
    assertBalancedPostings(largePostings);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Auth / RBAC
// ═══════════════════════════════════════════════════════════════════════════════

describe("rbac: hasPermission", () => {
  bench("admin — permission at start of list (best case)", () => {
    hasPermission("admin", "admin:manage_users");
  });

  bench("admin — permission at end of list (worst case)", () => {
    hasPermission("admin", "audit:read");
  });

  bench("teller — permission present", () => {
    hasPermission("teller", "transaction:cash");
  });

  bench("teller — permission NOT present (negative path)", () => {
    hasPermission("teller", "loan:approve");
  });
});

describe("rbac: getPermissionsForRoles", () => {
  bench("single role", () => {
    getPermissionsForRoles(["admin"]);
  });

  bench("all roles (max dedup work)", () => {
    getPermissionsForRoles(["admin", "ops", "compliance_officer", "teller", "customer_support"] as Role[]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Audit hash chain
// ═══════════════════════════════════════════════════════════════════════════════

describe("audit: computeAuditHash", () => {
  bench("genesis entry (no previous hash)", () => {
    computeAuditHash(auditInput);
  });

  bench("chained entry (with previous hash)", () => {
    computeAuditHash(auditInputWithPrev);
  });

  bench("chain of 100 sequential hashes", () => {
    let prev: string | null = null;
    for (let i = 0; i < 100; i++) {
      prev = computeAuditHash({ ...auditInput, previousHash: prev });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Onboarding state machine
// ═══════════════════════════════════════════════════════════════════════════════

describe("state-machine: canTransition", () => {
  bench("valid transition (early in list)", () => {
    canTransition("draft", "profile_complete");
  });

  bench("valid transition (multi-target state)", () => {
    canTransition("kyc_submitted", "kyc_verified");
  });

  bench("invalid transition (no match)", () => {
    canTransition("kyc_rejected", "approved");
  });

  bench("1000 transition checks", () => {
    const pairs: [OnboardingStatus, OnboardingStatus][] = [
      ["draft", "profile_complete"],
      ["kyc_submitted", "kyc_rejected"],
      ["aml_submitted", "aml_approved"],
      ["compliance_review", "approved"],
      ["kyc_rejected", "approved"], // invalid
    ];
    for (let i = 0; i < 1000; i++) {
      const [from, to] = pairs[i % pairs.length];
      canTransition(from, to);
    }
  });
});

describe("state-machine: isReviewActionAllowed", () => {
  bench("allowed action (match at index 0)", () => {
    isReviewActionAllowed("kyc_approve", "kyc_submitted");
  });

  bench("allowed action (match at index 1)", () => {
    isReviewActionAllowed("aml_approve", "compliance_review");
  });

  bench("disallowed action (no match)", () => {
    isReviewActionAllowed("compliance_approve", "draft" as OnboardingStatus);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Zod schema validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("zod: transactionSchema.parse", () => {
  bench("valid 2-leg transaction", () => {
    transactionSchema.parse(validTransaction);
  });

  bench("invalid transaction (catches error)", () => {
    transactionSchema.safeParse({ tenantId: "not-a-uuid", postings: [] });
  });
});

describe("zod: createAccountSchema.parse", () => {
  bench("valid account creation", () => {
    createAccountSchema.parse(validAccount);
  });
});

describe("zod: loanApplicationSchema.parse", () => {
  bench("valid loan application", () => {
    loanApplicationSchema.parse(validLoan);
  });
});
