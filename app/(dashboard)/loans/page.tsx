import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoanOriginationConsole } from "@/components/loans/loan-origination-console";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Loans | Core Banking MVP"
};

type LoansPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoansPage({ searchParams }: LoansPageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const canCreate =
    hasPermissionInContext(context, "loan:write") || hasPermissionInContext(context, "loan:approve");
  const canRead = canCreate || hasPermissionInContext(context, "report:read");
  const canDecide = hasPermissionInContext(context, "loan:approve");

  if (!canRead) {
    redirect("/unauthorized?reason=loan_permission_required");
  }

  const supabase = await createServerSupabaseClient();

  const [customersResponse, loansResponse] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, external_customer_ref")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("loan_applications")
      .select("id, customer_id, principal_minor, term_months, annual_rate_bps, purpose, status, created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(250)
  ]);

  const customers = customersResponse.data ?? [];
  const customerMap = new Map(customers.map((customer) => [customer.id, customer.full_name]));

  return (
    <LoanOriginationConsole
      canCreate={canCreate}
      canDecide={canDecide}
      customers={customers.map((customer) => ({
        id: customer.id,
        fullName: customer.full_name,
        externalCustomerRef: customer.external_customer_ref
      }))}
      error={params?.error}
      loans={(loansResponse.data ?? []).map((loan) => ({
        id: loan.id,
        customerName: customerMap.get(loan.customer_id) ?? loan.customer_id,
        principalMinor: loan.principal_minor,
        termMonths: loan.term_months,
        annualRateBps: loan.annual_rate_bps,
        purpose: loan.purpose,
        status: loan.status,
        createdAt: loan.created_at
      }))}
      message={params?.message}
      tenantId={context.tenantId}
    />
  );
}
