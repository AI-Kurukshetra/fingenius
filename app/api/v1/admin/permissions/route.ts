import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import {
  setPlatformAdminMembership,
  syncTenantMembershipFromAssignments,
  type AssignableRole
} from "@/lib/auth/access-assignment";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const changePermissionSchema = z.object({
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  role: z.enum(["super_admin", "admin", "ops", "compliance_officer", "teller", "customer_support"]),
  action: z.enum(["grant", "revoke"])
});

const normalizeRoles = (roles: Array<{ role: string }>): AssignableRole[] => {
  const validRoles: AssignableRole[] = ["admin", "ops", "compliance_officer", "teller", "customer_support"];

  return [...new Set(roles.map((item) => item.role).filter((role): role is AssignableRole => validRoles.includes(role as AssignableRole)))];
};

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries(await request.formData());
  const parsed = changePermissionSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid permission change payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "admin:manage_permissions")) {
    return fail("Forbidden", 403);
  }

  if (parsed.data.tenantId && parsed.data.tenantId !== context.tenantId) {
    return fail("Tenant scope violation", 403);
  }

  const tenantId = parsed.data.tenantId ?? context.tenantId;
  const requestedRole = parsed.data.role;
  const resolvedRole: AssignableRole = requestedRole === "super_admin" ? "admin" : requestedRole;
  const supabase = await createServerSupabaseClient();

  if (parsed.data.action === "grant") {
    const { error } = await supabase.from("user_role_assignments").upsert(
      {
        tenant_id: tenantId,
        user_id: parsed.data.userId,
        role: resolvedRole,
        created_by: context.userId
      },
      { onConflict: "tenant_id,user_id,role" }
    );

    if (error) {
      return fail(error.message, 409);
    }

    const { data: roleRows, error: roleFetchError } = await supabase
      .from("user_role_assignments")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", parsed.data.userId);

    if (roleFetchError) {
      return fail(roleFetchError.message, 500);
    }

    try {
      if (requestedRole === "super_admin") {
        await setPlatformAdminMembership({
          tenantId,
          userId: parsed.data.userId,
          isActive: true
        });
      }

      await syncTenantMembershipFromAssignments({
        tenantId,
        userId: parsed.data.userId,
        roles: normalizeRoles(roleRows ?? [])
      });
    } catch (membershipError) {
      return fail(
        membershipError instanceof Error ? membershipError.message : "Failed to sync tenant access",
        500
      );
    }

    await safeLogAuditEvent({
      tenantId,
      actorId: context.userId,
      action: "permission.granted",
      resourceType: "user_role_assignment",
      resourceId: parsed.data.userId,
      metadata: {
        role: requestedRole,
        resolvedRole,
        subjectUserId: parsed.data.userId
      }
    });

    return ok({
      status: "granted",
      tenantId,
      userId: parsed.data.userId,
      role: requestedRole
    });
  }

  const { error } = await supabase
    .from("user_role_assignments")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", parsed.data.userId)
    .eq("role", resolvedRole);

  if (error) {
    return fail(error.message, 409);
  }

  const { data: roleRows, error: roleFetchError } = await supabase
    .from("user_role_assignments")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", parsed.data.userId);

  if (roleFetchError) {
    return fail(roleFetchError.message, 500);
  }

  try {
    if (requestedRole === "super_admin") {
      await setPlatformAdminMembership({
        tenantId,
        userId: parsed.data.userId,
        isActive: false
      });
    }

    await syncTenantMembershipFromAssignments({
      tenantId,
      userId: parsed.data.userId,
      roles: normalizeRoles(roleRows ?? [])
    });
  } catch (membershipError) {
    return fail(
      membershipError instanceof Error ? membershipError.message : "Failed to sync tenant access",
      500
    );
  }

  await safeLogAuditEvent({
    tenantId,
    actorId: context.userId,
    action: "permission.revoked",
    resourceType: "user_role_assignment",
    resourceId: parsed.data.userId,
    metadata: {
      role: requestedRole,
      resolvedRole,
      subjectUserId: parsed.data.userId
    }
  });

  return ok({
    status: "revoked",
    tenantId,
    userId: parsed.data.userId,
    role: requestedRole
  });
}
