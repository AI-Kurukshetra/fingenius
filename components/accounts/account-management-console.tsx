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

type CustomerOption = {
  id: string;
  fullName: string;
  externalCustomerRef: string;
};

type AccountRecord = {
  id: string;
  accountNumber: string;
  customerName: string;
  productCode: string;
  currency: string;
  status: string;
  createdAt: string;
};

type AccountManagementConsoleProps = {
  tenantId: string;
  accounts: AccountRecord[];
  customers: CustomerOption[];
  canCreate: boolean;
  error?: string;
  message?: string;
};

const toneForStatus = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "frozen") return "danger";
  return "neutral";
};

export const AccountManagementConsole = ({
  tenantId,
  accounts,
  customers,
  canCreate,
  error,
  message
}: AccountManagementConsoleProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const queryPass =
        account.accountNumber.toLowerCase().includes(query.toLowerCase()) ||
        account.customerName.toLowerCase().includes(query.toLowerCase()) ||
        account.productCode.toLowerCase().includes(query.toLowerCase());
      const statusPass = statusFilter === "all" || account.status === statusFilter;
      const productPass = productFilter === "all" || account.productCode === productFilter;

      return queryPass && statusPass && productPass;
    });
  }, [accounts, productFilter, query, statusFilter]);

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsCreating(true);

    try {
      const formData = new FormData(event.currentTarget);
      await parseApiResponse(
        await fetch("/api/v1/accounts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tenantId,
            customerId: String(formData.get("customerId") ?? ""),
            productCode: String(formData.get("productCode") ?? "SAVINGS"),
            currency: String(formData.get("currency") ?? "")
              .trim()
              .toUpperCase(),
            initialDepositMinor: Number(formData.get("initialDepositMinor") ?? 0)
          })
        })
      );

      setServerMessage("Account created.");
      event.currentTarget.reset();
      router.refresh();
    } catch (requestError) {
      setServerError(requestError instanceof Error ? requestError.message : "Unable to create account.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#082f49] via-[#0c4a6e] to-[#115e59] p-6 text-white shadow-[0_20px_60px_-45px_rgba(8,47,73,0.9)] sm:p-8">
        <Badge className="bg-white/20 text-white" tone="info">
          Account Operations
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Account Creation & Portfolio View</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100 sm:text-base">
          Open tenant-scoped customer accounts and monitor product status across the portfolio.
        </p>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">Open Account</h2>
            <p className="mt-1 text-sm text-slate-500">Account writes persist directly to the live tenant ledger domain.</p>
          </CardHeader>
          <CardBody>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleCreateAccount}>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Customer</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="customerId" required>
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.fullName} ({customer.externalCustomerRef})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Product</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="productCode">
                      <option value="SAVINGS">SAVINGS</option>
                      <option value="CURRENT">CURRENT</option>
                      <option value="LOAN">LOAN</option>
                    </select>
                  </label>

                  <FormField label="Currency">
                    <Input defaultValue="INR" maxLength={3} minLength={3} name="currency" required type="text" />
                  </FormField>
                </div>

                <FormField hint="Captured for audit trail context" label="Initial Deposit (minor units)">
                  <Input defaultValue="0" min={0} name="initialDepositMinor" required type="number" />
                </FormField>

                <PendingSubmitButton
                  className="w-full"
                  isLoading={isCreating}
                  label="Create Account"
                  pendingLabel="Creating..."
                />
              </form>
            ) : (
              <EmptyState
                description="Your role can view account data but cannot create new accounts."
                title="Read-only access"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Account Portfolio</h2>
              <Badge tone="neutral">{filteredAccounts.length} accounts</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search account/customer"
                value={query}
              />
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="frozen">frozen</option>
                <option value="closed">closed</option>
              </select>
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setProductFilter(event.target.value)}
                value={productFilter}
              >
                <option value="all">All products</option>
                <option value="SAVINGS">SAVINGS</option>
                <option value="CURRENT">CURRENT</option>
                <option value="LOAN">LOAN</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            {filteredAccounts.length === 0 ? (
              <EmptyState
                description="No accounts available for the current filter set."
                title="No accounts"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-2 pr-3 font-medium">Account Number</th>
                      <th className="pb-2 pr-3 font-medium">Customer</th>
                      <th className="pb-2 pr-3 font-medium">Product</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr className="border-b border-slate-100" key={account.id}>
                        <td className="py-3 pr-3 font-mono text-xs text-slate-700">{account.accountNumber}</td>
                        <td className="py-3 pr-3 text-slate-800">{account.customerName}</td>
                        <td className="py-3 pr-3 text-slate-700">{account.productCode}</td>
                        <td className="py-3 pr-3">
                          <Badge tone={toneForStatus(account.status)}>{account.status}</Badge>
                        </td>
                        <td className="py-3 text-slate-600">{new Date(account.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
};
