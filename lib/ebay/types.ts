import { z } from "zod";

// eBay OAuth Types
export interface EbayAuthConfig {
  appId: string;
  certId: string;
  devId?: string;
  ruName: string;
  redirectUri: string;
  callbackUrl?: string;
  scopes: string[];
  sandbox?: boolean;
}

export interface EbayAuthResponse {
  sandboxToken?: string;
  productionToken?: string;
  username?: string;
  timestamp: Date;
  scope?: string[];
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
  error?: string;
  errorDescription?: string;
}

export interface EbayConnectionStatus {
  connected: boolean;
  username?: string;
  lastConnected?: Date;
  environment: 'SANDBOX' | 'PRODUCTION';
  error?: string;
}

export interface EbayTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  username?: string;
  scope?: string[];
}

// eBay API Response Types
export interface EbayApiResponse<T> {
  data: T;
  errors?: EbayError[];
  warnings?: EbayWarning[];
}

export interface EbayError {
  errorId: number;
  domain: string;
  category: string;
  message: string;
  parameters?: { name: string; value: string }[];
}

export interface EbayWarning {
  category: string;
  domain: string;
  message: string;
  parameters?: { name: string; value: string }[];
}

// eBay Inventory Types
export interface EbayInventoryItem {
  sku: string;
  locale: string;
  product: {
    title: string;
    description: string;
    aspects?: Record<string, string[]>;
    imageUrls?: string[];
  };
  condition: string;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  packageWeightAndSize?: {
    weight: {
      value: number;
      unit: string;
    };
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: string;
    };
  };
}

export interface EbayOffer {
  offerId?: string;
  sku: string;
  marketplaceId: string;
  format: "FIXED_PRICE";
  availableQuantity: number;
  categoryId: string;
  listingDescription: string;
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  pricingSummary: {
    price: {
      value: string;
      currency: string;
    };
  };
  quantityLimitPerBuyer?: number;
  includeCatalogProductDetails?: boolean;
  merchantLocationKey?: string;
}

// Validation Schemas
export const ebayInventoryItemSchema = z.object({
  sku: z.string(),
  locale: z.string(),
  product: z.object({
    title: z.string(),
    description: z.string(),
    aspects: z.record(z.array(z.string())).optional(),
    imageUrls: z.array(z.string()).optional(),
  }),
  condition: z.string(),
  availability: z.object({
    shipToLocationAvailability: z.object({
      quantity: z.number().int().positive(),
    }),
  }),
  packageWeightAndSize: z
    .object({
      weight: z.object({
        value: z.number().positive(),
        unit: z.string(),
      }),
      dimensions: z
        .object({
          length: z.number().positive(),
          width: z.number().positive(),
          height: z.number().positive(),
          unit: z.string(),
        })
        .optional(),
    })
    .optional(),
});

// Input for creating/updating a listing from our own product data
export interface EbayListingInput {
  title: string;
  description: string;
  price: number;
  quantity: number;
  condition: string;
  images: string[];
  categoryId?: string;
}

export interface EbayBusinessPolicies {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export interface EbayMerchantLocation {
  merchantLocationKey: string;
}

export const ebayOfferSchema = z.object({
  offerId: z.string().optional(),
  sku: z.string(),
  marketplaceId: z.string(),
  format: z.literal("FIXED_PRICE"),
  availableQuantity: z.number().int().positive(),
  categoryId: z.string(),
  listingDescription: z.string(),
  listingPolicies: z.object({
    fulfillmentPolicyId: z.string(),
    paymentPolicyId: z.string(),
    returnPolicyId: z.string(),
  }),
  pricingSummary: z.object({
    price: z.object({
      value: z.string(),
      currency: z.string(),
    }),
  }),
  quantityLimitPerBuyer: z.number().int().positive().optional(),
  includeCatalogProductDetails: z.boolean().optional(),
  merchantLocationKey: z.string().optional(),
}); 