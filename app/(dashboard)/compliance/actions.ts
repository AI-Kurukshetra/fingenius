"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createComplianceAlertSchema = z.object({
  customerId: z.string().uuid().optional(),
  eventType: z.enum(["kyc_pending", "aml_flag", "sanctions_hit"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().min(3).max(240)
});

const updateComplianceStatusSchema = z.object({
  alertId: z.string().uuid(),
  status: z.enum(["open", "in_review", "closed"])
});

const backToComplianceWithError = (message: string): never => {
  redirect(`/compliance?error=${encodeURIComponent(message)}`);
};

const backToComplianceWithMessage = (message: string): never => {
  redirect(`/compliance?message=${encodeURIComponent(message)}`);
};

const canUpdateCompliance = (permissions: string[]): boolean => {
  return (
    permissions.includes("compliance:manage") ||
    permissions.includes("kyc:review") ||
    permissions.includes("aml:review")
  );
};

export const createComplianceAlertAction = async (formData: FormData): Promise<void> => {
  const parsed = createComplianceAlertSchema.safeParse({
    customerId: String(formData.get("customerId") ?? "").trim() || undefined,
    eventType: String(formData.get("eventType") ?? ""),
    severity: String(formData.get("severity") ?? ""),
    summary: String(formData.get("summary") ?? "").trim()
  });

  const values = parsed.success
    ? parsed.data
    : backToComplianceWithError(parsed.error.issues[0]?.message ?? "Invalid compliance alert request");

  const context = await getAuthContext();
  const authContext = context ?? backToComplianceWithError("Unauthenticated");

  if (!hasPermissionInContext(authContext, "compliance:manage")) {
    backToComplianceWithError("You do not have permission to create compliance alerts.");
  }

  const supabase = await createServerSupabaseClient();

  if (values.customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", authContext.tenantId)
      .eq("id", values.customerId)
      .maybeSingle();

    if (!customer?.id) {
      backToComplianceWithError("Customer not found for this tenant.");
    }
  }

  const { data: alert, error } = await supabase
    .from("compliance_alerts")
    .insert({
      tenant_id: authContext.tenantId,
      customer_id: values.customerId ?? null,
      event_type: values.eventType,
      severity: values.severity,
      status: "open",
      summary: values.summary
    })
    .select("id")
    .single();

  if (error || !alert?.id) {
    backToComplianceWithError(error?.message ?? "Unable to create compliance alert");
  }
  const alertId = alert?.id ?? backToComplianceWithError("Unable to create compliance alert");

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "compliance.alert_created",
    resourceType: "compliance_alert",
    resourceId: alertId,
    metadata: {
      eventType: values.eventType,
      severity: values.severity,
      customerId: values.customerId ?? "none"
    }
  });

  revalidatePath("/compliance");
  backToComplianceWithMessage("Compliance alert logged.");
};

export const updateComplianceStatusAction = async (formData: FormData): Promise<void> => {
  const parsed = updateComplianceStatusSchema.safeParse({
    alertId: String(formData.get("alertId") ?? "").trim(),
    status: String(formData.get("status") ?? "")
  });

  const values = parsed.success
    ? parsed.data
    : backToComplianceWithError(parsed.error.issues[0]?.message ?? "Invalid compliance status update");

  const context = await getAuthContext();
  const authContext = context ?? backToComplianceWithError("Unauthenticated");

  if (!canUpdateCompliance(authContext.permissions)) {
    backToComplianceWithError("You do not have permission to update compliance alerts.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: updatedAlert, error } = await supabase
    .from("compliance_alerts")
    .update({ status: values.status })
    .eq("tenant_id", authContext.tenantId)
    .eq("id", values.alertId)
    .select("id")
    .maybeSingle();

  if (error || !updatedAlert?.id) {
    backToComplianceWithError(error?.message ?? "Unable to update compliance alert");
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "compliance.alert_status_updated",
    resourceType: "compliance_alert",
    resourceId: values.alertId,
    metadata: {
      status: values.status
    }
  });

  revalidatePath("/compliance");
  backToComplianceWithMessage(`Compliance alert marked as ${values.status}.`);
};
