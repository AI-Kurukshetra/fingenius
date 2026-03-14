import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .is("revoked_at", null);

  if (error) {
    return fail(error.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "auth.sessions_revoked",
    resourceType: "auth_session",
    resourceId: context.userId,
    metadata: {
      scope: "self_all",
      source: "api"
    }
  });

  return ok({
    status: "revoked"
  });
}
