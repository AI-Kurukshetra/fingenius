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

type LoanRecord = {
  id: string;
  customerName: string;
  principalMinor: number;
  termMonths: number;
  annualRateBps: number;
  purpose: string;
  status: string;
  createdAt: string;
};

type LoanOriginationConsoleProps = {
  tenantId: string;
  customers: CustomerOption[];
  loans: LoanRecord[];
  canCreate: boolean;
  canDecide: boolean;
  error?: string;
  message?: string;
};

const toneForStatus = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "submitted" || status === "under_review") return "warning";
  if (status === "disbursed") return "info";
  return "neutral";
};

export const LoanOriginationConsole = ({
  tenantId,
  customers,
  loans,
  canCreate,
  canDecide,
  error,
  message
}: LoanOriginationConsoleProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [decidingLoanId, setDecidingLoanId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const queryPass =
        loan.customerName.toLowerCase().includes(query.toLowerCase()) ||
        loan.purpose.toLowerCase().includes(query.toLowerCase());
      const statusPass = statusFilter === "all" || loan.status === statusFilter;

      return queryPass && statusPass;
    });
  }, [loans, query, statusFilter]);

  const handleCreateLoan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setServerError(null);
    setServerMessage(null);
    setIsCreating(true);

    try {
      const formData = new FormData(form);
      await parseApiResponse(
        await fetch("/api/v1/loans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tenantId,
            customerId: String(formData.get("customerId") ?? ""),
            principalMinor: Number(formData.get("principalMinor") ?? 0),
            termMonths: Number(formData.get("termMonths") ?? 0),
            annualRateBps: Number(formData.get("annualRateBps") ?? 0),
            purpose: String(formData.get("purpose") ?? "").trim()
          })
        })
      );

      setServerMessage("Loan application submitted.");
      form?.reset?.();
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to submit loan application."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDecision = async (loanId: string, decision: "approved" | "rejected") => {
    setServerError(null);
    setServerMessage(null);
    setDecidingLoanId(loanId);

    try {
      await parseApiResponse(
        await fetch("/api/v1/loans", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            loanId,
            decision
          })
        })
      );

      setServerMessage(`Loan ${decision}.`);
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to update loan decision."
      );
    } finally {
      setDecidingLoanId(null);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#1d4ed8] via-[#0f766e] to-[#14532d] p-6 text-white shadow-[0_20px_60px_-45px_rgba(29,78,216,0.9)] sm:p-8">
        <Badge className="bg-white/20 text-white" tone="info">
          Loan Origination
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Application Intake and Decisioning</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100 sm:text-base">
          Submit and process loan applications with tenant-level access control and audit events.
        </p>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">New Loan Application</h2>
            <p className="mt-1 text-sm text-slate-500">Write directly to the loan pipeline table.</p>
          </CardHeader>
          <CardBody>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleCreateLoan}>
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
                  <FormField label="Principal (minor)">
                    <Input min={1} name="principalMinor" required type="number" />
                  </FormField>
                  <FormField label="Term (months)">
                    <Input max={360} min={1} name="termMonths" required type="number" />
                  </FormField>
                </div>

                <FormField label="Annual Rate (bps)">
                  <Input max={10000} min={1} name="annualRateBps" required type="number" />
                </FormField>

                <FormField label="Purpose">
                  <Input minLength={3} name="purpose" required type="text" />
                </FormField>

                <PendingSubmitButton
                  className="w-full"
                  isLoading={isCreating}
                  label="Submit Application"
                  pendingLabel="Submitting..."
                />
              </form>
            ) : (
              <EmptyState
                description="Your role can view loan records but cannot submit new applications."
                title="Read-only access"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Loan Pipeline</h2>
              <Badge tone="neutral">{filteredLoans.length} applications</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customer or purpose"
                value={query}
              />
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="submitted">submitted</option>
                <option value="under_review">under_review</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="disbursed">disbursed</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            {filteredLoans.length === 0 ? (
              <EmptyState
                description="No loan applications match the current filter."
                title="No loans"
              />
            ) : (
              <div className="space-y-3">
                {filteredLoans.map((loan) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={loan.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{loan.customerName}</p>
                        <p className="text-xs text-slate-500">{loan.purpose}</p>
                      </div>
                      <Badge tone={toneForStatus(loan.status)}>{loan.status}</Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">Principal: {loan.principalMinor.toLocaleString()}</div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">Term: {loan.termMonths} months</div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">Rate: {loan.annualRateBps} bps</div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">Created: {new Date(loan.createdAt).toLocaleString()}</p>

                    {canDecide && (loan.status === "submitted" || loan.status === "under_review") ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleDecision(loan.id, "approved");
                          }}
                        >
                          <PendingSubmitButton
                            isLoading={decidingLoanId === loan.id}
                            label="Approve"
                            pendingLabel="Applying..."
                          />
                        </form>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleDecision(loan.id, "rejected");
                          }}
                        >
                          <PendingSubmitButton
                            isLoading={decidingLoanId === loan.id}
                            label="Reject"
                            pendingLabel="Applying..."
                            variant="danger"
                          />
                        </form>
                      </div>
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
