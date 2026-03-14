import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import {
  isReviewActionAllowed,
  REVIEW_ACTION_TO_STATUS,
  type OnboardingReviewAction
} from "@/lib/onboarding/state-machine";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { onboardingReviewSchema } from "@/lib/validations/onboarding";

type RouteContext = { params: Promise<{ customerId: string }> };

function canPerformReviewAction(
  action: OnboardingReviewAction,
  context: { permissions: string[] }
): boolean {
  if (action === "kyc_approve" || action === "kyc_reject") {
    return context.permissions.some((p) => p === "kyc:review" || p === "compliance:manage");
  }
  if (action === "aml_approve" || action === "aml_reject") {
    return context.permissions.some((p) => p === "aml:review" || p === "compliance:manage");
  }
  if (
    action === "compliance_approve" ||
    action === "compliance_reject" ||
    action === "request_changes"
  ) {
    return context.permissions.some((p) => p === "compliance:manage" || p === "kyc:review" || p === "aml:review");
  }
  return false;
}

export async function GET(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  const canRead =
    hasPermissionInContext(auth, "customer:read") ||
    hasPermissionInContext(auth, "kyc:review") ||
    hasPermissionInContext(auth, "aml:review") ||
    hasPermissionInContext(auth, "compliance:manage") ||
    hasPermissionInContext(auth, "audit:read");
  if (!canRead) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("onboarding_reviews")
    .select("id, reviewer_id, action, comment, previous_status, new_status, created_at")
    .eq("customer_id", customerId)
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return fail(error.message, 500);

  return ok({
    reviews: (data ?? []).map((r) => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      action: r.action,
      comment: r.comment,
      previousStatus: r.previous_status,
      newStatus: r.new_status,
      createdAt: r.created_at
    }))
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);

  const body = await request.json();
  const parsed = onboardingReviewSchema.safeParse({ ...body, customerId, tenantId: auth.tenantId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid review payload", 422);

  const action = parsed.data.action as OnboardingReviewAction;
  const permissions = auth.permissions;
  if (!canPerformReviewAction(action, { permissions })) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();

  const { data: customer, error: fetchError } = await supabase
    .from("customers")
    .select("id, onboarding_status")
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (fetchError || !customer) return fail("Customer not found", 404);

  const currentStatus = customer.onboarding_status as string;
  if (!isReviewActionAllowed(action, currentStatus as Parameters<typeof isReviewActionAllowed>[1])) {
    return fail(`Action ${action} not allowed from status ${currentStatus}`, 422);
  }

  const newStatus = REVIEW_ACTION_TO_STATUS[action];

  const { error: updateError } = await supabase
    .from("customers")
    .update({ onboarding_status: newStatus })
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId);

  if (updateError) return fail(updateError.message, 409);

  await supabase.from("onboarding_reviews").insert({
    tenant_id: auth.tenantId,
    customer_id: customerId,
    reviewer_id: auth.userId,
    action,
    comment: parsed.data.comment ?? null,
    previous_status: currentStatus,
    new_status: newStatus
  });

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: `onboarding.review.${action}`,
    resourceType: "customer",
    resourceId: customerId,
    metadata: { previousStatus: currentStatus, newStatus, comment: parsed.data.comment ?? null }
  });

  return ok({ customerId, action, newStatus }, 201);
}
