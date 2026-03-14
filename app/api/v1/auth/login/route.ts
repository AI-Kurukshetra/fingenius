import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { recordAuthSession } from "@/lib/auth/session";
import { resolveUserTenantId } from "@/lib/auth/tenant";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid login request", 422);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return fail(error?.message ?? "Invalid credentials", 401);
  }

  const tenantId = await resolveUserTenantId(data.user.id, request.headers.get("x-tenant-id"));

  if (tenantId) {
    if (data.session?.access_token) {
      await recordAuthSession({
        tenantId,
        userId: data.user.id,
        token: data.session.access_token,
        expiresAt: data.session.expires_at,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent")
      });
    }

    await safeLogAuditEvent({
      tenantId,
      actorId: data.user.id,
      action: "auth.login",
      resourceType: "auth",
      resourceId: data.user.id,
      metadata: {
        method: "password",
        source: "api"
      }
    });
  }

  return ok({
    userId: data.user.id,
    tenantId,
    expiresAt: data.session?.expires_at ?? null
  });
}
