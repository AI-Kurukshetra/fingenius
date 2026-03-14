import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";

export type AssignableRole = "admin" | "ops" | "compliance_officer" | "teller" | "customer_support";

const resolveMembershipRole = (roles: AssignableRole[], hadPlatformAdmin: boolean): string => {
  if (roles.includes("admin") && hadPlatformAdmin) {
    return "platform_admin";
  }

  if (roles.includes("admin")) {
    return "tenant_admin";
  }

  if (roles.includes("compliance_officer")) {
    return "compliance_officer";
  }

  if (roles.includes("ops") || roles.includes("teller")) {
    return "operations";
  }

  if (roles.includes("customer_support")) {
    return "relationship_manager";
  }

  return "customer";
};

export const syncTenantMembershipFromAssignments = async (params: {
  tenantId: string;
  userId: string;
  roles: AssignableRole[];
}): Promise<void> => {
  const serviceClient = createServiceRoleSupabaseClient();
  const { data: currentMembershipRows, error: currentMembershipError } = await serviceClient
    .from("tenant_memberships")
    .select("role, is_active")
    .eq("tenant_id", params.tenantId)
    .eq("user_id", params.userId);

  if (currentMembershipError) {
    throw new Error(currentMembershipError.message);
  }

  const hadPlatformAdmin = (currentMembershipRows ?? []).some(
    (row) => row.role === "platform_admin" && row.is_active
  );

  const { error: disableMembershipError } = await serviceClient
    .from("tenant_memberships")
    .update({ is_active: false })
    .eq("tenant_id", params.tenantId)
    .eq("user_id", params.userId);

  if (disableMembershipError) {
    throw new Error(disableMembershipError.message);
  }

  if (params.roles.length === 0) {
    return;
  }

  const membershipRole = resolveMembershipRole(params.roles, hadPlatformAdmin);

  const { error: upsertMembershipError } = await serviceClient.from("tenant_memberships").upsert(
    {
      tenant_id: params.tenantId,
      user_id: params.userId,
      role: membershipRole,
      is_active: true
    },
    { onConflict: "tenant_id,user_id,role" }
  );

  if (upsertMembershipError) {
    throw new Error(upsertMembershipError.message);
  }
};

export const setPlatformAdminMembership = async (params: {
  tenantId: string;
  userId: string;
  isActive: boolean;
}): Promise<void> => {
  const serviceClient = createServiceRoleSupabaseClient();

  if (params.isActive) {
    const { error } = await serviceClient.from("tenant_memberships").upsert(
      {
        tenant_id: params.tenantId,
        user_id: params.userId,
        role: "platform_admin",
        is_active: true
      },
      { onConflict: "tenant_id,user_id,role" }
    );

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await serviceClient
    .from("tenant_memberships")
    .update({ is_active: false })
    .eq("tenant_id", params.tenantId)
    .eq("user_id", params.userId)
    .eq("role", "platform_admin");

  if (error) {
    throw new Error(error.message);
  }
};
