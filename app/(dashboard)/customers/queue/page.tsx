import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Onboarding review queue | Core Banking MVP"
};

export default async function OnboardingQueuePage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const canRead =
    hasPermissionInContext(context, "kyc:review") ||
    hasPermissionInContext(context, "aml:review") ||
    hasPermissionInContext(context, "compliance:manage") ||
    hasPermissionInContext(context, "customer:read");
  if (!canRead) redirect("/unauthorized?reason=compliance_permission_required");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("customers")
    .select("id, external_customer_ref, full_name, email, onboarding_status, kyc_status, risk_tier, created_at")
    .eq("tenant_id", context.tenantId)
    .in("onboarding_status", ["kyc_submitted", "aml_submitted", "aml_approved", "compliance_review"])
    .order("created_at", { ascending: false })
    .limit(100);

  const items = data ?? [];

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-slate-600 hover:underline" href="/customers">
          ← Customers
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Onboarding review queue</h1>
      </div>

      <p className="text-sm text-slate-600">
        Customers awaiting KYC, AML, or compliance review. Open a row to review and approve or reject.
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-500">
          No customers in review.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">KYC</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr className="border-b border-slate-100 hover:bg-slate-50/50" key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.full_name}</p>
                    <p className="text-xs text-slate-500">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">{c.onboarding_status}</td>
                  <td className="px-4 py-3">{c.kyc_status}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-cyan-700 hover:underline"
                      href={`/customers/${c.id}`}
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
    </main>
  );
}
