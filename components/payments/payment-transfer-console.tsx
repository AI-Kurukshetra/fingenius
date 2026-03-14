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

type TransferRecord = {
  id: string;
  accountId: string;
  accountNumber: string;
  provider: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  status: string;
  idempotencyKey: string | null;
  lastError: string | null;
  reconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentTransferConsoleProps = {
  tenantId: string;
  accounts: AccountOption[];
  transfers: TransferRecord[];
  canCreate: boolean;
  canRead: boolean;
  error?: string;
  message?: string;
};

const statusTone = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "canceled") return "danger";
  if (status === "processing") return "warning";
  if (status.startsWith("requires_")) return "info";
  return "neutral";
};

export const PaymentTransferConsole = ({
  tenantId,
  accounts,
  transfers,
  canCreate,
  canRead,
  error,
  message
}: PaymentTransferConsoleProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [reconcilingTransferId, setReconcilingTransferId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const activeAccounts = useMemo(() => {
    return accounts.filter((account) => account.status === "active");
  }, [accounts]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      const queryPass =
        transfer.accountNumber.toLowerCase().includes(query.toLowerCase()) ||
        transfer.providerReference.toLowerCase().includes(query.toLowerCase());
      const statusPass = statusFilter === "all" || transfer.status === statusFilter;

      return queryPass && statusPass;
    });
  }, [query, statusFilter, transfers]);

  const handleCreateTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsCreating(true);

    try {
      const formData = new FormData(event.currentTarget);
      const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();

      await parseApiResponse(
        await fetch("/api/v1/payments/transfers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "idempotency-key": idempotencyKey || `transfer-${Date.now().toString()}`
          },
          body: JSON.stringify({
            tenantId,
            accountId: String(formData.get("accountId") ?? ""),
            amountMinor: Number(formData.get("amountMinor") ?? 0),
            currency: String(formData.get("currency") ?? "").trim().toUpperCase(),
            description: String(formData.get("description") ?? "").trim() || undefined
          })
        })
      );

      setServerMessage("Payment recorded successfully.");
      event.currentTarget.reset();
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to initiate payment transfer."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleReconcile = async (transferId: string) => {
    setServerError(null);
    setServerMessage(null);
    setReconcilingTransferId(transferId);

    try {
      await parseApiResponse(
        await fetch("/api/v1/payments/transfers", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ transferId })
        })
      );

      setServerMessage("Transfer reconciliation refreshed.");
      router.refresh();
    } catch (requestError) {
      setServerError(requestError instanceof Error ? requestError.message : "Unable to reconcile transfer.");
    } finally {
      setReconcilingTransferId(null);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#0f172a] via-[#0b3a5e] to-[#075985] p-6 text-white shadow-[0_20px_60px_-45px_rgba(15,23,42,0.95)] sm:p-8">
        <Badge className="bg-white/20 text-white" tone="info">
          Payments
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Transfer Recording & Reconciliation</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100 sm:text-base">
          Record account-linked transfers directly in the database with simulated-success lifecycle updates.
        </p>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">Initiate Transfer</h2>
            <p className="mt-1 text-sm text-slate-500">Writes a successful payment transfer record directly to the database.</p>
          </CardHeader>
          <CardBody>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleCreateTransfer}>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Debit account</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="accountId" required>
                    <option value="">Select account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
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

                <FormField label="Description">
                  <Input name="description" type="text" />
                </FormField>

                <FormField hint="Optional custom key. If empty, one is generated." label="Idempotency key">
                  <Input name="idempotencyKey" type="text" />
                </FormField>

                <PendingSubmitButton
                  className="w-full"
                  isLoading={isCreating}
                  label="Create transfer"
                  pendingLabel="Creating..."
                />
              </form>
            ) : (
              <EmptyState
                description="Your role can view transfer status but cannot initiate new transfers."
                title="Read-only access"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Transfer Ledger</h2>
              <Badge tone="neutral">{filteredTransfers.length} transfers</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search account or transfer reference"
                value={query}
              />
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="pending">pending</option>
                <option value="processing">processing</option>
                <option value="succeeded">succeeded</option>
                <option value="failed">failed</option>
                <option value="canceled">canceled</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            {!canRead ? (
              <EmptyState
                description="You do not have permission to view transfer history."
                title="Access denied"
              />
            ) : filteredTransfers.length === 0 ? (
              <EmptyState description="No payment transfers found for current filters." title="No transfers" />
            ) : (
              <div className="space-y-3">
                {filteredTransfers.map((transfer) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={transfer.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{transfer.accountNumber}</p>
                        <p className="text-xs text-slate-500">Reference: {transfer.providerReference}</p>
                      </div>
                      <Badge tone={statusTone(transfer.status)}>{transfer.status}</Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        Amount: {transfer.amountMinor.toLocaleString()} {transfer.currency}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        Created: {new Date(transfer.createdAt).toLocaleString()}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        Reconciled: {transfer.reconciledAt ? new Date(transfer.reconciledAt).toLocaleString() : "-"}
                      </div>
                    </div>

                    {transfer.lastError ? (
                      <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {transfer.lastError}
                      </p>
                    ) : null}

                    <form
                      className="mt-3 flex flex-wrap gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleReconcile(transfer.id);
                      }}
                    >
                      <PendingSubmitButton
                        isLoading={reconcilingTransferId === transfer.id}
                        label="Reconcile"
                        pendingLabel="Reconciling..."
                      />
                    </form>
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
