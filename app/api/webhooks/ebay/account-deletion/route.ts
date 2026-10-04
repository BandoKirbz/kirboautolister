import crypto from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ebayDb } from "@/lib/ebay/db";
import { verifyEbayNotificationSignature } from "@/lib/ebay/notification-signature";
import { db } from "@/lib/db";

/**
 * eBay's Marketplace Account Deletion / Closure Notification endpoint.
 *
 * eBay REQUIRES every production app that stores any eBay member data
 * (which this app does - OAuth tokens + username) to implement this
 * endpoint before it will approve production API access. When a user
 * deletes/closes their eBay account, eBay notifies every app that has
 * their data so the app can delete it too.
 *
 * Setup (once you have production keys):
 *   1. eBay Developer Portal -> your app -> "Alerts and Notifications".
 *   2. Generate a Verification Token (32-80 chars) and set it as
 *      EBAY_VERIFICATION_TOKEN below.
 *   3. Set the "Marketplace account deletion notification endpoint" to
 *      the exact HTTPS URL this route is deployed at (no query string,
 *      no trailing slash unless included consistently) and set that same
 *      URL as EBAY_NOTIFICATION_ENDPOINT_URL below - eBay's challenge
 *      hash is computed over this exact string, so it must match.
 *   4. eBay immediately sends a GET request with a `challenge_code` to
 *      verify the endpoint (handled below) before saving the config.
 *
 * Docs: https://developer.ebay.com/marketplace-account-deletion
 *
 * The POST handler verifies `x-ebay-signature` (ECDSA over the raw body,
 * public key fetched by `kid`) before deleting anything. Invalid signatures
 * return 412. A verified payload with an unexpected shape still returns 200
 * so eBay does not retry a message we cannot act on.
 */

function getVerificationToken(): string {
  const token = process.env.EBAY_VERIFICATION_TOKEN;
  if (!token) {
    throw new Error("EBAY_VERIFICATION_TOKEN is not set");
  }
  return token;
}

function getEndpointUrl(request: NextRequest): string {
  // Must exactly match the URL registered in the eBay Developer Portal.
  // Prefer an explicit override since the portal doesn't allow a query
  // string and reverse proxies can alter request.url's scheme/host.
  return (process.env.EBAY_NOTIFICATION_ENDPOINT_URL || request.nextUrl.origin + request.nextUrl.pathname).replace(
    /\/$/,
    ""
  );
}

// GET /api/webhooks/ebay/account-deletion - eBay's endpoint verification challenge.
export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "Missing challenge_code" }, { status: 400 });
  }

  try {
    const verificationToken = getVerificationToken();
    const endpoint = getEndpointUrl(request);

    // Per eBay's spec: SHA-256 of challengeCode + verificationToken + endpoint, in that order.
    const hash = crypto
      .createHash("sha256")
      .update(challengeCode)
      .update(verificationToken)
      .update(endpoint)
      .digest("hex");

    return NextResponse.json({ challengeResponse: hash }, { status: 200 });
  } catch (err) {
    console.error("[eBay Account Deletion] Challenge failed:", err);
    return NextResponse.json(
      { error: "Endpoint not configured (missing EBAY_VERIFICATION_TOKEN)" },
      { status: 500 }
    );
  }
}

const accountDeletionSchema = z.object({
  metadata: z.object({
    topic: z.string(),
  }),
  notification: z.object({
    notificationId: z.string(),
    eventDate: z.string(),
    publishDate: z.string().optional(),
    data: z.object({
      username: z.string().optional(),
      userId: z.string().optional(),
      eiasToken: z.string().optional(),
    }),
  }),
});

// POST /api/webhooks/ebay/account-deletion - actual deletion notification.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-ebay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 412 });
  }

  try {
    const valid = await verifyEbayNotificationSignature(rawBody, signature);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 412 });
    }
  } catch (err) {
    console.error("[eBay Account Deletion] Could not verify signature:", err);
    return NextResponse.json({ error: "Could not verify signature" }, { status: 500 });
  }

  try {
    const body = JSON.parse(rawBody);
    const parsed = accountDeletionSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[eBay Account Deletion] Unexpected payload shape");
      // Still 200 - eBay retries on non-2xx, and a shape mismatch on our
      // side isn't something retrying will fix.
      return NextResponse.json({ success: true });
    }

    const { username, userId: ebayUserId } = parsed.data.notification.data;
    console.log("[eBay Account Deletion] Notification received:", {
      notificationId: parsed.data.notification.notificationId,
      username,
      ebayUserId,
    });

    if (username) {
      const credential = await db.ebaycredential.findFirst({
        where: { ebayUsername: username },
      });

      if (credential) {
        await ebayDb.deleteCredentials(credential.userId).catch((err) =>
          console.error("[eBay Account Deletion] Failed to delete credentials:", err)
        );
        await db.platformconnection
          .updateMany({
            where: { userId: credential.userId, platformId: "ebay" },
            data: { isEnabled: false },
          })
          .catch((err) =>
            console.error("[eBay Account Deletion] Failed to disable platform connection:", err)
          );
        console.log(
          `[eBay Account Deletion] Removed local eBay connection for user ${credential.userId}`
        );
      }
    }

    // Must respond quickly with 2xx or eBay will keep retrying.
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[eBay Account Deletion] Error processing notification:", err);
    // Still return 200 for malformed bodies - only real transient
    // failures (e.g. DB down) are worth eBay retrying.
    return NextResponse.json({ success: true });
  }
}
