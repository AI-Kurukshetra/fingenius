import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeAuditHash } from "@/lib/audit/hash-chain";

type AuditEvent = {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export const logAuditEvent = async (event: AuditEvent): Promise<void> => {
  const supabase = await createServerSupabaseClient();

  const { data: previous } = await supabase
    .from("audit_logs")
    .select("event_hash")
    .eq("tenant_id", event.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const createdAt = new Date().toISOString();
  const eventHash = computeAuditHash({
    tenantId: event.tenantId,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    at: createdAt,
    previousHash: previous?.event_hash ?? null
  });

  await supabase.from("audit_logs").insert({
    tenant_id: event.tenantId,
    actor_id: event.actorId,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId,
    metadata: event.metadata ?? {},
    event_hash: eventHash,
    previous_hash: previous?.event_hash ?? null,
    created_at: createdAt
  });
};

export const safeLogAuditEvent = async (event: AuditEvent): Promise<void> => {
  try {
    await logAuditEvent(event);
  } catch {
    // Auth and business flows should not break if audit insert fails.
  }
};
