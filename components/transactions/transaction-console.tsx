"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { parseApiResponse } from "@/lib/api/client";

type AccountOption = {
  id: string;
  accountNumber: string;
  currency: string;
  status: string;
};

type TransactionEntry = {
  accountNumber: string;
  direction: "debit" | "credit";
  amountMinor: number;
  currency: string;
};

type TransactionRecord = {
  id: string;
  reference: string;
  description: string;
  status: string;
  postedAt: string | null;
  createdAt: string;
  idempotencyKey: string | null;
  totalMinor: number;
  currency: string;
  entries: TransactionEntry[];
};

type TransactionConsoleProps = {
  tenantId: string;
  accounts: AccountOption[];
  transactions: TransactionRecord[];
  canCreate: boolean;
  canReverse: boolean;
  error?: string;
  message?: string;
};

const toneForStatus = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => {
  if (status === "posted") return "success";
  if (status === "pending") return "warning";
  if (status === "reversed") return "danger";
  return "neutral";
};

export const TransactionConsole = ({
  tenantId,
  accounts,
  transactions,
  canCreate,
  canReverse,
  error,
  message
}: TransactionConsoleProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [reversingTransactionId, setReversingTransactionId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const activeAccounts = useMemo(() => {
    return accounts.filter((account) => account.status === "active");
  }, [accounts]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const queryPass =
        transaction.reference.toLowerCase().includes(query.toLowerCase()) ||
        transaction.description.toLowerCase().includes(query.toLowerCase());
      const statusPass = statusFilter === "all" || transaction.status === statusFilter;

      return queryPass && statusPass;
    });
  }, [query, statusFilter, transactions]);

  const handleCreateTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsCreating(true);

    try {
      const formData = new FormData(event.currentTarget);
      const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();

      await parseApiResponse(
        await fetch("/api/v1/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "idempotency-key": idempotencyKey || `web-${Date.now().toString()}`
          },
          body: JSON.stringify({
            tenantId,
            reference: String(formData.get("reference") ?? "").trim(),
            description: String(formData.get("description") ?? "").trim(),
            postings: [
              {
                accountId: String(formData.get("debitAccountId") ?? ""),
                direction: "debit",
                amountMinor: Number(formData.get("amountMinor") ?? 0),
                currency: String(formData.get("currency") ?? "")
                  .trim()
                  .toUpperCase()
              },
              {
                accountId: String(formData.get("creditAccountId") ?? ""),
                direction: "credit",
                amountMinor: Number(formData.get("amountMinor") ?? 0),
                currency: String(formData.get("currency") ?? "")
                  .trim()
                  .toUpperCase()
              }
            ]
          })
        })
      );

      setServerMessage("Transaction posted successfully.");
      event.currentTarget.reset();
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to post transaction."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleReverseTransaction = async (transactionId: string) => {
    setServerError(null);
    setServerMessage(null);
    setReversingTransactionId(transactionId);

    try {
      await parseApiResponse(
        await fetch("/api/v1/transactions", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            transactionId
          })
        })
      );

      setServerMessage("Reversal posted.");
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to reverse transaction."
      );
    } finally {
      setReversingTransactionId(null);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#1e293b] via-[#0f3d4c] to-[#0b3a5e] p-6 text-white shadow-[0_20px_60px_-45px_rgba(15,23,42,0.95)] sm:p-8">
        <Badge className="bg-white/20 text-white" tone="info">
          Ledger Transactions
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Posting, Review, and Reversal</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100 sm:text-base">
          Execute balanced postings, monitor statuses, and reverse entries with full audit visibility.
        </p>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">Create Transaction</h2>
            <p className="mt-1 text-sm text-slate-500">Writes to `ledger_transactions` and immutable `ledger_entries`.</p>
          </CardHeader>
          <CardBody>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleCreateTransaction}>
                <FormField label="Reference">
                  <Input minLength={6} name="reference" required type="text" />
                </FormField>
                <FormField label="Description">
                  <Input minLength={3} name="description" required type="text" />
                </FormField>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Debit Account</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="debitAccountId" required>
                    <option value="">Select debit account</option>
                    {activeAccounts.map((account) => (
                      <option key={`debit-${account.id}`} value={account.id}>
                        {account.accountNumber} ({account.currency})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Credit Account</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="creditAccountId" required>
                    <option value="">Select credit account</option>
                    {activeAccounts.map((account) => (
                      <option key={`credit-${account.id}`} value={account.id}>
                        {account.accountNumber} ({account.currency})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Amount (minor units)">
                    <Input min={1} name="amountMinor" required type="number" />
                  </FormField>
                  <FormField label="Currency">
                    <Input defaultValue="INR" maxLength={3} minLength={3} name="currency" required type="text" />
                  </FormField>
                </div>

                <FormField hint="Optional idempotency override" label="Idempotency Key">
                  <Input name="idempotencyKey" type="text" />
                </FormField>

                <PendingSubmitButton
                  className="w-full"
                  isLoading={isCreating}
                  label="Post Transaction"
                  pendingLabel="Posting..."
                />
              </form>
            ) : (
              <EmptyState
                description="Your role can view transaction history but cannot create new postings."
                title="Read-only access"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Transaction Journal</h2>
              <Badge tone="neutral">{filteredTransactions.length} entries</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reference or description"
                value={query}
              />
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="pending">pending</option>
                <option value="posted">posted</option>
                <option value="reversed">reversed</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            {filteredTransactions.length === 0 ? (
              <EmptyState
                description="No transactions match current filters."
                title="No transactions"
              />
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={transaction.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{transaction.reference}</p>
                        <p className="text-xs text-slate-500">{transaction.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={toneForStatus(transaction.status)}>{transaction.status}</Badge>
                        <Badge tone="info">
                          {transaction.totalMinor.toLocaleString()} {transaction.currency}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {transaction.entries.slice(0, 2).map((entry, index) => (
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700" key={`${transaction.id}-${index}`}>
                          <span className="font-semibold uppercase">{entry.direction}</span>: {entry.accountNumber} · {entry.amountMinor.toLocaleString()} {entry.currency}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Created: {new Date(transaction.createdAt).toLocaleString()}</span>
                      <span>Posted: {transaction.postedAt ? new Date(transaction.postedAt).toLocaleString() : "-"}</span>
                      <span className="font-mono">{transaction.idempotencyKey ?? "no-idempotency"}</span>
                    </div>

                    {canReverse && transaction.status === "posted" ? (
                      <form
                        className="mt-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleReverseTransaction(transaction.id);
                        }}
                      >
                        <PendingSubmitButton
                          isLoading={reversingTransactionId === transaction.id}
                          label="Reverse"
                          pendingLabel="Reversing..."
                          variant="danger"
                        />
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
};
