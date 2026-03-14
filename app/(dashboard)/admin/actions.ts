"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import {
  setPlatformAdminMembership,
  syncTenantMembershipFromAssignments,
  type AssignableRole
} from "@/lib/auth/access-assignment";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const changePermissionSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["super_admin", "admin", "ops", "compliance_officer", "teller", "customer_support"]),
  action: z.enum(["grant", "revoke"])
});

const redirectWithError = (message: string): never => {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
};

const normalizeRoles = (roles: Array<{ role: string }>): AssignableRole[] => {
  const validRoles: AssignableRole[] = ["admin", "ops", "compliance_officer", "teller", "customer_support"];

  return [...new Set(roles.map((item) => item.role).filter((role): role is AssignableRole => validRoles.includes(role as AssignableRole)))];
};

export const changePermissionAction = async (formData: FormData): Promise<void> => {
  const parsed = changePermissionSchema.safeParse({
    tenantId: String(formData.get("tenantId") ?? ""),
    userId: String(formData.get("userId") ?? ""),
    role: String(formData.get("role") ?? ""),
    action: String(formData.get("action") ?? "")
  });

  const values = parsed.success
    ? parsed.data
    : redirectWithError(parsed.error.issues[0]?.message ?? "Invalid role update request");

  const context = await getAuthContext();

  const authContext = context ?? redirectWithError("Unauthenticated");

  if (!hasPermissionInContext(authContext, "admin:manage_permissions")) {
    redirectWithError("Forbidden");
  }

  if (authContext.tenantId !== values.tenantId) {
    redirectWithError("Tenant mismatch");
  }

  const requestedRole = values.role;
  const resolvedRole: AssignableRole = requestedRole === "super_admin" ? "admin" : requestedRole;

  const supabase = await createServerSupabaseClient();

  if (values.action === "grant") {
    const { error } = await supabase.from("user_role_assignments").upsert(
      {
        tenant_id: values.tenantId,
        user_id: values.userId,
        role: resolvedRole,
        created_by: authContext.userId
      },
      { onConflict: "tenant_id,user_id,role" }
    );

    if (error) {
      redirectWithError(error.message);
    }

    const { data: roleRows, error: roleFetchError } = await supabase
      .from("user_role_assignments")
      .select("role")
      .eq("tenant_id", values.tenantId)
      .eq("user_id", values.userId);

    if (roleFetchError) {
      redirectWithError(roleFetchError.message);
    }

    try {
      if (requestedRole === "super_admin") {
        await setPlatformAdminMembership({
          tenantId: values.tenantId,
          userId: values.userId,
          isActive: true
        });
      }

      await syncTenantMembershipFromAssignments({
        tenantId: values.tenantId,
        userId: values.userId,
        roles: normalizeRoles(roleRows ?? [])
      });
    } catch (membershipError) {
      redirectWithError(
        membershipError instanceof Error ? membershipError.message : "Failed to sync tenant access"
      );
    }

    await safeLogAuditEvent({
      tenantId: values.tenantId,
      actorId: authContext.userId,
      action: "permission.granted",
      resourceType: "user_role_assignment",
      resourceId: values.userId,
      metadata: {
        role: requestedRole,
        resolvedRole,
        subjectUserId: values.userId
      }
    });

    redirect(`/admin?message=${encodeURIComponent("Role granted")}`);
  }

  const { error } = await supabase
    .from("user_role_assignments")
    .delete()
    .eq("tenant_id", values.tenantId)
    .eq("user_id", values.userId)
    .eq("role", resolvedRole);

  if (error) {
    redirectWithError(error.message);
  }

  const { data: roleRows, error: roleFetchError } = await supabase
    .from("user_role_assignments")
    .select("role")
    .eq("tenant_id", values.tenantId)
    .eq("user_id", values.userId);

  if (roleFetchError) {
    redirectWithError(roleFetchError.message);
  }

  try {
    if (requestedRole === "super_admin") {
      await setPlatformAdminMembership({
        tenantId: values.tenantId,
        userId: values.userId,
        isActive: false
      });
    }

    await syncTenantMembershipFromAssignments({
      tenantId: values.tenantId,
      userId: values.userId,
      roles: normalizeRoles(roleRows ?? [])
    });
  } catch (membershipError) {
    redirectWithError(
      membershipError instanceof Error ? membershipError.message : "Failed to sync tenant access"
    );
  }

  await safeLogAuditEvent({
    tenantId: values.tenantId,
    actorId: authContext.userId,
    action: "permission.revoked",
    resourceType: "user_role_assignment",
    resourceId: values.userId,
    metadata: {
      role: requestedRole,
      resolvedRole,
      subjectUserId: values.userId
    }
  });

  redirect(`/admin?message=${encodeURIComponent("Role revoked")}`);
};
