/**
 * Depop Selling API is partner-gated. Until Depop issues API keys or an
 * OAuth app, Kirbo can only prepare the client and store a key when the
 * seller pastes one. See docs/depop-api-reference.md.
 */
export const DEPOP_ACCESS_REASON =
  "Depop's Selling API is private. Email business@depop.com for partner access, then paste your staging API key on the Platforms page.";

export type DepopEnvironment = "staging" | "production";

export function depopBaseUrl(environment: DepopEnvironment): string {
  const override = process.env.DEPOP_API_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return environment === "production"
    ? "https://partnerapi.depop.com"
    : "https://partnerapi-staging.depop.com";
}
