import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileSecurityConsole } from "@/components/profile/profile-security-console";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Profile & Security | Core Banking MVP"
};

type ProfilePageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const context = await getAuthContext();

  if (!context) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();

  const [profileResponse, sessionsResponse, authUserResponse] = await Promise.all([
    supabase.from("user_profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
    supabase
      .from("auth_sessions")
      .select("id, user_agent, ip_address, last_seen_at, expires_at, revoked_at")
      .eq("tenant_id", context.tenantId)
      .eq("user_id", context.userId)
      .order("last_seen_at", { ascending: false })
      .limit(100),
    supabase.auth.getUser()
  ]);

  const profile = profileResponse.data;
  const sessions = sessionsResponse.data;
  const fallbackEmail = authUserResponse.data.user?.email ?? "unknown@user";

  return (
    <ProfileSecurityConsole
      email={profile?.email ?? fallbackEmail}
      error={params?.error}
      fullName={profile?.full_name ?? ""}
      message={params?.message}
      sessions={
        (sessions ?? []).map((session) => ({
          id: session.id,
          userAgent: session.user_agent,
          ipAddress: session.ip_address,
          lastSeenAt: session.last_seen_at,
          expiresAt: session.expires_at,
          revokedAt: session.revoked_at
        }))
      }
    />
  );
}
