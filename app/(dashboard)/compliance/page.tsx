import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ComplianceConsole } from "@/components/compliance/compliance-console";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Compliance | Core Banking MVP"
};

type CompliancePageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function CompliancePage({ searchParams }: CompliancePageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const canCreate = hasPermissionInContext(context, "compliance:manage");
  const canUpdate =
    canCreate ||
    hasPermissionInContext(context, "kyc:review") ||
    hasPermissionInContext(context, "aml:review");
  const canRead = canUpdate || hasPermissionInContext(context, "audit:read");

  if (!canRead) {
    redirect("/unauthorized?reason=compliance_permission_required");
  }

  const supabase = await createServerSupabaseClient();

  const [alertsResponse, customersResponse] = await Promise.all([
    supabase
      .from("compliance_alerts")
      .select("id, customer_id, event_type, severity, status, summary, created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("customers")
      .select("id, full_name, external_customer_ref")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(250)
  ]);

  const customers = customersResponse.data ?? [];
  const customerMap = new Map(customers.map((customer) => [customer.id, customer.full_name]));

  return (
    <ComplianceConsole
      alerts={(alertsResponse.data ?? []).map((alert) => ({
        id: alert.id,
        customerName: alert.customer_id ? customerMap.get(alert.customer_id) ?? alert.customer_id : "Unlinked",
        eventType: alert.event_type,
        severity: alert.severity,
        status: alert.status,
        summary: alert.summary,
        createdAt: alert.created_at
      }))}
      canCreate={canCreate}
      canUpdate={canUpdate}
      customers={customers.map((customer) => ({
        id: customer.id,
        fullName: customer.full_name,
        externalCustomerRef: customer.external_customer_ref
      }))}
      error={params?.error}
      message={params?.message}
      tenantId={context.tenantId}
    />
  );
}
