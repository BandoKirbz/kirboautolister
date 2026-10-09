export type PlatformId = "ebay" | "etsy" | "grailed" | "depop" | "offerup";

export type PlatformAvailability = "available" | "coming_soon";

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  slug: string;
  website: string;
  logo: string;
  availability: PlatformAvailability;
  /** Why a coming_soon platform cannot be connected yet. */
  unavailableReason?: string;
}

/** Canonical catalog of selling platforms this app knows about. */
export const PLATFORM_CATALOG: PlatformDefinition[] = [
  {
    id: "ebay",
    name: "eBay",
    slug: "ebay",
    website: "https://www.ebay.com",
    logo: "📦",
    availability: "available",
  },
  {
    id: "etsy",
    name: "Etsy",
    slug: "etsy",
    website: "https://www.etsy.com",
    logo: "🧶",
    availability: "available",
  },
  {
    id: "grailed",
    name: "Grailed",
    slug: "grailed",
    website: "https://www.grailed.com",
    logo: "👕",
    availability: "coming_soon",
    unavailableReason:
      "Grailed does not publish a seller API, so Kirbo cannot connect an account or publish listings there yet.",
  },
  {
    id: "depop",
    name: "Depop",
    slug: "depop",
    website: "https://www.depop.com",
    logo: "🛍️",
    availability: "available",
  },
  {
    id: "offerup",
    name: "OfferUp",
    slug: "offerup",
    website: "https://www.offerup.com",
    logo: "🏷️",
    availability: "coming_soon",
    unavailableReason:
      "OfferUp has no public seller API. Business sellers use the Business Portal CSV upload, which Kirbo cannot automate yet.",
  },
];

export function getPlatformDefinition(id: string): PlatformDefinition | undefined {
  return PLATFORM_CATALOG.find((p) => p.id === id);
}
