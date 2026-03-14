import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120)
});

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = updateProfileSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid profile payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", context.userId);

  if (error) {
    return fail(error.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "profile.updated",
    resourceType: "user_profile",
    resourceId: context.userId,
    metadata: {
      fullName: parsed.data.fullName,
      source: "api"
    }
  });

  return ok({
    status: "updated"
  });
}
