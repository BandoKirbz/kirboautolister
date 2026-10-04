import crypto from "crypto";

import axios from "axios";
import EbayAuthToken from "ebay-oauth-nodejs-client";

import { getEbayEnv } from "./env";

const APP_TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";
const KEY_TTL_MS = 60 * 60 * 1000;

type CachedKey = { pem: string; fetchedAt: number };
const publicKeyCache = new Map<string, CachedKey>();

/**
 * Verify eBay's `x-ebay-signature` on a Notification / account-deletion POST.
 *
 * Header value is base64 JSON: `{ alg, kid, signature, digest }`. The public
 * key is fetched by `kid` from the Notification API and used to ECDSA-verify
 * the raw body. https://developer.ebay.com/marketplace-account-deletion
 */
export async function verifyEbayNotificationSignature(
  rawBody: string,
  signatureHeader: string
): Promise<boolean> {
  let decoded: { kid?: string; signature?: string; digest?: string };
  try {
    decoded = JSON.parse(Buffer.from(signatureHeader, "base64").toString("utf8"));
  } catch {
    return false;
  }
  if (!decoded.kid || !decoded.signature) return false;

  const pem = await getPublicKey(decoded.kid);
  const algorithm = decoded.digest?.toUpperCase() === "SHA256" ? "SHA256" : "SHA1";
  const verifier = crypto.createVerify(algorithm);
  verifier.update(rawBody);
  return verifier.verify(pem, Buffer.from(decoded.signature, "base64"));
}

async function getPublicKey(kid: string): Promise<string> {
  const cached = publicKeyCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < KEY_TTL_MS) return cached.pem;

  const env = getEbayEnv();
  const token = await getApplicationToken();
  const response = await axios.get(`${env.apiUrl}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pem = response.data?.key;
  if (typeof pem !== "string" || !pem.includes("BEGIN PUBLIC KEY")) {
    throw new Error("eBay public key response did not include a PEM key");
  }
  publicKeyCache.set(kid, { pem, fetchedAt: Date.now() });
  return pem;
}

async function getApplicationToken(): Promise<string> {
  const env = getEbayEnv();
  const auth = new EbayAuthToken({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    redirectUri: env.ruName,
    env: env.sandbox ? "SANDBOX" : "PRODUCTION",
  });
  const raw = await auth.getApplicationToken(env.sandbox ? "SANDBOX" : "PRODUCTION", APP_TOKEN_SCOPE);
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data?.access_token) {
    throw new Error("eBay did not return an application token for signature verification");
  }
  return data.access_token as string;
}
