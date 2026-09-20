import crypto from "crypto";

/**
 * Map our internal, free-form condition strings to eBay's Inventory API
 * ConditionEnum values. See:
 * https://developer.ebay.com/api-docs/sell/inventory/types/slr:ConditionEnum
 */
const CONDITION_MAP: Record<string, string> = {
  "new-with-tags": "NEW",
  "new-without-tags": "NEW_OTHER",
  "very-good": "USED_VERY_GOOD",
  good: "USED_GOOD",
  fair: "USED_ACCEPTABLE",
  // Also accept eBay's own enum values / common aliases directly, in case
  // callers already pass a normalized value.
  NEW: "NEW",
  LIKE_NEW: "USED_EXCELLENT",
  GOOD: "USED_GOOD",
  ACCEPTABLE: "USED_ACCEPTABLE",
};

export function mapConditionToEbay(condition: string): string {
  return CONDITION_MAP[condition] || "USED_GOOD";
}

/**
 * Verify the signature of an eBay webhook notification
 * @param signature The signature from the X-EBAY-SIGNATURE header
 * @param payload The raw request body
 * @returns boolean indicating if the signature is valid
 */
export function verifyEbaySignature(signature: string, payload: string): boolean {
  try {
    // Get webhook signing key from environment variable
    const signingKey = process.env.EBAY_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      console.error("Missing EBAY_WEBHOOK_SIGNING_KEY environment variable");
      return false;
    }

    // Create HMAC using SHA256
    const hmac = crypto.createHmac("sha256", signingKey);
    hmac.update(payload);
    const calculatedSignature = hmac.digest("hex");

    // Compare signatures using constant-time comparison
    const a = Buffer.from(signature);
    const b = Buffer.from(calculatedSignature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (error) {
    console.error("Error verifying eBay signature:", error);
    return false;
  }
}

/**
 * OAuth "state" helpers.
 *
 * The eBay OAuth redirect can happen outside of the app's normal cookie
 * context (e.g. after opening eBay's login/consent page in the same tab,
 * via a tunnel, or in environments where the session cookie isn't sent
 * back with the redirect). Instead of trusting an ambient session or
 * falling back to "whichever user was created most recently" (a serious
 * security bug), we sign the initiating user's id into the `state`
 * parameter so the callback can verify *cryptographically* which user
 * started the flow, without depending on cookies at all.
 */
interface OAuthStatePayload {
  userId: string;
  nonce: string;
  issuedAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getStateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET must be set to sign eBay OAuth state");
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getStateSecret()).update(value).digest("base64url");
}

/**
 * Create a signed, tamper-proof state token that encodes the user id that
 * initiated the eBay OAuth flow.
 */
export function createEbayOAuthState(userId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a state token produced by {@link createEbayOAuthState} and return
 * the userId it encodes. Returns `null` if the token is missing, malformed,
 * tampered with, or expired.
 */
export function verifyEbayOAuthState(state: string | null | undefined): string | null {
  if (!state) return null;

  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload: OAuthStatePayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    );

    if (!payload.userId || !payload.issuedAt) return null;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;

    return payload.userId;
  } catch {
    return null;
  }
}
