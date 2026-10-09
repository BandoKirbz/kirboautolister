/**
 * Grailed has no public seller API (no OAuth, no documented publish
 * endpoint). Third-party crosslisters use a browser extension instead.
 * Do not store Grailed passwords or scrape the site from this app.
 */
export const GRAILED_UNAVAILABLE_REASON =
  "Grailed does not publish a seller API, so Kirbo cannot connect an account or publish listings there yet.";

export function grailedIntegrationStatus() {
  return {
    available: false as const,
    connected: false as const,
    reason: GRAILED_UNAVAILABLE_REASON,
  };
}
