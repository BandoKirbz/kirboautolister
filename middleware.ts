import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Use JWT directly so middleware stays edge-safe and does not pull Prisma/pg
  // (Turbopack cannot resolve Node builtins like util/types via auth → prisma).
  // Must match app/auth.ts cookies.sessionToken.name — Auth.js v5 defaults
  // to "authjs.session-token", which would make every login bounce back here.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
    cookieName: "next-auth.session-token",
  });
  const isAuthPage =
    request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  const isHomePage = request.nextUrl.pathname === "/";

  if (token && (isAuthPage || isHomePage)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
