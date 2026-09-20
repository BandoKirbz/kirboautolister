export type PlatformId = "ebay" | "grailed" | "depop" | "offerup";

export type PlatformAvailability = "available" | "coming_soon";

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  slug: string;
  website: string;
  logo: string;
  availability: PlatformAvailability;
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
    id: "grailed",
    name: "Grailed",
    slug: "grailed",
    website: "https://www.grailed.com",
    logo: "👕",
    availability: "coming_soon",
  },
  {
    id: "depop",
    name: "Depop",
    slug: "depop",
    website: "https://www.depop.com",
    logo: "🛍️",
    availability: "coming_soon",
  },
  {
    id: "offerup",
    name: "OfferUp",
    slug: "offerup",
    website: "https://www.offerup.com",
    logo: "🏷️",
    availability: "coming_soon",
  },
];

export function getPlatformDefinition(id: string): PlatformDefinition | undefined {
  return PLATFORM_CATALOG.find((p) => p.id === id);
}
