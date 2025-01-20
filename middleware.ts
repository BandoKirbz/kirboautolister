import { auth } from "@/app/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth();
  const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnAuthPage = request.nextUrl.pathname.startsWith("/login") || 
                      request.nextUrl.pathname.startsWith("/register");

  // Redirect authenticated users away from auth pages
  if (session && isOnAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect dashboard routes
  if (!session && isOnDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Configure paths that require session handling
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
}; 