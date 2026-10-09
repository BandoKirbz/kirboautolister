/**
 * Etsy Open API v3 env loader.
 * Secrets live only in `.env.local` / host env — never commit them.
 */

const PLACEHOLDER_MARKERS = ["replace-with", "your-", "changeme", "xxx", "todo"];

function isPlaceholder(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => lower.includes(m));
}

export const ETSY_DEFAULT_SCOPES = [
  "listings_r",
  "listings_w",
  "shops_r",
];

export type EtsyEnv = {
  keystring: string;
  sharedSecret: string;
  redirectUri: string;
  scopes: string[];
  /** Leaf taxonomy id used when a product has no Etsy category yet. */
  defaultTaxonomyId: number;
  defaultWhoMade: "i_did" | "someone_else" | "collective";
  defaultWhenMade: string;
  shippingProfileId?: number;
  readinessStateId?: number;
};

export function getEtsyEnv(): EtsyEnv {
  const keystring = process.env.ETSY_API_KEYSTRING;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  const baseUrl = (
    process.env.PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const missing: string[] = [];
  if (isPlaceholder(keystring)) missing.push("ETSY_API_KEYSTRING");
  if (isPlaceholder(sharedSecret)) missing.push("ETSY_SHARED_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Etsy is not configured. Set ${missing.join(" and ")} in .env.local ` +
        `(from https://www.etsy.com/developers/your-apps), register an HTTPS ` +
        `callback matching ETSY_REDIRECT_URI, then restart the server.`
    );
  }

  const taxonomyRaw = process.env.ETSY_DEFAULT_TAXONOMY_ID?.trim();
  const defaultTaxonomyId = Number(taxonomyRaw || "1");
  if (!Number.isFinite(defaultTaxonomyId) || defaultTaxonomyId < 1) {
    throw new Error("ETSY_DEFAULT_TAXONOMY_ID must be a positive integer leaf taxonomy id.");
  }

  const whoMade = (process.env.ETSY_DEFAULT_WHO_MADE?.trim() || "someone_else") as
    | "i_did"
    | "someone_else"
    | "collective";
  if (!["i_did", "someone_else", "collective"].includes(whoMade)) {
    throw new Error("ETSY_DEFAULT_WHO_MADE must be i_did, someone_else, or collective.");
  }

  const shippingProfileId = process.env.ETSY_SHIPPING_PROFILE_ID
    ? Number(process.env.ETSY_SHIPPING_PROFILE_ID)
    : undefined;
  const readinessStateId = process.env.ETSY_READINESS_STATE_ID
    ? Number(process.env.ETSY_READINESS_STATE_ID)
    : undefined;

  return {
    keystring: keystring!,
    sharedSecret: sharedSecret!,
    redirectUri: process.env.ETSY_REDIRECT_URI || `${baseUrl}/api/etsy/callback`,
    scopes: process.env.ETSY_SCOPES
      ? process.env.ETSY_SCOPES.split(/[,\s]+/).filter(Boolean)
      : ETSY_DEFAULT_SCOPES,
    defaultTaxonomyId,
    defaultWhoMade: whoMade,
    defaultWhenMade: process.env.ETSY_DEFAULT_WHEN_MADE?.trim() || "2010_2019",
    shippingProfileId:
      shippingProfileId && Number.isFinite(shippingProfileId) ? shippingProfileId : undefined,
    readinessStateId:
      readinessStateId && Number.isFinite(readinessStateId) ? readinessStateId : undefined,
  };
}

export function isEtsyConfigured(): boolean {
  try {
    getEtsyEnv();
    return true;
  } catch {
    return false;
  }
}

/** Header value for every Etsy v3 request. */
export function etsyApiKeyHeader(env = getEtsyEnv()): string {
  return `${env.keystring}:${env.sharedSecret}`;
}
