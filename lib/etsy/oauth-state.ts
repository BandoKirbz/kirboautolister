import crypto from "crypto";

/**
 * Signed OAuth `state` for Etsy PKCE.
 * Carries userId + code_verifier so the callback can finish the token exchange
 * without a separate store. HMAC'd with NEXTAUTH_SECRET (or encryption key).
 */

type Payload = {
  userId: string;
  codeVerifier: string;
  nonce: string;
  issuedAt: number;
};

const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function signingKey(): Buffer {
  const raw =
    process.env.NEXTAUTH_SECRET ||
    process.env.EBAY_TOKEN_ENCRYPTION_KEY ||
    "";
  if (!raw) {
    throw new Error(
      "NEXTAUTH_SECRET (or EBAY_TOKEN_ENCRYPTION_KEY) is required to sign Etsy OAuth state."
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(encodedPayload).digest("base64url");
}

/** RFC 7636 code_verifier: 43–128 URL-safe chars. */
export function createCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function createEtsyOAuthState(userId: string, codeVerifier: string): string {
  const payload: Payload = {
    userId,
    codeVerifier,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyEtsyOAuthState(
  state: string | null | undefined
): { userId: string; codeVerifier: string } | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  let expected: string;
  try {
    expected = sign(encodedPayload);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    ) as Payload;
    if (!payload.userId || !payload.codeVerifier || !payload.issuedAt) return null;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;
    return { userId: payload.userId, codeVerifier: payload.codeVerifier };
  } catch {
    return null;
  }
}
