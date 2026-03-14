import { fail, ok } from "@/lib/api/response";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  const canRead =
    hasPermissionInContext(context, "report:read") ||
    hasPermissionInContext(context, "admin:manage_permissions") ||
    hasPermissionInContext(context, "audit:read");

  if (!canRead) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [membershipRows, transactionsTodayResult, openAlertsResult] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("tenant_id, user_id")
      .eq("tenant_id", context.tenantId)
      .eq("is_active", true),
    supabase
      .from("ledger_transactions")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", context.tenantId)
      .gte("created_at", dayStart.toISOString()),
    supabase
      .from("compliance_alerts")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", context.tenantId)
      .eq("status", "open")
  ]);

  const membershipError = membershipRows.error;
  if (membershipError) {
    return fail(membershipError.message, 500);
  }

  if (transactionsTodayResult.error) {
    return fail(transactionsTodayResult.error.message, 500);
  }

  if (openAlertsResult.error) {
    return fail(openAlertsResult.error.message, 500);
  }

  const activeTenants = new Set((membershipRows.data ?? []).map((row) => row.tenant_id)).size;
  const activeUsers = new Set((membershipRows.data ?? []).map((row) => row.user_id)).size;

  return ok({
    activeTenants,
    activeUsers,
    transactionsToday: transactionsTodayResult.count ?? 0,
    openComplianceAlerts: openAlertsResult.count ?? 0
  });
}
