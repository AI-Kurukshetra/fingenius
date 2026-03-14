import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountManagementConsole } from "@/components/accounts/account-management-console";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Accounts | Core Banking MVP"
};

type AccountsPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
    customerId?: string;
  }>;
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const canCreate = hasPermissionInContext(context, "account:write");
  const canRead = canCreate || hasPermissionInContext(context, "account:read");

  if (!canRead) {
    redirect("/unauthorized?reason=account_permission_required");
  }

  const supabase = await createServerSupabaseClient();

  const [accountsResponse, customersResponse] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, account_number, product_code, currency, status, created_at, customer:customers(full_name)")
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

  const accounts = accountsResponse.data ?? [];
  const customers = customersResponse.data ?? [];

  return (
    <AccountManagementConsole
      accounts={accounts.map((account) => ({
        id: account.id,
        accountNumber: account.account_number,
        customerName: (account.customer as { full_name?: string } | null)?.full_name ?? "Unknown",
        productCode: account.product_code,
        currency: account.currency,
        status: account.status,
        createdAt: account.created_at
      }))}
      canCreate={canCreate}
      customers={customers.map((customer) => ({
        id: customer.id,
        fullName: customer.full_name,
        externalCustomerRef: customer.external_customer_ref
      }))}
      defaultCustomerId={params?.customerId}
      error={params?.error}
      message={params?.message}
      tenantId={context.tenantId}
    />
  );
}
