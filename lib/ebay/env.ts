/**
 * eBay env loader.
 *
 * Secrets live ONLY in `.env.local` / `.env` (both gitignored).
 * Never hardcode Client Secret, RuName, or tokens in source files.
 */

const PLACEHOLDER_MARKERS = [
  "replace-with",
  "your-",
  "changeme",
  "xxx",
  "todo",
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => lower.includes(m));
}

export type EbayEnv = {
  clientId: string;
  clientSecret: string;
  ruName: string;
  sandbox: boolean;
  apiUrl: string;
  redirectUri: string;
  marketplaceId: string;
  defaultCategoryId?: string;
  scopes: string[];
};

const DEFAULT_SCOPES = [
  // Core + sell scopes needed to list inventory. Prefer EBAY_SCOPES in
  // .env.local matching your eBay app's enabled scopes (see branded OAuth URL).
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
];

function looksLikeUserToken(value: string): boolean {
  // eBay user tokens look like v^1.1#... — those are NOT the Cert ID.
  return value.startsWith("v^1.1#") || value.startsWith("v1.1#");
}

/**
 * Read eBay config from env. Throws a clear, actionable error if anything
 * required is missing or still a placeholder — so we never send junk like
 * `redirect_uri=replace-with-your-sandbox-runame` to eBay (which produces
 * invalid_request on auth2.sandbox.ebay.com).
 */
export function getEbayEnv(): EbayEnv {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RUNAME;
  const sandbox = process.env.EBAY_SANDBOX === "true";
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const missing: string[] = [];
  if (isPlaceholder(clientId)) missing.push("EBAY_CLIENT_ID");
  if (isPlaceholder(clientSecret)) missing.push("EBAY_CLIENT_SECRET (Cert ID)");
  if (isPlaceholder(ruName)) missing.push("EBAY_RUNAME");

  if (clientSecret && looksLikeUserToken(clientSecret)) {
    throw new Error(
      "EBAY_CLIENT_SECRET looks like a user access token (starts with v^1.1#). " +
        "That is not your Cert ID. On https://developer.ebay.com/my/keys open " +
        "Sandbox → App keys → click Show next to Cert ID, and paste that value " +
        "into EBAY_CLIENT_SECRET in .env.local."
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `eBay is not configured. Set these in .env.local (gitignored), then restart the dev server: ${missing.join(
        ", "
      )}. ` +
        `Get them from https://developer.ebay.com/my/keys (Sandbox). ` +
        `RuName Accept URL in the eBay portal must be HTTPS and match EBAY_REDIRECT_URI exactly ` +
        `(currently for local tunnel: use your cloudflared/ngrok https URL + /api/ebay/callback).`
    );
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    ruName: ruName!,
    sandbox,
    apiUrl: sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com",
    redirectUri: process.env.EBAY_REDIRECT_URI || `${baseUrl}/api/ebay/callback`,
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_US",
    defaultCategoryId: process.env.EBAY_DEFAULT_CATEGORY_ID,
    scopes: process.env.EBAY_SCOPES
      ? process.env.EBAY_SCOPES.split(" ").filter(Boolean)
      : DEFAULT_SCOPES,
  };
}

/** Soft check used by status endpoints — does not throw. */
export function isEbayConfigured(): boolean {
  try {
    getEbayEnv();
    return true;
  } catch {
    return false;
  }
}
