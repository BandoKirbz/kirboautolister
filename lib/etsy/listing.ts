import { getEtsyEnv } from "./env";

/**
 * Map Kirbo condition → Etsy when_made era.
 * Resale clothes usually weren't made by the seller (`who_made=someone_else`).
 */
const WHEN_MADE_BY_CONDITION: Record<string, string> = {
  "new-with-tags": "2020_2026",
  "new-without-tags": "2020_2026",
  "very-good": "2010_2019",
  good: "2010_2019",
  fair: "2000_2006",
};

export function mapWhenMadeFromCondition(condition: string): string {
  if (WHEN_MADE_BY_CONDITION[condition]) return WHEN_MADE_BY_CONDITION[condition];
  try {
    return getEtsyEnv().defaultWhenMade;
  } catch {
    return process.env.ETSY_DEFAULT_WHEN_MADE?.trim() || "2010_2019";
  }
}

export type EtsyListingDraftFields = Record<string, string | number | boolean>;

/** Shape a Kirbo product into createDraftListing form fields. */
export function buildEtsyDraftFields(product: {
  name: string;
  description: string;
  price: number;
  condition: string;
  quantity?: number | null;
  taxonomyId?: number | null;
}): EtsyListingDraftFields {
  const env = getEtsyEnv();
  const fields: EtsyListingDraftFields = {
    quantity: product.quantity && product.quantity > 0 ? product.quantity : 1,
    title: product.name.slice(0, 140),
    description: product.description || product.name,
    price: product.price,
    who_made: env.defaultWhoMade,
    when_made: mapWhenMadeFromCondition(product.condition),
    taxonomy_id: product.taxonomyId || env.defaultTaxonomyId,
    is_supply: false,
    type: "physical",
  };

  if (env.shippingProfileId) {
    fields.shipping_profile_id = env.shippingProfileId;
  }
  if (env.readinessStateId) {
    fields.readiness_state_id = env.readinessStateId;
  }

  return fields;
}
