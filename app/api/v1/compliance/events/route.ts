import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const complianceEventSchema = z.object({
  tenantId: z.string().uuid(),
  eventType: z.enum(["kyc_pending", "aml_flag", "sanctions_hit"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  subjectId: z.string().uuid().optional(),
  summary: z.string().min(3).max(240)
});

const complianceStatusSchema = z.object({
  alertId: z.string().uuid(),
  status: z.enum(["open", "in_review", "closed"])
});

const canReadCompliance = (permissions: string[]): boolean => {
  return (
    permissions.includes("compliance:manage") ||
    permissions.includes("kyc:review") ||
    permissions.includes("aml:review") ||
    permissions.includes("audit:read")
  );
};

const canUpdateCompliance = (permissions: string[]): boolean => {
  return (
    permissions.includes("compliance:manage") ||
    permissions.includes("kyc:review") ||
    permissions.includes("aml:review")
  );
};

export async function GET(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!canReadCompliance(context.permissions)) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const severity = searchParams.get("severity")?.trim();

  let query = supabase
    .from("compliance_alerts")
    .select("id, customer_id, event_type, severity, status, summary, created_at")
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;

  if (error) {
    return fail(error.message, 500);
  }

  return ok({ items: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = complianceEventSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid compliance event", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "compliance:manage")) {
    return fail("Forbidden", 403);
  }

  if (parsed.data.tenantId !== context.tenantId) {
    return fail("Tenant scope violation", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("compliance_alerts")
    .insert({
      tenant_id: context.tenantId,
      customer_id: parsed.data.subjectId ?? null,
      event_type: parsed.data.eventType,
      severity: parsed.data.severity,
      status: "open",
      summary: parsed.data.summary
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return fail(error?.message ?? "Unable to log compliance event", 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "compliance.alert_created",
    resourceType: "compliance_alert",
    resourceId: data.id,
    metadata: {
      eventType: parsed.data.eventType,
      severity: parsed.data.severity,
      source: "api"
    }
  });

  return ok({ status: "logged", event: parsed.data.eventType, alertId: data.id }, 201);
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = complianceStatusSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid compliance status update", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!canUpdateCompliance(context.permissions)) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("compliance_alerts")
    .update({ status: parsed.data.status })
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.alertId)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return fail(error?.message ?? "Unable to update compliance status", 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "compliance.alert_status_updated",
    resourceType: "compliance_alert",
    resourceId: parsed.data.alertId,
    metadata: {
      status: parsed.data.status,
      source: "api"
    }
  });

  return ok({ status: parsed.data.status, alertId: parsed.data.alertId });
}
