import { EbayAuthConfig } from "./types";
import { getEbayEnv } from "./env";

// Lazy-load so importing this module during build doesn't crash when
// .env.local isn't filled in yet. Callers that need live values should
// use getEbayEnv() / the getters below.

function env() {
  return getEbayEnv();
}

export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
];

export function getEbayApiUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

export function getEbayOauthUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://auth.sandbox.ebay.com/oauth2/authorize"
    : "https://auth.ebay.com/oauth2/authorize";
}

/**
 * The public, viewable listing page for a published eBay item - what a
 * user would click to see (or share) their actual live listing.
 */
export function getEbayItemUrl(itemId: string): string {
  const base =
    process.env.EBAY_SANDBOX === "true" ? "https://www.sandbox.ebay.com" : "https://www.ebay.com";
  return `${base}/itm/${encodeURIComponent(itemId)}`;
}

/**
 * The Commerce Identity API lives on a separate `apiz.` host (not the
 * regular `api.` host used by Sell APIs). Used to fetch the connected
 * eBay user's username after OAuth completes.
 */
export function getEbayIdentityUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://apiz.sandbox.ebay.com/commerce/identity/v1/user/"
    : "https://apiz.ebay.com/commerce/identity/v1/user/";
}

/** @deprecated Prefer getEbayEnv() — kept for existing imports. */
export const EBAY_API_URL =
  process.env.EBAY_API_URL ||
  (process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com");

export const EBAY_OAUTH_URL =
  process.env.EBAY_SANDBOX === "true"
    ? "https://auth.sandbox.ebay.com/oauth2/authorize"
    : "https://auth.ebay.com/oauth2/authorize";

export const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || "EBAY_US";

/**
 * Live config object. Accessing properties reads env at call time via
 * getters so placeholder values fail with a clear message instead of
 * being sent to eBay.
 */
export const ebayConfig: EbayAuthConfig = {
  get appId() {
    return env().clientId;
  },
  get certId() {
    return env().clientSecret;
  },
  get ruName() {
    return env().ruName;
  },
  get redirectUri() {
    return env().redirectUri;
  },
  get callbackUrl() {
    return env().redirectUri;
  },
  get scopes() {
    return env().scopes;
  },
  get sandbox() {
    return env().sandbox;
  },
};

export const EBAY_ENDPOINTS = {
  get auth() {
    return getEbayOauthUrl();
  },
  get token() {
    return `${getEbayApiUrl()}/identity/v1/oauth2/token`;
  },
  inventory: {
    get base() {
      return `${getEbayApiUrl()}/sell/inventory/v1`;
    },
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
  account: {
    get base() {
      return `${getEbayApiUrl()}/sell/account/v1`;
    },
    policies: {
      fulfillment: "/fulfillment_policy",
      payment: "/payment_policy",
      return: "/return_policy",
    },
    optIn: "/program/opt_in",
  },
} as const;

export const getHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
  "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE_ID || "EBAY_US",
  // Required by the Inventory API (createOrReplaceInventoryItem etc);
  // harmless on other Sell API calls that don't need it.
  "Content-Language": process.env.EBAY_CONTENT_LANGUAGE || "en-US",
});
