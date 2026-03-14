import type { AuthError } from "@supabase/supabase-js";

import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";

type SignupFallbackInput = {
  email: string;
  password: string;
  fullName: string;
};

export type SignupFallbackResult = "disabled" | "created" | "already_exists";

const rateLimitPattern = /rate\s*limit|too many requests|over_email_send_rate_limit/i;
const alreadyExistsPattern = /already (registered|exists)|user already|email.*already/i;

const isFallbackEnabled = (): boolean => {
  return (
    process.env.AUTH_ALLOW_RATE_LIMIT_SIGNUP_FALLBACK === "true" &&
    process.env.NODE_ENV !== "production"
  );
};

export const isSignupEmailRateLimitError = (
  error: Pick<AuthError, "message" | "status" | "code"> | null | undefined
): boolean => {
  if (!error) {
    return false;
  }

  if (error.status === 429) {
    return true;
  }

  const combined = `${error.code ?? ""} ${error.message ?? ""}`;
  return rateLimitPattern.test(combined);
};

export const signupRateLimitHelpMessage =
  "Signup email rate limit reached. Wait a minute and try again, or ask an admin to create your account directly in Supabase Auth.";

export const tryCreateUserWithRateLimitFallback = async (
  input: SignupFallbackInput
): Promise<SignupFallbackResult> => {
  if (!isFallbackEnabled()) {
    return "disabled";
  }

  const serviceSupabase = createServiceRoleSupabaseClient();
  const { error } = await serviceSupabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName
    }
  });

  if (!error) {
    return "created";
  }

  if (alreadyExistsPattern.test(error.message)) {
    return "already_exists";
  }

  throw new Error(error.message);
};
