import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PaymentTransferConsole } from "@/components/payments/payment-transfer-console";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Payments | Core Banking MVP"
};

const PAYMENT_TRANSFER_SELECT_BASE =
  "id, account_id, provider, provider_reference, amount_minor, currency, status, created_at";
const PAYMENT_TRANSFER_SELECT_FULL = `${PAYMENT_TRANSFER_SELECT_BASE}, idempotency_key, last_error, reconciled_at, updated_at`;

type PaymentsPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

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

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const canCreate = canCreateTransfers(context.permissions);
  const canRead = canReadTransfers(context.permissions);

  if (!canRead) {
    redirect("/unauthorized?reason=transaction_permission_required");
  }

  const supabase = await createServerSupabaseClient();

  const [accountsResponse, initialTransfersResponse] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, account_number, currency, status")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("payment_transfers")
      .select(PAYMENT_TRANSFER_SELECT_FULL)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(250)
  ]);

  const transfersResponse =
    initialTransfersResponse.error && hasMissingColumnError(initialTransfersResponse.error.message)
      ? await supabase
          .from("payment_transfers")
          .select(PAYMENT_TRANSFER_SELECT_BASE)
          .eq("tenant_id", context.tenantId)
          .order("created_at", { ascending: false })
          .limit(250)
      : initialTransfersResponse;

  const accounts = accountsResponse.data ?? [];
  const accountMap = new Map(accounts.map((account) => [account.id, account.account_number]));

  return (
    <PaymentTransferConsole
      accounts={accounts.map((account) => ({
        id: account.id,
        accountNumber: account.account_number,
        currency: account.currency,
        status: account.status
      }))}
      canCreate={canCreate}
      canRead={canRead}
      error={params?.error}
      message={params?.message}
      tenantId={context.tenantId}
      transfers={(transfersResponse.data ?? []).map((transfer) => ({
        id: transfer.id,
        accountId: transfer.account_id,
        accountNumber: accountMap.get(transfer.account_id) ?? transfer.account_id,
        provider: transfer.provider,
        providerReference: transfer.provider_reference,
        amountMinor: transfer.amount_minor,
        currency: transfer.currency,
        status: transfer.status,
        idempotencyKey: (transfer as { idempotency_key?: string | null }).idempotency_key ?? null,
        lastError: (transfer as { last_error?: string | null }).last_error ?? null,
        reconciledAt: (transfer as { reconciled_at?: string | null }).reconciled_at ?? null,
        createdAt: transfer.created_at,
        updatedAt: (transfer as { updated_at?: string }).updated_at ?? transfer.created_at
      }))}
    />
  );
}
