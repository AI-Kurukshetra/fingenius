import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminConsole } from "@/components/admin/admin-console";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin | Core Banking MVP"
};

const permissionMatrix = [
  {
    role: "super_admin",
    permissions: [
      "admin:manage_users",
      "admin:manage_permissions",
      "transaction:approve",
      "transaction:reverse",
      "compliance:manage",
      "audit:read"
    ]
  },
  {
    role: "admin",
    permissions: [
      "admin:manage_users",
      "admin:manage_permissions",
      "transaction:approve",
      "transaction:reverse",
      "compliance:manage",
      "audit:read"
    ]
  },
  {
    role: "ops",
    permissions: [
      "customer:write",
      "account:write",
      "transaction:create",
      "transaction:approve",
      "loan:write",
      "report:read"
    ]
  },
  {
    role: "compliance_officer",
    permissions: ["compliance:manage", "kyc:review", "aml:review", "audit:read"]
  },
  {
    role: "teller",
    permissions: ["customer:read", "account:read", "transaction:create", "transaction:cash"]
  },
  {
    role: "customer_support",
    permissions: ["customer:read", "account:read", "transaction:read", "notification:send"]
  }
];

type AdminPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

const stringifyMetadata = (value: Json): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context || !hasPermissionInContext(context, "admin:manage_permissions")) {
    redirect("/unauthorized?reason=admin_permission_required");
  }

  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleSupabaseClient();

  const [
    { data: assignments },
    { data: auditRows },
    { data: userProfiles },
    { data: tenantMemberships },
    customersResult,
    accountsResult,
    postedTransactionsResult,
    openAlertsResult,
    activeSessionsResult
  ] = await Promise.all([
    supabase
      .from("user_role_assignments")
      .select("id, user_id, role, created_at")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("audit_logs")
      .select("id, created_at, action, resource_type, resource_id, actor_id, metadata")
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    serviceSupabase
      .from("user_profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    serviceSupabase
      .from("tenant_memberships")
      .select("user_id, role, is_active")
      .eq("tenant_id", context.tenantId)
      .eq("is_active", true),
    supabase.from("customers").select("id", { head: true, count: "exact" }).eq("tenant_id", context.tenantId),
    supabase.from("accounts").select("id", { head: true, count: "exact" }).eq("tenant_id", context.tenantId),
    supabase
      .from("ledger_transactions")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", context.tenantId)
      .eq("status", "posted"),
    supabase
      .from("compliance_alerts")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", context.tenantId)
      .eq("status", "open"),
    supabase
      .from("auth_sessions")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", context.tenantId)
      .is("revoked_at", null)
  ]);

  return (
    <AdminConsole
      assignments={
        (assignments ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          role: row.role,
          createdAt: row.created_at
        }))
      }
      users={(userProfiles ?? []).map((user) => {
        const assignmentRoles = [...new Set((assignments ?? []).filter((row) => row.user_id === user.id).map((row) => row.role))];
        const isPlatformAdmin = (tenantMemberships ?? []).some(
          (membership) => membership.user_id === user.id && membership.role === "platform_admin"
        );

        const assignedRoles = isPlatformAdmin
          ? ["super_admin", ...assignmentRoles.filter((role) => role !== "admin")]
          : assignmentRoles;

        return {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          createdAt: user.created_at,
          assignedRoles
        };
      })}
      auditRows={
        (auditRows ?? []).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          action: row.action,
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          actorId: row.actor_id,
          metadata: stringifyMetadata(row.metadata)
        }))
      }
      error={params?.error}
      message={params?.message}
      metrics={{
        customers: customersResult.count ?? 0,
        accounts: accountsResult.count ?? 0,
        postedTransactions: postedTransactionsResult.count ?? 0,
        openComplianceAlerts: openAlertsResult.count ?? 0,
        activeSessions: activeSessionsResult.count ?? 0
      }}
      permissionMatrix={permissionMatrix}
      tenantId={context.tenantId}
    />
  );
}
