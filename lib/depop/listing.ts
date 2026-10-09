import type { DepopConnectionSettings } from "./credentials";

/** Depop Selling API condition enum. */
export type DepopCondition =
  | "brand_new"
  | "used_like_new"
  | "used_excellent"
  | "used_good"
  | "used_fair";

const CONDITION_MAP: Record<string, DepopCondition> = {
  "new-with-tags": "brand_new",
  "new-without-tags": "used_like_new",
  "very-good": "used_excellent",
  good: "used_good",
  fair: "used_fair",
};

export function mapConditionToDepop(condition: string): DepopCondition {
  return CONDITION_MAP[condition] || "used_good";
}

export type DepopListingDraft = {
  sku: string;
  body: Record<string, unknown>;
};

/**
 * Shape a Kirbo product into Depop's PUT /products/by-sku/{sku}/ body.
 * Does not call Depop — taxonomy defaults come from connection settings.
 */
export function buildDepopListingDraft(
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    condition: string;
    brand?: string | null;
    quantity?: number | null;
    images: Array<{ url: string }>;
  },
  settings: DepopConnectionSettings
): DepopListingDraft {
  const publicImages = product.images
    .map((image) => image.url)
    .filter((url) => url.startsWith("https://"));

  if (publicImages.length === 0) {
    throw new Error(
      "Depop listings need at least one public HTTPS image URL (S3). Data-URL fallbacks are not accepted."
    );
  }

  const sku = `kirbo-${product.id}`;
  const description = [product.title.trim(), product.description.trim()]
    .filter(Boolean)
    .join("\n\n");

  const address: Record<string, string> = {
    country_code: settings.countryCode,
  };
  if (settings.state) address.state = settings.state;

  const body: Record<string, unknown> = {
    address,
    description,
    price_currency: settings.priceCurrency,
    price_amount: product.price.toFixed(2),
    quantity: product.quantity && product.quantity > 0 ? product.quantity : 1,
    pictures: publicImages.map((url, index) => ({
      url: index === 0 ? `${url}#type=cover-image` : url,
    })),
    department: settings.department,
    product_type: settings.productType,
    size_set_id: settings.sizeSetId,
    size_id: settings.sizeId,
    condition: mapConditionToDepop(product.condition),
    brand: (product.brand?.trim() || "unbranded").toLowerCase(),
  };

  if (settings.nationalShippingCost) {
    body.national_shipping_cost = settings.nationalShippingCost;
  }
  if (settings.internationalShippingCost) {
    body.international_shipping_cost = settings.internationalShippingCost;
  }

  return { sku, body };
}
