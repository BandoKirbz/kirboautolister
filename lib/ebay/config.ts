import { EbayAuthConfig } from "./types";

// Load environment variables
const EBAY_APP_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CERT_ID = process.env.EBAY_CLIENT_SECRET;
const EBAY_RUNAME = process.env.EBAY_RUNAME;
const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
];

// Validate required environment variables
if (!EBAY_APP_ID || !EBAY_CERT_ID || !EBAY_RUNAME) {
  throw new Error("Missing required eBay environment variables");
}

// Base URLs for sandbox/production
export const EBAY_API_URL = process.env.EBAY_SANDBOX === "true" 
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

export const EBAY_OAUTH_URL = process.env.EBAY_SANDBOX === "true"
  ? "https://auth.sandbox.ebay.com/oauth2/authorize"
  : "https://auth.ebay.com/oauth2/authorize";

// Get the base URL for the application
const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// eBay API configuration
export const ebayConfig: EbayAuthConfig = {
  appId: EBAY_APP_ID,
  certId: EBAY_CERT_ID,
  ruName: EBAY_RUNAME,
  redirectUri: process.env.EBAY_REDIRECT_URI || `${BASE_URL}/api/ebay/callback`, // Use API callback URL
  callbackUrl: process.env.EBAY_REDIRECT_URI || `${BASE_URL}/api/ebay/callback`,
  scopes: EBAY_SCOPES,
  sandbox: process.env.EBAY_SANDBOX === "true",
};

// The eBay marketplace this app lists on. Business policies, categories,
// and inventory locations are all scoped to a marketplace.
export const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || "EBAY_US";

// API endpoints
export const EBAY_ENDPOINTS = {
  // OAuth endpoints
  auth: EBAY_OAUTH_URL,
  token: `${EBAY_API_URL}/identity/v1/oauth2/token`,
  
  // Inventory API endpoints
  inventory: {
    base: `${EBAY_API_URL}/sell/inventory/v1`,
    item: (sku: string) => `/inventory_item/${encodeURIComponent(sku)}`,
    bulk: "/bulk_create_or_replace_inventory_item",
    offer: "/offer",
    offerById: (offerId: string) => `/offer/${encodeURIComponent(offerId)}`,
    offers: (sku: string) => `/offer?sku=${encodeURIComponent(sku)}`,
    publishOffer: (offerId: string) => `/offer/${encodeURIComponent(offerId)}/publish`,
    withdrawOffer: (offerId: string) => `/offer/${encodeURIComponent(offerId)}/withdraw`,
    locations: "/location",
    locationByKey: (key: string) => `/location/${encodeURIComponent(key)}`,
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
  "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
}); 