import { createServerSupabaseClient } from "@/lib/supabase/server";

export const resolveUserTenantId = async (
  userId: string,
  requestedTenantId?: string | null
): Promise<string | null> => {
  const supabase = await createServerSupabaseClient();

  if (requestedTenantId) {
    const { data: assignment } = await supabase
      .from("user_role_assignments")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", requestedTenantId)
      .limit(1)
      .maybeSingle();

    if (assignment?.tenant_id) {
      return assignment.tenant_id;
    }

    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", requestedTenantId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return membership?.tenant_id ?? null;
  }

  const { data: assignedTenant } = await supabase
    .from("user_role_assignments")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (assignedTenant?.tenant_id) {
    return assignedTenant.tenant_id;
  }

  const { data: membershipTenant } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return membershipTenant?.tenant_id ?? null;
};
