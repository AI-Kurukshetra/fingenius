import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const protectedPagePrefixes = [
    "/accounts",
    "/customers",
    "/transactions",
    "/loans",
    "/compliance",
    "/admin",
    "/profile"
  ];
  const isProtectedPage = protectedPagePrefixes.some((prefix) => pathname.startsWith(prefix));
  const isProtectedApi =
    pathname.startsWith("/api/v1") &&
    !pathname.startsWith("/api/v1/auth") &&
    !pathname.startsWith("/api/v1/webhooks");

  if (!userId && isProtectedApi) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required"
        }
      },
      { status: 401 }
    );
  }

  if (!userId && isProtectedPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
