"use client";

import Link from "next/link";
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

type CustomerRecord = {
  id: string;
  externalCustomerRef: string;
  fullName: string;
  email: string;
  kycStatus: string;
  riskTier: string;
  onboardingStatus: string;
  createdAt: string;
};

type CustomerOnboardingConsoleProps = {
  tenantId: string;
  customers: CustomerRecord[];
  canCreate: boolean;
  canReviewQueue?: boolean;
  error?: string;
  message?: string;
};

const toneForKyc = (kycStatus: string): "warning" | "success" | "info" | "danger" | "neutral" => {
  if (kycStatus === "verified") return "success";
  if (kycStatus === "rejected") return "danger";
  if (kycStatus === "pending") return "warning";
  return "neutral";
};

export const CustomerOnboardingConsole = ({
  tenantId,
  customers,
  canCreate,
  canReviewQueue,
  error,
  message
}: CustomerOnboardingConsoleProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kycFilter, setKycFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const queryPass =
        customer.fullName.toLowerCase().includes(query.toLowerCase()) ||
        customer.email.toLowerCase().includes(query.toLowerCase()) ||
        customer.externalCustomerRef.toLowerCase().includes(query.toLowerCase());
      const kycPass = kycFilter === "all" || customer.kycStatus === kycFilter;

      return queryPass && kycPass;
    });
  }, [customers, kycFilter, query]);

  const handleCreateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsCreating(true);

    try {
      const formData = new FormData(event.currentTarget);
      await parseApiResponse(
        await fetch("/api/v1/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tenantId,
            externalCustomerRef: String(formData.get("externalCustomerRef") ?? "").trim(),
            fullName: String(formData.get("fullName") ?? "").trim(),
            email: String(formData.get("email") ?? "")
              .trim()
              .toLowerCase(),
            countryCode: String(formData.get("countryCode") ?? "")
              .trim()
              .toUpperCase(),
            riskTier: String(formData.get("riskTier") ?? "medium")
          })
        })
      );

      setServerMessage("Customer onboarding record created.");
      event.currentTarget.reset();
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to create customer record."
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#042f4b] via-[#075985] to-[#0f766e] p-6 text-white shadow-[0_20px_60px_-45px_rgba(4,47,75,0.9)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className="bg-white/20 text-white" tone="info">
              Customer Onboarding
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Customer Registry & KYC Intake</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100 sm:text-base">
          Capture customer details, track KYC state, and create tenant-scoped onboarding records.
            </p>
          </div>
          {canReviewQueue && (
            <Link
              className="rounded-xl border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              href="/customers/queue"
            >
              Review queue
            </Link>
          )}
        </div>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">New Customer</h2>
            <p className="mt-1 text-sm text-slate-500">Create a real onboarding record in the database.</p>
          </CardHeader>
          <CardBody>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleCreateCustomer}>
                <FormField label="External Reference">
                  <Input name="externalCustomerRef" required type="text" />
                </FormField>
                <FormField label="Full Name">
                  <Input name="fullName" required type="text" />
                </FormField>
                <FormField label="Email">
                  <Input name="email" required type="email" />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Country Code">
                    <Input defaultValue="IN" maxLength={2} minLength={2} name="countryCode" required type="text" />
                  </FormField>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Risk Tier</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="riskTier">
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                </div>
                <PendingSubmitButton
                  className="w-full"
                  isLoading={isCreating}
                  label="Create Customer"
                  pendingLabel="Creating..."
                />
              </form>
            ) : (
              <EmptyState
                description="Your role can view customer records but cannot create new onboarding entries."
                title="Read-only access"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Customer Records</h2>
              <Badge tone="neutral">{filteredCustomers.length} records</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, reference"
                value={query}
              />
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setKycFilter(event.target.value)}
                value={kycFilter}
              >
                <option value="all">All KYC statuses</option>
                <option value="pending">pending</option>
                <option value="verified">verified</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            {filteredCustomers.length === 0 ? (
              <EmptyState
                description="No customer records are available for this tenant and filter set."
                title="No customers"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-2 pr-3 font-medium">Reference</th>
                      <th className="pb-2 pr-3 font-medium">Customer</th>
                      <th className="pb-2 pr-3 font-medium">Onboarding</th>
                      <th className="pb-2 pr-3 font-medium">KYC</th>
                      <th className="pb-2 pr-3 font-medium">Risk</th>
                      <th className="pb-2 pr-3 font-medium">Created</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr className="border-b border-slate-100" key={customer.id}>
                        <td className="py-3 pr-3 font-mono text-xs text-slate-700">{customer.externalCustomerRef}</td>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-slate-800">{customer.fullName}</p>
                          <p className="text-xs text-slate-500">{customer.email}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge tone="neutral">{customer.onboardingStatus}</Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge tone={toneForKyc(customer.kycStatus)}>{customer.kycStatus}</Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge tone="info">{customer.riskTier}</Badge>
                        </td>
                        <td className="py-3 text-slate-600">{new Date(customer.createdAt).toLocaleString()}</td>
                        <td className="py-3">
                          <Link
                            className="text-sm font-medium text-cyan-700 hover:underline"
                            href={`/customers/${customer.id}`}
                          >
                            Open
                          </Link>
                        </td>
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
