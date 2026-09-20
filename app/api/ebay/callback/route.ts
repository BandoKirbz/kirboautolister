import { NextRequest, NextResponse } from "next/server";
import { ebayService } from "@/lib/ebay/service";
import { verifyEbayOAuthState } from "@/lib/ebay/utils";

/**
 * After eBay hits our HTTPS callback (often a tunnel URL), send the user
 * back to the app origin they actually use day-to-day (usually
 * http://localhost:3000) so their session cookie still applies.
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

// GET /api/ebay/callback - eBay redirects here after the user
// authorizes (or declines) the app. This is the RuName's configured
// redirect URI (EBAY_REDIRECT_URI).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const message = errorDescription || error;
    console.error("eBay OAuth error:", message);
    return redirectTo(
      request,
      `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(message)}`
    );
  }

  if (!code) {
    return redirectTo(
      request,
      `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(
        "No authorization code received from eBay"
      )}`
    );
  }

  // The user id is derived exclusively from the signed `state` value that
  // we generated in getAuthUrl(). We deliberately do NOT fall back to an
  // ambient session or "the most recently created user" - doing so would
  // let anyone who completes the OAuth dance attach their eBay account to
  // an arbitrary user.
  const userId = verifyEbayOAuthState(state);
  if (!userId) {
    console.error("eBay callback: missing or invalid state parameter");
    return redirectTo(
      request,
      `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(
        "Your eBay authorization link expired or was invalid. Please try connecting again."
      )}`
    );
  }

  try {
    const authResponse = await ebayService.handleCallback(userId, code);
    return redirectTo(
      request,
      `/dashboard?platform=ebay&status=connected&username=${encodeURIComponent(
        authResponse.username || ""
      )}`
    );
  } catch (err) {
    console.error("eBay callback error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return redirectTo(
      request,
      `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(message)}`
    );
  }
}
