import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { assertBalancedPostings } from "@/lib/ledger/posting";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validations/transaction";

const canCreateTransaction = (permissions: string[]): boolean => {
  return permissions.includes("transaction:create") || permissions.includes("transaction:cash");
};

const canReadTransactions = (permissions: string[]): boolean => {
  return (
    canCreateTransaction(permissions) ||
    permissions.includes("transaction:read") ||
    permissions.includes("transaction:approve") ||
    permissions.includes("transaction:reverse")
  );
};

const reverseTransactionSchema = z.object({
  transactionId: z.string().uuid()
});

export async function GET(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!canReadTransactions(context.permissions)) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  let query = supabase
    .from("ledger_transactions")
    .select("id, reference, description, status, posted_at, created_at, idempotency_key")
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return fail(error.message, 500);
  }

  return ok({ items: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("idempotency-key");

  if (!idempotencyKey) {
    return fail("Missing idempotency-key header", 428);
  }

  const payload = await request.json();
  const parsed = transactionSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid transaction payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!canCreateTransaction(context.permissions)) {
    return fail("Forbidden", 403);
  }

  if (parsed.data.tenantId !== context.tenantId) {
    return fail("Tenant scope violation", 403);
  }

  try {
    assertBalancedPostings(parsed.data.postings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ledger validation failed";
    return fail(message, 409);
  }

  const supabase = await createServerSupabaseClient();

  const { data: existingByIdempotency } = await supabase
    .from("ledger_transactions")
    .select("id, reference, status")
    .eq("tenant_id", context.tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingByIdempotency?.id) {
    return ok({
      status: existingByIdempotency.status,
      reference: existingByIdempotency.reference,
      idempotencyKey,
      deduplicated: true
    });
  }

  const accountIds = [...new Set(parsed.data.postings.map((posting) => posting.accountId))];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("tenant_id", context.tenantId)
    .in("id", accountIds);

  if ((accounts ?? []).length !== accountIds.length) {
    return fail("One or more posting accounts were not found in the tenant", 404);
  }

  const { data: createdTransaction, error: transactionError } = await supabase
    .from("ledger_transactions")
    .insert({
      tenant_id: context.tenantId,
      reference: parsed.data.reference,
      description: parsed.data.description,
      status: "pending",
      idempotency_key: idempotencyKey,
      created_by: context.userId
    })
    .select("id")
    .single();

  if (transactionError || !createdTransaction?.id) {
    return fail(transactionError?.message ?? "Unable to create transaction", 409);
  }

  const { error: entriesError } = await supabase.from("ledger_entries").insert(
    parsed.data.postings.map((posting) => ({
      tenant_id: context.tenantId,
      transaction_id: createdTransaction.id,
      account_id: posting.accountId,
      direction: posting.direction,
      amount_minor: posting.amountMinor,
      currency: posting.currency
    }))
  );

  if (entriesError) {
    return fail(entriesError.message, 409);
  }

  const { error: postError } = await supabase
    .from("ledger_transactions")
    .update({ status: "posted" })
    .eq("tenant_id", context.tenantId)
    .eq("id", createdTransaction.id);

  if (postError) {
    return fail(postError.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "transaction.posted",
    resourceType: "ledger_transaction",
    resourceId: createdTransaction.id,
    metadata: {
      reference: parsed.data.reference,
      idempotencyKey,
      source: "api"
    }
  });

  return ok(
    {
      status: "queued",
      reference: parsed.data.reference,
      idempotencyKey,
      transactionId: createdTransaction.id
    },
    202
  );
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = reverseTransactionSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid reversal payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "transaction:reverse")) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();

  const { data: originalTransaction } = await supabase
    .from("ledger_transactions")
    .select("id, reference, description, status")
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.transactionId)
    .maybeSingle();

  if (!originalTransaction?.id) {
    return fail("Transaction not found", 404);
  }

  if (originalTransaction.status !== "posted") {
    return fail("Only posted transactions can be reversed", 409);
  }

  const reversalIdempotency = `reverse-${parsed.data.transactionId}`;
  const { data: existingReversal } = await supabase
    .from("ledger_transactions")
    .select("id, reference")
    .eq("tenant_id", context.tenantId)
    .eq("idempotency_key", reversalIdempotency)
    .maybeSingle();

  if (existingReversal?.id) {
    return ok({
      status: "already_reversed",
      reference: existingReversal.reference,
      transactionId: existingReversal.id
    });
  }

  const { data: originalEntries } = await supabase
    .from("ledger_entries")
    .select("account_id, direction, amount_minor, currency")
    .eq("tenant_id", context.tenantId)
    .eq("transaction_id", parsed.data.transactionId);

  if (!originalEntries || originalEntries.length < 2) {
    return fail("Unable to load original ledger entries", 409);
  }

  const reversalReference = `${originalTransaction.reference}-REV-${Date.now().toString().slice(-6)}`;

  const { data: reversalTransaction, error: reversalError } = await supabase
    .from("ledger_transactions")
    .insert({
      tenant_id: context.tenantId,
      reference: reversalReference,
      description: `Reversal of ${originalTransaction.reference}: ${originalTransaction.description}`,
      status: "pending",
      idempotency_key: reversalIdempotency,
      created_by: context.userId
    })
    .select("id")
    .single();

  if (reversalError || !reversalTransaction?.id) {
    return fail(reversalError?.message ?? "Unable to create reversal transaction", 409);
  }

  const reversalEntries = originalEntries.map((entry) => ({
    tenant_id: context.tenantId,
    transaction_id: reversalTransaction.id,
    account_id: entry.account_id,
    direction: entry.direction === "debit" ? "credit" : "debit",
    amount_minor: entry.amount_minor,
    currency: entry.currency
  }));

  const { error: reversalEntriesError } = await supabase.from("ledger_entries").insert(reversalEntries);

  if (reversalEntriesError) {
    return fail(reversalEntriesError.message, 409);
  }

  const { error: postReversalError } = await supabase
    .from("ledger_transactions")
    .update({ status: "posted" })
    .eq("tenant_id", context.tenantId)
    .eq("id", reversalTransaction.id);

  if (postReversalError) {
    return fail(postReversalError.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "transaction.reversed",
    resourceType: "ledger_transaction",
    resourceId: reversalTransaction.id,
    metadata: {
      originalTransactionId: parsed.data.transactionId,
      originalReference: originalTransaction.reference,
      source: "api"
    }
  });

  return ok({
    status: "reversed",
    reference: reversalReference,
    transactionId: reversalTransaction.id
  });
}
