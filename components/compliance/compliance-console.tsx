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

type AlertRecord = {
  id: string;
  customerName: string;
  eventType: string;
  severity: string;
  status: string;
  summary: string;
  createdAt: string;
};

type ComplianceConsoleProps = {
  tenantId: string;
  customers: CustomerOption[];
  alerts: AlertRecord[];
  canCreate: boolean;
  canUpdate: boolean;
  error?: string;
  message?: string;
};

const severityTone = (severity: string): "danger" | "warning" | "info" | "success" | "neutral" => {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "info";
};

const statusTone = (status: string): "danger" | "warning" | "info" | "success" | "neutral" => {
  if (status === "closed") return "success";
  if (status === "in_review") return "warning";
  if (status === "open") return "danger";
  return "neutral";
};

export const ComplianceConsole = ({
  tenantId,
  customers,
  alerts,
  canCreate,
  canUpdate,
  error,
  message
}: ComplianceConsoleProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const queryPass =
        alert.summary.toLowerCase().includes(query.toLowerCase()) ||
        alert.customerName.toLowerCase().includes(query.toLowerCase()) ||
        alert.eventType.toLowerCase().includes(query.toLowerCase());
      const statusPass = statusFilter === "all" || alert.status === statusFilter;
      const severityPass = severityFilter === "all" || alert.severity === severityFilter;

      return queryPass && statusPass && severityPass;
    });
  }, [alerts, query, severityFilter, statusFilter]);

  const handleCreateAlert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setServerError(null);
    setServerMessage(null);
    setIsCreating(true);

    try {
      const formData = new FormData(form);
      await parseApiResponse(
        await fetch("/api/v1/compliance/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tenantId,
            eventType: String(formData.get("eventType") ?? ""),
            severity: String(formData.get("severity") ?? ""),
            subjectId: String(formData.get("customerId") ?? "").trim() || undefined,
            summary: String(formData.get("summary") ?? "").trim()
          })
        })
      );

      setServerMessage("Compliance alert logged.");
      form?.reset?.();
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to create compliance alert."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateAlertStatus = async (alertId: string, status: string) => {
    setServerError(null);
    setServerMessage(null);
    setUpdatingAlertId(alertId);

    try {
      await parseApiResponse(
        await fetch("/api/v1/compliance/events", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            alertId,
            status
          })
        })
      );

      setServerMessage(`Compliance alert marked as ${status}.`);
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to update alert status."
      );
    } finally {
      setUpdatingAlertId(null);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#450a0a] via-[#7f1d1d] to-[#92400e] p-6 text-white shadow-[0_20px_60px_-45px_rgba(69,10,10,0.9)] sm:p-8">
        <Badge className="bg-white/20 text-white" tone="info">
          Compliance Monitoring
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">AML / KYC Event Caseboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-amber-100 sm:text-base">
          Capture compliance events, prioritize alerts, and update investigation statuses with full traceability.
        </p>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">Log Compliance Event</h2>
            <p className="mt-1 text-sm text-slate-500">Write directly to the tenant compliance queue.</p>
          </CardHeader>
          <CardBody>
            {canCreate ? (
              <form className="space-y-3" onSubmit={handleCreateAlert}>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Customer (optional)</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="customerId">
                    <option value="">No linked customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.fullName} ({customer.externalCustomerRef})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Event Type</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="eventType">
                      <option value="kyc_pending">kyc_pending</option>
                      <option value="aml_flag">aml_flag</option>
                      <option value="sanctions_hit">sanctions_hit</option>
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Severity</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="severity">
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                </div>

                <FormField label="Summary">
                  <Input minLength={3} name="summary" required type="text" />
                </FormField>

                <PendingSubmitButton
                  className="w-full"
                  isLoading={isCreating}
                  label="Log Event"
                  pendingLabel="Logging..."
                />
              </form>
            ) : (
              <EmptyState
                description="Your role can review alerts but cannot create new events."
                title="Read-only access"
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Alert Queue</h2>
              <Badge tone="neutral">{filteredAlerts.length} alerts</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search summary/customer"
                value={query}
              />
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="open">open</option>
                <option value="in_review">in_review</option>
                <option value="closed">closed</option>
              </select>
              <select
                className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                onChange={(event) => setSeverityFilter(event.target.value)}
                value={severityFilter}
              >
                <option value="all">All severities</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </div>
          </CardHeader>
          <CardBody>
            {filteredAlerts.length === 0 ? (
              <EmptyState
                description="No compliance alerts found for the selected filters."
                title="No alerts"
              />
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={alert.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{alert.summary}</p>
                        <p className="text-xs text-slate-500">
                          {alert.customerName} · {alert.eventType}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
                        <Badge tone={statusTone(alert.status)}>{alert.status}</Badge>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">Created: {new Date(alert.createdAt).toLocaleString()}</p>

                    {canUpdate ? (
                      <form
                        className="mt-3 flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const formData = new FormData(event.currentTarget);
                          void handleUpdateAlertStatus(alert.id, String(formData.get("status") ?? "open"));
                        }}
                      >
                        <select className="h-10 rounded-xl border border-slate-300 px-3 text-sm" name="status" defaultValue={alert.status}>
                          <option value="open">open</option>
                          <option value="in_review">in_review</option>
                          <option value="closed">closed</option>
                        </select>
                        <PendingSubmitButton
                          isLoading={updatingAlertId === alert.id}
                          label="Update"
                          pendingLabel="Updating..."
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
