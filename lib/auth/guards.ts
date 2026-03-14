import { headers } from "next/headers";

import {
  getPermissionsForRoles,
  mapLegacyMembershipRole,
  type Permission,
  type Role
} from "@/lib/auth/rbac";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthContext = {
  userId: string;
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
};

const distinctRoles = (roles: Array<Role | null>): Role[] => {
  return [...new Set(roles.filter((role): role is Role => role !== null))];
};

const resolveTenantId = async (
  userId: string,
  requestedTenantId?: string | null
): Promise<{ tenantId: string | null; roles: Role[] }> => {
  const supabase = await createServerSupabaseClient();

  const roleQuery = supabase
    .from("user_role_assignments")
    .select("tenant_id, role")
    .eq("user_id", userId);

  const { data: assignedRoles } = requestedTenantId
    ? await roleQuery.eq("tenant_id", requestedTenantId)
    : await roleQuery;

  if (assignedRoles && assignedRoles.length > 0) {
    const tenantId = requestedTenantId ?? assignedRoles[0]?.tenant_id ?? null;
    const tenantAssignedRoles = assignedRoles.filter(
      (assignment) => assignment.tenant_id === tenantId
    );
    const roles = distinctRoles(
      tenantAssignedRoles.map((assignment) => {
        return ["admin", "ops", "compliance_officer", "teller", "customer_support"].includes(
          assignment.role
        )
          ? (assignment.role as Role)
          : null;
      })
    );

    return { tenantId, roles };
  }

  const membershipQuery = supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  const { data: memberships } = requestedTenantId
    ? await membershipQuery.eq("tenant_id", requestedTenantId)
    : await membershipQuery;

  if (!memberships || memberships.length === 0) {
    return { tenantId: null, roles: [] };
  }

  const tenantId = requestedTenantId ?? memberships[0]?.tenant_id ?? null;
  const tenantMemberships = memberships.filter((membership) => membership.tenant_id === tenantId);
  const roles = distinctRoles(
    tenantMemberships.map((membership) => mapLegacyMembershipRole(membership.role))
  );

  return { tenantId, roles };
};

export const getAuthContext = async (request?: Request): Promise<AuthContext | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const requestTenantId = request?.headers.get("x-tenant-id");
  const headerTenantId = requestTenantId ?? (await headers()).get("x-tenant-id");

  const { tenantId, roles } = await resolveTenantId(user.id, headerTenantId);

  if (!tenantId || roles.length === 0) {
    return null;
  }

  return {
    userId: user.id,
    tenantId,
    roles,
    permissions: getPermissionsForRoles(roles)
  };
};

export const hasPermissionInContext = (
  context: AuthContext,
  permission: Permission
): boolean => {
  return context.permissions.includes(permission);
};
