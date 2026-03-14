import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TransactionConsole } from "@/components/transactions/transaction-console";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Transactions | Core Banking MVP"
};

type TransactionsPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const canCreate =
    hasPermissionInContext(context, "transaction:create") ||
    hasPermissionInContext(context, "transaction:cash");
  const canRead =
    canCreate ||
    hasPermissionInContext(context, "transaction:read") ||
    hasPermissionInContext(context, "transaction:approve") ||
    hasPermissionInContext(context, "transaction:reverse");
  const canReverse = hasPermissionInContext(context, "transaction:reverse");

  if (!canRead) {
    redirect("/unauthorized?reason=transaction_permission_required");
  }

  const supabase = await createServerSupabaseClient();

  const [accountsResponse, transactionsResponse] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, account_number, currency, status")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("ledger_transactions")
      .select("id, reference, description, status, posted_at, created_at, idempotency_key")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const accounts = accountsResponse.data ?? [];
  const transactions = transactionsResponse.data ?? [];
  const transactionIds = transactions.map((transaction) => transaction.id);

  const entriesResponse = transactionIds.length
    ? await supabase
        .from("ledger_entries")
        .select("transaction_id, account_id, direction, amount_minor, currency")
        .eq("tenant_id", context.tenantId)
        .in("transaction_id", transactionIds)
    : { data: [] as Array<{ transaction_id: string; account_id: string; direction: string; amount_minor: number; currency: string }> };

  const entries = entriesResponse.data ?? [];

  const accountMap = new Map(accounts.map((account) => [account.id, account.account_number]));
  const entriesByTransaction = new Map<string, typeof entries>();

  for (const entry of entries) {
    const list = entriesByTransaction.get(entry.transaction_id) ?? [];
    list.push(entry);
    entriesByTransaction.set(entry.transaction_id, list);
  }

  return (
    <TransactionConsole
      accounts={accounts.map((account) => ({
        id: account.id,
        accountNumber: account.account_number,
        currency: account.currency,
        status: account.status
      }))}
      canCreate={canCreate}
      canReverse={canReverse}
      error={params?.error}
      message={params?.message}
      tenantId={context.tenantId}
      transactions={transactions.map((transaction) => {
        const transactionEntries = entriesByTransaction.get(transaction.id) ?? [];
        const totalMinor = transactionEntries
          .filter((entry) => entry.direction === "debit")
          .reduce((sum, entry) => sum + entry.amount_minor, 0);

        return {
          id: transaction.id,
          reference: transaction.reference,
          description: transaction.description,
          status: transaction.status,
          postedAt: transaction.posted_at,
          createdAt: transaction.created_at,
          idempotencyKey: transaction.idempotency_key,
          totalMinor,
          currency: transactionEntries[0]?.currency ?? "INR",
          entries: transactionEntries.map((entry) => ({
            accountNumber: accountMap.get(entry.account_id) ?? entry.account_id,
            direction: entry.direction as "debit" | "credit",
            amountMinor: entry.amount_minor,
            currency: entry.currency
          }))
        };
      })}
    />
  );
}
