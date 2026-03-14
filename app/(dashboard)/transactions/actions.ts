"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { assertBalancedPostings } from "@/lib/ledger/posting";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createTransactionFormSchema = z
  .object({
    reference: z.string().min(6).max(80),
    description: z.string().min(3).max(200),
    debitAccountId: z.string().uuid(),
    creditAccountId: z.string().uuid(),
    amountMinor: z.coerce.number().int().positive(),
    currency: z.string().length(3),
    idempotencyKey: z.string().min(3).max(120).optional()
  })
  .refine((input) => input.debitAccountId !== input.creditAccountId, {
    message: "Debit and credit accounts must be different",
    path: ["creditAccountId"]
  });

const reverseTransactionSchema = z.object({
  transactionId: z.string().uuid()
});

const backToTransactionsWithError = (message: string): never => {
  redirect(`/transactions?error=${encodeURIComponent(message)}`);
};

const backToTransactionsWithMessage = (message: string): never => {
  redirect(`/transactions?message=${encodeURIComponent(message)}`);
};

const canCreateTransaction = (permissions: string[]): boolean => {
  return permissions.includes("transaction:create") || permissions.includes("transaction:cash");
};

export const createTransactionAction = async (formData: FormData): Promise<void> => {
  const parsed = createTransactionFormSchema.safeParse({
    reference: String(formData.get("reference") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    debitAccountId: String(formData.get("debitAccountId") ?? "").trim(),
    creditAccountId: String(formData.get("creditAccountId") ?? "").trim(),
    amountMinor: formData.get("amountMinor"),
    currency: String(formData.get("currency") ?? "").trim().toUpperCase(),
    idempotencyKey: String(formData.get("idempotencyKey") ?? "").trim() || undefined
  });

  const values = parsed.success
    ? parsed.data
    : backToTransactionsWithError(parsed.error.issues[0]?.message ?? "Invalid transaction payload");

  const context = await getAuthContext();
  const authContext = context ?? backToTransactionsWithError("Unauthenticated");

  if (!canCreateTransaction(authContext.permissions)) {
    backToTransactionsWithError("You do not have permission to create transactions.");
  }

  const supabase = await createServerSupabaseClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("tenant_id", authContext.tenantId)
    .in("id", [values.debitAccountId, values.creditAccountId]);

  if ((accounts ?? []).length < 2) {
    backToTransactionsWithError("One or more accounts were not found for this tenant.");
  }

  const postings = [
    {
      accountId: values.debitAccountId,
      direction: "debit" as const,
      amountMinor: values.amountMinor,
      currency: values.currency
    },
    {
      accountId: values.creditAccountId,
      direction: "credit" as const,
      amountMinor: values.amountMinor,
      currency: values.currency
    }
  ];

  try {
    assertBalancedPostings(postings);
  } catch (error) {
    backToTransactionsWithError(error instanceof Error ? error.message : "Unbalanced postings");
  }

  const idempotencyKey =
    values.idempotencyKey ?? `web-${authContext.userId.slice(0, 8)}-${Date.now().toString()}`;

  const { data: existingByIdempotency } = await supabase
    .from("ledger_transactions")
    .select("id, reference")
    .eq("tenant_id", authContext.tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingByIdempotency?.id) {
    backToTransactionsWithMessage(`Duplicate prevented. Existing transaction ${existingByIdempotency.reference} returned.`);
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("ledger_transactions")
    .insert({
      tenant_id: authContext.tenantId,
      reference: values.reference,
      description: values.description,
      status: "pending",
      idempotency_key: idempotencyKey,
      created_by: authContext.userId
    })
    .select("id")
    .single();

  if (transactionError || !transaction?.id) {
    backToTransactionsWithError(transactionError?.message ?? "Unable to create transaction");
  }
  const transactionId =
    transaction?.id ?? backToTransactionsWithError("Unable to create transaction");

  const { error: entriesError } = await supabase.from("ledger_entries").insert([
    {
      tenant_id: authContext.tenantId,
      transaction_id: transactionId,
      account_id: values.debitAccountId,
      direction: "debit",
      amount_minor: values.amountMinor,
      currency: values.currency
    },
    {
      tenant_id: authContext.tenantId,
      transaction_id: transactionId,
      account_id: values.creditAccountId,
      direction: "credit",
      amount_minor: values.amountMinor,
      currency: values.currency
    }
  ]);

  if (entriesError) {
    backToTransactionsWithError(entriesError.message);
  }

  const { error: postError } = await supabase
    .from("ledger_transactions")
    .update({ status: "posted" })
    .eq("tenant_id", authContext.tenantId)
    .eq("id", transactionId);

  if (postError) {
    backToTransactionsWithError(postError.message);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "transaction.posted",
    resourceType: "ledger_transaction",
    resourceId: transactionId,
    metadata: {
      reference: values.reference,
      amountMinor: values.amountMinor,
      currency: values.currency
    }
  });

  revalidatePath("/transactions");
  backToTransactionsWithMessage(`Transaction ${values.reference} posted successfully.`);
};

export const reverseTransactionAction = async (formData: FormData): Promise<void> => {
  const parsed = reverseTransactionSchema.safeParse({
    transactionId: String(formData.get("transactionId") ?? "").trim()
  });

  const values = parsed.success
    ? parsed.data
    : backToTransactionsWithError(parsed.error.issues[0]?.message ?? "Invalid reversal request");

  const context = await getAuthContext();
  const authContext = context ?? backToTransactionsWithError("Unauthenticated");

  if (!hasPermissionInContext(authContext, "transaction:reverse")) {
    backToTransactionsWithError("You do not have permission to reverse transactions.");
  }

  const supabase = await createServerSupabaseClient();

  const { data: originalTransaction } = await supabase
    .from("ledger_transactions")
    .select("id, reference, description, status")
    .eq("tenant_id", authContext.tenantId)
    .eq("id", values.transactionId)
    .maybeSingle();

  if (!originalTransaction?.id) {
    backToTransactionsWithError("Transaction not found.");
  }
  const resolvedOriginalTransaction =
    originalTransaction ?? backToTransactionsWithError("Transaction not found.");

  if (resolvedOriginalTransaction.status !== "posted") {
    backToTransactionsWithError("Only posted transactions can be reversed.");
  }

  const reversalIdempotency = `reverse-${values.transactionId}`;
  const { data: existingReversal } = await supabase
    .from("ledger_transactions")
    .select("id, reference")
    .eq("tenant_id", authContext.tenantId)
    .eq("idempotency_key", reversalIdempotency)
    .maybeSingle();

  if (existingReversal?.id) {
    backToTransactionsWithMessage(`Reversal already exists as ${existingReversal.reference}.`);
  }

  const { data: originalEntries } = await supabase
    .from("ledger_entries")
    .select("account_id, direction, amount_minor, currency")
    .eq("tenant_id", authContext.tenantId)
    .eq("transaction_id", values.transactionId);

  if (!originalEntries || originalEntries.length < 2) {
    backToTransactionsWithError("Unable to load original ledger entries.");
  }
  const resolvedOriginalEntries =
    originalEntries ?? backToTransactionsWithError("Unable to load original ledger entries.");

  const reversalReference = `${resolvedOriginalTransaction.reference}-REV-${Date.now().toString().slice(-6)}`;

  const { data: reversalTransaction, error: reversalError } = await supabase
    .from("ledger_transactions")
    .insert({
      tenant_id: authContext.tenantId,
      reference: reversalReference,
      description: `Reversal of ${resolvedOriginalTransaction.reference}: ${resolvedOriginalTransaction.description}`,
      status: "pending",
      idempotency_key: reversalIdempotency,
      created_by: authContext.userId
    })
    .select("id")
    .single();

  if (reversalError || !reversalTransaction?.id) {
    backToTransactionsWithError(reversalError?.message ?? "Unable to create reversal transaction");
  }
  const reversalTransactionId =
    reversalTransaction?.id ??
    backToTransactionsWithError("Unable to create reversal transaction");

  const reversalEntries = resolvedOriginalEntries.map((entry) => ({
    tenant_id: authContext.tenantId,
    transaction_id: reversalTransactionId,
    account_id: entry.account_id,
    direction: entry.direction === "debit" ? "credit" : "debit",
    amount_minor: entry.amount_minor,
    currency: entry.currency
  }));

  const { error: reversalEntriesError } = await supabase.from("ledger_entries").insert(reversalEntries);

  if (reversalEntriesError) {
    backToTransactionsWithError(reversalEntriesError.message);
  }

  const { error: postReversalError } = await supabase
    .from("ledger_transactions")
    .update({ status: "posted" })
    .eq("tenant_id", authContext.tenantId)
    .eq("id", reversalTransactionId);

  if (postReversalError) {
    backToTransactionsWithError(postReversalError.message);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "transaction.reversed",
    resourceType: "ledger_transaction",
    resourceId: reversalTransactionId,
    metadata: {
      originalTransactionId: values.transactionId,
      originalReference: resolvedOriginalTransaction.reference
    }
  });

  revalidatePath("/transactions");
  backToTransactionsWithMessage(`Reversal posted as ${reversalReference}.`);
};
