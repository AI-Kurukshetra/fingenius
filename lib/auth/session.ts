import { createHash } from "crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

type SessionRecordInput = {
  tenantId: string;
  userId: string;
  token: string;
  expiresAt?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const recordAuthSession = async (input: SessionRecordInput): Promise<void> => {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const expiresAtIso = input.expiresAt
    ? new Date(input.expiresAt * 1000).toISOString()
    : new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  await supabase.from("auth_sessions").upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      session_token_hash: hashToken(input.token),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      last_seen_at: now.toISOString(),
      expires_at: expiresAtIso,
      revoked_at: null
    },
    { onConflict: "tenant_id,session_token_hash" }
  );
};

export const revokeAuthSessions = async (tenantId: string, userId: string): Promise<void> => {
  const supabase = await createServerSupabaseClient();

  await supabase
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .is("revoked_at", null);
};
