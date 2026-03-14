import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { canTransition } from "@/lib/onboarding/state-machine";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transitionSchema } from "@/lib/validations/onboarding";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!hasPermissionInContext(auth, "customer:write")) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = transitionSchema.safeParse({ ...body, customerId, tenantId: auth.tenantId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid transition payload", 422);

  const supabase = await createServerSupabaseClient();

  const { data: customer, error: fetchError } = await supabase
    .from("customers")
    .select("id, onboarding_status")
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (fetchError || !customer) return fail("Customer not found", 404);

  const current = customer.onboarding_status as string;
  const next = parsed.data.nextStatus;

  if (!canTransition(current as Parameters<typeof canTransition>[0], next as Parameters<typeof canTransition>[1])) {
    return fail(`Transition from ${current} to ${next} is not allowed`, 422);
  }

  const { data: updated, error } = await supabase
    .from("customers")
    .update({ onboarding_status: next })
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .select("id, onboarding_status")
    .single();

  if (error) return fail(error.message, 409);

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: "onboarding.status_transition",
    resourceType: "customer",
    resourceId: customerId,
    metadata: { from: current, to: next }
  });

  return ok({ customerId: updated.id, onboardingStatus: updated.onboarding_status });
}
