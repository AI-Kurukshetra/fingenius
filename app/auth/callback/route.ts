import { NextResponse } from "next/server";

import { resolveAppOrigin } from "@/lib/auth/origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = resolveAppOrigin(
    {
      get: (name: string) => request.headers.get(name)
    },
    request.url
  );
  const code = searchParams.get("code");
  const next =
    searchParams.get("next") ??
    `/login?message=${encodeURIComponent("Email confirmed. Sign in to continue.")}`;

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
