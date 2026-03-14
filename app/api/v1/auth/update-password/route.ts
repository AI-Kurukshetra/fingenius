import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { resolveUserTenantId } from "@/lib/auth/tenant";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updatePasswordSchema = z.object({
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = updatePasswordSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid password update request", 422);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("Unauthenticated", 401);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return fail(error.message, 422);
  }

  const tenantId = await resolveUserTenantId(user.id, request.headers.get("x-tenant-id"));

  if (tenantId) {
    await safeLogAuditEvent({
      tenantId,
      actorId: user.id,
      action: "auth.password_reset",
      resourceType: "auth",
      resourceId: user.id,
      metadata: { source: "api" }
    });
  }

  return ok({ status: "password_updated" });
}
