import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { revokeAuthSessions } from "@/lib/auth/session";
import { resolveUserTenantId } from "@/lib/auth/tenant";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("Unauthenticated", 401);
  }

  const tenantId = await resolveUserTenantId(user.id, request.headers.get("x-tenant-id"));

  if (tenantId) {
    await revokeAuthSessions(tenantId, user.id);
    await safeLogAuditEvent({
      tenantId,
      actorId: user.id,
      action: "auth.logout",
      resourceType: "auth",
      resourceId: user.id,
      metadata: { source: "api" }
    });
  }

  await supabase.auth.signOut();

  return ok({ status: "signed_out" });
}
