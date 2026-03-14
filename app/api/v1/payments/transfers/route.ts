import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext } from "@/lib/auth/guards";
import { getPaymentService } from "@/lib/payments/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createPaymentTransferSchema,
  reconcilePaymentTransferSchema
} from "@/lib/validations/payment";
import type { Json } from "@/types/database";

const PAYMENT_TRANSFER_SELECT_BASE =
  "id, account_id, provider, provider_reference, amount_minor, currency, status, created_at";
const PAYMENT_TRANSFER_SELECT_FULL = `${PAYMENT_TRANSFER_SELECT_BASE}, idempotency_key, last_error, reconciled_at, updated_at, metadata`;

const canCreateTransfers = (permissions: string[]): boolean => {
  return permissions.includes("transaction:create") || permissions.includes("transaction:cash");
};

const canReadTransfers = (permissions: string[]): boolean => {
  return (
    canCreateTransfers(permissions) ||
    permissions.includes("transaction:read") ||
    permissions.includes("report:read") ||
    permissions.includes("audit:read")
  );
};

const hasMissingColumnError = (message: string): boolean => {
  return /Could not find the '.*' column/i.test(message);
};

const mapTransfer = (
  row: {
    id: string;
    account_id: string;
    provider: string;
    provider_reference: string;
    amount_minor: number;
    currency: string;
    status: string;
    created_at: string;
    idempotency_key?: string | null;
    last_error?: string | null;
    reconciled_at?: string | null;
    updated_at?: string | null;
  },
  accountNumber: string | undefined
) => {
  return {
    id: row.id,
    accountId: row.account_id,
    accountNumber: accountNumber ?? row.account_id,
    provider: row.provider,
    providerReference: row.provider_reference,
    amountMinor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key ?? null,
    lastError: row.last_error ?? null,
    reconciledAt: row.reconciled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
};

export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!canReadTransfers(auth.permissions)) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  let query = supabase
    .from("payment_transfers")
    .select(PAYMENT_TRANSFER_SELECT_FULL)
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const primaryResult = await query;
  const fallbackResult =
    primaryResult.error && hasMissingColumnError(primaryResult.error.message)
      ? await (async () => {
          let fallbackQuery = supabase
            .from("payment_transfers")
            .select(PAYMENT_TRANSFER_SELECT_BASE)
            .eq("tenant_id", auth.tenantId)
            .order("created_at", { ascending: false })
            .limit(200);

          if (status) {
            fallbackQuery = fallbackQuery.eq("status", status);
          }

          return fallbackQuery;
        })()
      : null;

  const { data, error } = fallbackResult ?? primaryResult;
  if (error) return fail(error.message, 500);

  const accountIds = [...new Set((data ?? []).map((row) => row.account_id))];
  const { data: accountRows, error: accountError } = accountIds.length
    ? await supabase
        .from("accounts")
        .select("id, account_number")
        .eq("tenant_id", auth.tenantId)
        .in("id", accountIds)
    : { data: [], error: null };

  if (accountError) return fail(accountError.message, 500);

  const accountMap = new Map((accountRows ?? []).map((row) => [row.id, row.account_number]));

  return ok({
    items: (data ?? []).map((row) => mapTransfer(row, accountMap.get(row.account_id))),
    count: data?.length ?? 0
  });
}

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return fail("Missing idempotency-key header", 428);

  const payload = await request.json();
  const parsed = createPaymentTransferSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payment transfer payload", 422);
  }

  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!canCreateTransfers(auth.permissions)) return fail("Forbidden", 403);
  if (parsed.data.tenantId !== auth.tenantId) return fail("Tenant scope violation", 403);

  const supabase = await createServerSupabaseClient();
  let canUseIdempotencyColumn = true;
  let existingByKey:
    | {
        id: string;
        account_id: string;
        provider: string;
        provider_reference: string;
        amount_minor: number;
        currency: string;
        status: string;
        created_at: string;
        idempotency_key?: string | null;
        last_error?: string | null;
        reconciled_at?: string | null;
        updated_at?: string | null;
      }
    | null = null;

  const existingByKeyResult = await supabase
    .from("payment_transfers")
    .select(PAYMENT_TRANSFER_SELECT_FULL)
    .eq("tenant_id", auth.tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingByKeyResult.error) {
    if (hasMissingColumnError(existingByKeyResult.error.message)) {
      canUseIdempotencyColumn = false;
    } else {
      return fail(existingByKeyResult.error.message, 500);
    }
  } else {
    existingByKey = existingByKeyResult.data;
  }

  if (existingByKey?.id) {
    return ok({
      transfer: mapTransfer(existingByKey, undefined),
      deduplicated: true
    });
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, account_number, status")
    .eq("tenant_id", auth.tenantId)
    .eq("id", parsed.data.accountId)
    .maybeSingle();

  if (accountError) return fail(accountError.message, 500);
  if (!account) return fail("Account not found", 404);
  if (account.status !== "active") return fail("Payments can only be initiated from active accounts", 422);

  // TODO(payments): when Stripe is enabled, keep this route unchanged and switch
  // `getPaymentService()` to a Stripe-backed adapter implementation.
  const paymentService = getPaymentService();
  const simulatedPayment = await paymentService.createTransfer({
    tenantId: auth.tenantId,
    userId: auth.userId,
    accountId: parsed.data.accountId,
    accountNumber: account.account_number,
    amountMinor: parsed.data.amountMinor,
    currency: parsed.data.currency,
    description: parsed.data.description,
    idempotencyKey
  });

  const fullInsertPayload = {
    tenant_id: auth.tenantId,
    account_id: parsed.data.accountId,
    provider: simulatedPayment.provider,
    provider_reference: simulatedPayment.providerReference,
    amount_minor: parsed.data.amountMinor,
    currency: parsed.data.currency,
    status: simulatedPayment.status,
    ...(canUseIdempotencyColumn ? { idempotency_key: idempotencyKey } : {}),
    last_error: simulatedPayment.lastError,
    reconciled_at: simulatedPayment.reconciledAt,
    metadata: simulatedPayment.metadata
  };

  const baseInsertPayload = {
    tenant_id: auth.tenantId,
    account_id: parsed.data.accountId,
    provider: simulatedPayment.provider,
    provider_reference: simulatedPayment.providerReference,
    amount_minor: parsed.data.amountMinor,
    currency: parsed.data.currency,
    status: simulatedPayment.status
  };

  let insertResult = await supabase
    .from("payment_transfers")
    .insert(fullInsertPayload)
    .select(PAYMENT_TRANSFER_SELECT_BASE)
    .single();

  if (insertResult.error && hasMissingColumnError(insertResult.error.message)) {
    insertResult = await supabase
      .from("payment_transfers")
      .insert(baseInsertPayload)
      .select(PAYMENT_TRANSFER_SELECT_BASE)
      .single();
  }

  const created = insertResult.data;
  const insertError = insertResult.error;

  if (insertError || !created) {
    return fail(insertError?.message ?? "Unable to persist payment transfer", 409);
  }

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: "payment.initiated",
    resourceType: "payment_transfer",
    resourceId: created.id,
    metadata: {
      provider: simulatedPayment.provider,
      providerReference: simulatedPayment.providerReference,
      amountMinor: parsed.data.amountMinor,
      status: simulatedPayment.status,
      mode: "simulated",
      idempotencyPersisted: canUseIdempotencyColumn
    }
  });

  return ok(
    {
      transfer: mapTransfer(created, account.account_number),
      clientSecret: simulatedPayment.clientSecret,
      deduplicated: false
    },
    201
  );
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = reconcilePaymentTransferSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid reconciliation payload", 422);
  }

  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!canReadTransfers(auth.permissions)) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  let canUseExtendedColumns = true;
  let transferResult = await supabase
    .from("payment_transfers")
    .select("id, provider_reference, status, metadata")
    .eq("tenant_id", auth.tenantId)
    .eq("id", parsed.data.transferId)
    .maybeSingle();

  if (transferResult.error && hasMissingColumnError(transferResult.error.message)) {
    canUseExtendedColumns = false;
    transferResult = await supabase
      .from("payment_transfers")
      .select("id, provider_reference, status")
      .eq("tenant_id", auth.tenantId)
      .eq("id", parsed.data.transferId)
      .maybeSingle();
  }

  const transfer = transferResult.data;
  const transferError = transferResult.error;
  if (transferError) return fail(transferError.message, 500);
  if (!transfer) return fail("Payment transfer not found", 404);

  // TODO(payments): route-level contract is stable; Stripe reconciliation will plug in via service adapter.
  const paymentService = getPaymentService();
  const reconciled = await paymentService.reconcileTransfer({
    transferId: transfer.id,
    providerReference: transfer.provider_reference,
    currentStatus: transfer.status,
    metadata: (transfer as { metadata?: Json }).metadata
  });

  let updateResult = await supabase
    .from("payment_transfers")
    .update({
      status: reconciled.status,
      ...(canUseExtendedColumns
        ? {
            last_error: reconciled.lastError,
            reconciled_at: reconciled.reconciledAt,
            metadata: reconciled.metadata,
            updated_at: new Date().toISOString()
          }
        : {})
    })
    .eq("tenant_id", auth.tenantId)
    .eq("id", transfer.id)
    .select(PAYMENT_TRANSFER_SELECT_BASE)
    .single();

  if (updateResult.error && hasMissingColumnError(updateResult.error.message)) {
    updateResult = await supabase
      .from("payment_transfers")
      .update({ status: reconciled.status })
      .eq("tenant_id", auth.tenantId)
      .eq("id", transfer.id)
      .select(PAYMENT_TRANSFER_SELECT_BASE)
      .single();
  }

  const updated = updateResult.data;
  const updateError = updateResult.error;

  if (updateError || !updated) {
    return fail(updateError?.message ?? "Unable to update payment transfer", 409);
  }

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: transfer.status === reconciled.status ? "payment.reconciled" : "payment.provider_updated",
    resourceType: "payment_transfer",
    resourceId: transfer.id,
    metadata: {
      previousStatus: transfer.status,
      status: reconciled.status,
      providerReference: transfer.provider_reference,
      mode: "simulated"
    }
  });

  return ok({ transfer: mapTransfer(updated, undefined) });
}
