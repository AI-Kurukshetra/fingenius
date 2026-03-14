import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomerOnboardingConsole } from "@/components/customers/customer-onboarding-console";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customers | Core Banking MVP"
};

type CustomersPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const canCreate = hasPermissionInContext(context, "customer:write");
  const canRead = canCreate || hasPermissionInContext(context, "customer:read");
  const canReview =
    hasPermissionInContext(context, "kyc:review") ||
    hasPermissionInContext(context, "aml:review") ||
    hasPermissionInContext(context, "compliance:manage");

  if (!canRead) {
    redirect("/unauthorized?reason=customer_permission_required");
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("customers")
    .select("id, external_customer_ref, full_name, email, kyc_status, risk_tier, onboarding_status, created_at")
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .limit(250);

  return (
    <CustomerOnboardingConsole
      canCreate={canCreate}
      canReviewQueue={canReview}
      customers={(data ?? []).map((customer) => ({
        id: customer.id,
        externalCustomerRef: customer.external_customer_ref,
        fullName: customer.full_name,
        email: customer.email,
        kycStatus: customer.kyc_status,
        riskTier: customer.risk_tier,
        onboardingStatus: (customer as { onboarding_status?: string }).onboarding_status ?? "draft",
        createdAt: customer.created_at
      }))}
      error={params?.error}
      message={params?.message}
      tenantId={context.tenantId}
    />
  );
}
