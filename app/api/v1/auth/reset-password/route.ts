import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const resetPasswordSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = resetPasswordSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid reset request", 422);
  }

  const supabase = await createServerSupabaseClient();
  const { origin } = new URL(request.url);
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    return fail(error.message, 422);
  }

  return ok({ status: "email_sent" });
}
