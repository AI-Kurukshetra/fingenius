"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z.string().min(2).max(120)
});

const passwordSchema = z.object({
  password: z.string().min(8)
});

const backToProfile = (query: string): never => {
  redirect(`/profile?${query}`);
};

export const updateProfileAction = async (formData: FormData): Promise<void> => {
  const parsed = profileSchema.safeParse({
    fullName: String(formData.get("fullName") ?? "").trim()
  });
  const values = parsed.success
    ? parsed.data
    : backToProfile(`error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid profile")}`);

  const context = await getAuthContext();
  const authContext = context ?? backToProfile(`error=${encodeURIComponent("Unauthenticated")}`);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: values.fullName })
    .eq("id", authContext.userId);

  if (error) {
    backToProfile(`error=${encodeURIComponent(error.message)}`);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "profile.updated",
    resourceType: "user_profile",
    resourceId: authContext.userId,
    metadata: { fullName: values.fullName }
  });

  backToProfile(`message=${encodeURIComponent("Profile updated")}`);
};

export const updateSecurityPasswordAction = async (formData: FormData): Promise<void> => {
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? "")
  });
  const values = parsed.success
    ? parsed.data
    : backToProfile(`error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid password")}`);

  const context = await getAuthContext();
  const authContext = context ?? backToProfile(`error=${encodeURIComponent("Unauthenticated")}`);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: values.password });

  if (error) {
    backToProfile(`error=${encodeURIComponent(error.message)}`);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "auth.password_reset",
    resourceType: "auth",
    resourceId: authContext.userId,
    metadata: { flow: "settings" }
  });

  backToProfile(`message=${encodeURIComponent("Password updated")}`);
};

export const revokeSessionsAction = async (_formData: FormData): Promise<void> => {
  const context = await getAuthContext();
  const authContext = context ?? backToProfile(`error=${encodeURIComponent("Unauthenticated")}`);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", authContext.tenantId)
    .eq("user_id", authContext.userId)
    .is("revoked_at", null);

  if (error) {
    backToProfile(`error=${encodeURIComponent(error.message)}`);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "auth.sessions_revoked",
    resourceType: "auth_session",
    resourceId: authContext.userId,
    metadata: { scope: "self_all" }
  });

  backToProfile(`message=${encodeURIComponent("Active sessions revoked")}`);
};
