import { EbayAuthConfig } from "./types";

// Load environment variables
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
const EBAY_RUNAME = process.env.EBAY_RUNAME;
const EBAY_SCOPES = process.env.EBAY_SCOPES?.split(" ") || [];

// Validate required environment variables
if (!EBAY_APP_ID || !EBAY_CERT_ID || !EBAY_DEV_ID || !EBAY_RUNAME) {
  throw new Error("Missing required eBay environment variables");
}

// Base URLs
export const EBAY_API_URL = process.env.EBAY_API_URL || "https://api.ebay.com";
export const EBAY_SANDBOX_API_URL = process.env.EBAY_SANDBOX_API_URL || "https://api.sandbox.ebay.com";
export const EBAY_OAUTH_URL = process.env.EBAY_OAUTH_URL || "https://auth.ebay.com/oauth2/authorize";

// eBay API configuration
export const ebayConfig: EbayAuthConfig = {
  appId: EBAY_APP_ID,
  certId: EBAY_CERT_ID,
  devId: EBAY_DEV_ID,
  ruName: EBAY_RUNAME,
  scopes: EBAY_SCOPES,
  sandbox: process.env.NODE_ENV === "development", // Use sandbox in development
};

// API endpoints
export const EBAY_ENDPOINTS = {
  // OAuth endpoints
  auth: `${EBAY_OAUTH_URL}/oauth2/authorize`,
  token: `${EBAY_API_URL}/identity/v1/oauth2/token`,
  
  // Inventory API endpoints
  inventory: {
    base: `${EBAY_API_URL}/sell/inventory/v1`,
    item: (sku: string) => `/inventory_item/${sku}`,
    bulk: "/bulk_create_or_replace_inventory_item",
    offer: "/offer",
    offers: (sku: string) => `/offer/get_by_inventory_item?sku=${sku}`,
  },
  
  // Account API endpoints
  account: {
    base: `${EBAY_API_URL}/sell/account/v1`,
    policies: {
      fulfillment: "/fulfillment_policy",
      payment: "/payment_policy",
      return: "/return_policy",
    },
  },
} as const;

// Common headers
export const getHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
  "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", // Default to US marketplace
}); 