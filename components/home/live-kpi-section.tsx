import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { AnimatedCounterGrid } from "./animated-counter-grid";

export const LiveKpiSection = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <EmptyState
        action={
          <div className="flex items-center justify-center gap-3">
            <Link
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/register"
            >
              Create workspace
            </Link>
            <Link
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        }
        description="Sign in to load tenant-scoped onboarding, account, transaction, and compliance KPIs."
        title="Live metrics unlock after authentication"
      />
    );
  }

  const authContext = await getAuthContext();

  if (!authContext) {
    return (
      <EmptyState
        action={
          <Link
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            href="/profile"
          >
            Review profile and tenant access
          </Link>
        }
        description="This user is authenticated but not yet assigned to an active institution role."
        title="No tenant scope available yet"
      />
    );
  }

  const tenantId = authContext.tenantId;

  const [customersResult, accountsResult, postedTransactionsResult, loansResult, alertsResult, auditResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId),
      supabase
        .from("accounts")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId),
      supabase
        .from("ledger_transactions")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("status", "posted"),
      supabase
        .from("loan_applications")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId),
      supabase
        .from("compliance_alerts")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("status", "open"),
      supabase
        .from("audit_logs")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", tenantId)
    ]);

  const firstError =
    customersResult.error ??
    accountsResult.error ??
    postedTransactionsResult.error ??
    loansResult.error ??
    alertsResult.error ??
    auditResult.error;

  if (firstError) {
    return (
      <div className="space-y-3">
        <Alert tone="error">Unable to load live tenant KPIs right now: {firstError.message}</Alert>
        <EmptyState
          action={
            <Link
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              href="/admin"
            >
              Open admin dashboard
            </Link>
          }
          description="Try again in a moment or continue in dashboard modules."
          title="Metrics temporarily unavailable"
        />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tenant visibility</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Live operating snapshot</h2>
          <p className="mt-1 text-sm text-slate-600">Securely scoped to your institution and role permissions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{authContext.roles.join(" • ")}</Badge>
          <Badge tone="neutral">Tenant {tenantId.slice(0, 8)}</Badge>
        </div>
      </div>

      <AnimatedCounterGrid
        items={[
          {
            id: "customers",
            label: "Customers",
            value: customersResult.count ?? 0,
            description: "Profiles in onboarding and lifecycle servicing"
          },
          {
            id: "accounts",
            label: "Accounts",
            value: accountsResult.count ?? 0,
            description: "Deposit and current accounts under this tenant"
          },
          {
            id: "posted_txns",
            label: "Posted Transactions",
            value: postedTransactionsResult.count ?? 0,
            description: "Ledger-balanced entries posted successfully"
          },
          {
            id: "loans",
            label: "Loan Applications",
            value: loansResult.count ?? 0,
            description: "Simple origination pipeline volume"
          },
          {
            id: "alerts",
            label: "Open Alerts",
            value: alertsResult.count ?? 0,
            description: "Compliance cases currently requiring review"
          },
          {
            id: "audits",
            label: "Audit Events",
            value: auditResult.count ?? 0,
            description: "Immutable security and operational trail"
          }
        ]}
      />
    </section>
  );
};
