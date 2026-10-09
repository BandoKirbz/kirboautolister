import { NextRequest, NextResponse } from "next/server";

import { verifyEtsyOAuthState } from "@/lib/etsy/oauth-state";
import { etsyService } from "@/lib/etsy/service";

export const runtime = "nodejs";

/**
 * After Etsy hits our HTTPS callback (tunnel), send the user back to the
 * day-to-day app origin (usually http://localhost:3000) so the NextAuth
 * session cookie still applies — same pattern as the eBay callback.
 * Do not use PUBLIC_APP_URL here; that is the tunnel host.
 */
function appOrigin(request: NextRequest): string {
  return (
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, appOrigin(request)));
}

/** GET /api/etsy/callback — Etsy OAuth redirect target. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const message = errorDescription || error;
    return redirectTo(
      request,
      `/dashboard/platforms?platform=etsy&status=error&message=${encodeURIComponent(message)}`
    );
  }

  if (!code) {
    return redirectTo(
      request,
      `/dashboard/platforms?platform=etsy&status=error&message=${encodeURIComponent(
        "No authorization code received from Etsy"
      )}`
    );
  }

  const verified = verifyEtsyOAuthState(state);
  if (!verified) {
    return redirectTo(
      request,
      `/dashboard/platforms?platform=etsy&status=error&message=${encodeURIComponent(
        "Your Etsy authorization link expired or was invalid. Please try connecting again."
      )}`
    );
  }

  try {
    const result = await etsyService.handleCallback(
      verified.userId,
      code,
      verified.codeVerifier
    );
    return redirectTo(
      request,
      `/dashboard/platforms?platform=etsy&status=connected&shopId=${encodeURIComponent(
        String(result.shopId)
      )}`
    );
  } catch (err) {
    console.error("Etsy callback error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return redirectTo(
      request,
      `/dashboard/platforms?platform=etsy&status=error&message=${encodeURIComponent(message)}`
    );
  }
}
