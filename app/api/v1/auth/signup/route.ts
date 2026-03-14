import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import {
  isSignupEmailRateLimitError,
  signupRateLimitHelpMessage,
  tryCreateUserWithRateLimitFallback
} from "@/lib/auth/signup-fallback";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = signupSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid signup request", 422);
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/auth/callback";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}${next}`
    }
  });

  if (error) {
    if (isSignupEmailRateLimitError(error)) {
      const fallbackResult = await tryCreateUserWithRateLimitFallback({
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName
      });

      if (fallbackResult === "created") {
        return ok(
          {
            userId: null,
            message:
              "Account created without email confirmation due to temporary email limits.",
            fallbackUsed: true
          },
          201
        );
      }

      if (fallbackResult === "already_exists") {
        return ok(
          {
            userId: null,
            message: "Account already exists. Sign in or request password reset.",
            fallbackUsed: true
          },
          200
        );
      }

      return fail(signupRateLimitHelpMessage, 429);
    }

    return fail(error.message, 422);
  }

  return ok({
    userId: data.user?.id ?? null,
    message: "Signup successful. Confirm email to continue."
  }, 201);
}
