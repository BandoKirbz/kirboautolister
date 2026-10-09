import { GRAILED_UNAVAILABLE_REASON } from "./status";

/** Grailed's public condition labels. There is still no API that accepts these. */
export type GrailedCondition = "new" | "gently_used" | "used";

const CONDITION_MAP: Record<string, GrailedCondition> = {
  "new-with-tags": "new",
  "new-without-tags": "gently_used",
  "very-good": "gently_used",
  good: "gently_used",
  fair: "used",
};

export function mapConditionToGrailed(condition: string): GrailedCondition {
  return CONDITION_MAP[condition] || "used";
}

export type GrailedListingDraft = {
  title: string;
  description: string;
  price: number;
  condition: GrailedCondition;
  designer: string;
};

/** Shape a Kirbo product into Grailed's listing fields. Does not publish. */
export function buildGrailedListingDraft(product: {
  title: string;
  description: string;
  price: number;
  condition: string;
  brand?: string | null;
}): GrailedListingDraft {
  return {
    title: product.title,
    description: product.description,
    price: product.price,
    condition: mapConditionToGrailed(product.condition),
    designer: product.brand?.trim() || "Other",
  };
}

export function publishGrailedListing(_draft: GrailedListingDraft): never {
  throw new Error(GRAILED_UNAVAILABLE_REASON);
}
