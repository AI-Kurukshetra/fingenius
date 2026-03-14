"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import {
  isSignupEmailRateLimitError,
  signupRateLimitHelpMessage,
  tryCreateUserWithRateLimitFallback
} from "@/lib/auth/signup-fallback";
import { recordAuthSession, revokeAuthSessions } from "@/lib/auth/session";
import { resolveUserTenantId } from "@/lib/auth/tenant";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const withError = (pathname: string, message: string): never => {
  redirect(`${pathname}?error=${encodeURIComponent(message)}`);
};

const withMessage = (pathname: string, message: string): never => {
  redirect(`${pathname}?message=${encodeURIComponent(message)}`);
};

const requireString = (value: string | undefined, pathname: string, message: string): string => {
  if (!value) {
    withError(pathname, message);
  }

  return value as string;
};

const getOrigin = async (): Promise<string> => {
  const headerStore = await headers();
  return headerStore.get("origin") ?? "http://localhost:3000";
};

export const signupAction = async (formData: FormData): Promise<void> => {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || password.length < 8) {
    withError("/register", "Enter full name, valid email, and an 8+ character password.");
  }

  const supabase = await createServerSupabaseClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`
    }
  });

  if (error) {
    if (isSignupEmailRateLimitError(error)) {
      const fallbackResult = await tryCreateUserWithRateLimitFallback({
        email,
        password,
        fullName
      });

      if (fallbackResult === "created") {
        withMessage(
          "/login",
          "Account created without email confirmation due to temporary email limits. Sign in now."
        );
      }

      if (fallbackResult === "already_exists") {
        withMessage("/login", "Account already exists. Sign in or use password reset.");
      }

      withError("/register", signupRateLimitHelpMessage);
    }

    withError("/register", error.message);
  }

  withMessage("/login", "Signup successful. Check your email to confirm your account.");
};

export const loginAction = async (formData: FormData): Promise<void> => {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    withError("/login", "Email and password are required.");
  }

  const headerStore = await headers();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const userId = data.user?.id;

  if (error || !userId) {
    withError("/login", error?.message ?? "Invalid credentials.");
  }
  const authUserId = requireString(userId, "/login", "Invalid credentials.");

  const tenantId = await resolveUserTenantId(authUserId, headerStore.get("x-tenant-id"));

  if (!tenantId) {
    await supabase.auth.signOut();
    withError(
      "/login",
      "Your account is verified but not assigned to a tenant yet. Ask your admin to grant access."
    );
  }
  const resolvedTenantId = tenantId as string;

  if (data.session?.access_token) {
    await recordAuthSession({
      tenantId: resolvedTenantId,
      userId: authUserId,
      token: data.session.access_token,
      expiresAt: data.session.expires_at,
      ipAddress: headerStore.get("x-forwarded-for"),
      userAgent: headerStore.get("user-agent")
    });
  }

  await safeLogAuditEvent({
    tenantId: resolvedTenantId,
    actorId: authUserId,
    action: "auth.login",
    resourceType: "auth",
    resourceId: authUserId,
    metadata: {
      method: "password",
      ip: headerStore.get("x-forwarded-for") ?? "unknown"
    }
  });

  redirect("/accounts");
};

export const logoutAction = async (): Promise<void> => {
  const headerStore = await headers();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const tenantId = await resolveUserTenantId(user.id, headerStore.get("x-tenant-id"));

    if (tenantId) {
      await revokeAuthSessions(tenantId, user.id);

      await safeLogAuditEvent({
        tenantId,
        actorId: user.id,
        action: "auth.logout",
        resourceType: "auth",
        resourceId: user.id,
        metadata: {
          ip: headerStore.get("x-forwarded-for") ?? "unknown"
        }
      });
    }
  }

  await supabase.auth.signOut();
  withMessage("/login", "Signed out.");
};

export const requestPasswordResetAction = async (formData: FormData): Promise<void> => {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    withError("/forgot-password", "Email is required.");
  }

  const supabase = await createServerSupabaseClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    withError("/forgot-password", error.message);
  }

  withMessage("/login", "Password reset email sent.");
};

export const updatePasswordAction = async (formData: FormData): Promise<void> => {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    withError("/reset-password", "Password must be at least 8 characters.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const authUserId = user?.id;

  if (!authUserId) {
    withError("/login", "Reset session expired. Request another reset email.");
  }
  const resetUserId = requireString(
    authUserId,
    "/login",
    "Reset session expired. Request another reset email."
  );

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    withError("/reset-password", error.message);
  }

  const tenantId = await resolveUserTenantId(resetUserId);

  if (tenantId) {
    await safeLogAuditEvent({
      tenantId,
      actorId: resetUserId,
      action: "auth.password_reset",
      resourceType: "auth",
      resourceId: resetUserId,
      metadata: { flow: "recovery" }
    });
  }

  await supabase.auth.signOut();
  withMessage("/login", "Password updated. Sign in with your new password.");
};
