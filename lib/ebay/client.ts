import axios, { AxiosError, AxiosInstance } from "axios";
import EbayAuthToken from "ebay-oauth-nodejs-client";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { EBAY_ENDPOINTS, EBAY_MARKETPLACE_ID, getHeaders } from "./config";
import { getEbayEnv } from "./env";
import {
  EbayApiResponse,
  EbayBusinessPolicies,
  EbayError,
  EbayInventoryItem,
  EbayMerchantLocation,
  EbayOffer,
  EbayTokens,
  ebayInventoryItemSchema,
  ebayOfferSchema,
} from "./types";

/**
 * eBay's `message` field is often generic/unhelpful (e.g. "Invalid
 * request"); `longMessage` and `parameters` usually contain the actual
 * useful detail (e.g. which field/header was invalid), so surface all of
 * it instead of just the errorId. Kept as a standalone function (not a
 * class method) since it's used from axios interceptor callbacks that
 * don't preserve `this`.
 */
function formatEbayError(ebayError: EbayError): string {
  const detail =
    ebayError.longMessage && ebayError.longMessage !== ebayError.message
      ? ` - ${ebayError.longMessage}`
      : "";
  const params = ebayError.parameters?.length
    ? ` [${ebayError.parameters.map((p) => `${p.name}=${p.value}`).join(", ")}]`
    : "";
  return `eBay API Error: ${ebayError.message}${detail} (${ebayError.errorId})${params}`;
}

/**
 * eBay's sandbox (and occasionally production) connection is flaky enough
 * in practice to hit transient network errors (`ECONNRESET`) and 5xx/429
 * responses on otherwise-valid requests - observed live during testing,
 * not hypothetical. Retrying a couple of times with a short backoff turns
 * those into invisible blips instead of a failed listing/update that
 * looks like a real bug to the user. Only errors with no response body
 * (name mismatch scenarios already have a genuine eBay `errors[]` to
 * report) or a retryable status are retried - anything else fails fast.
 */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"]);

function isRetryableEbayError(error: AxiosError): boolean {
  if (error.code && RETRYABLE_CODES.has(error.code)) return true;
  if (error.response && RETRYABLE_STATUSES.has(error.response.status)) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadValidatedConfig() {
  const env = getEbayEnv();
  return {
    appId: env.clientId,
    certId: env.clientSecret,
    ruName: env.ruName,
    // eBay authorize + token endpoints expect RuName, not the https callback URL.
    redirectUri: env.ruName,
    sandbox: env.sandbox,
    scopes: env.scopes,
  };
}

/** Live config — reads .env.local via getEbayEnv() on each access. */
export const validatedConfig = {
  get appId() {
    return loadValidatedConfig().appId;
  },
  get certId() {
    return loadValidatedConfig().certId;
  },
  get ruName() {
    return loadValidatedConfig().ruName;
  },
  get redirectUri() {
    return loadValidatedConfig().redirectUri;
  },
  get sandbox() {
    return loadValidatedConfig().sandbox;
  },
  get scopes() {
    return loadValidatedConfig().scopes;
  },
};

export class EbayClient {
  private axiosInstance: AxiosInstance | null = null;
  private authClient: any = null;

  private ensureReady() {
    if (this.axiosInstance && this.authClient) return;
    const config = loadValidatedConfig();

    this.axiosInstance = axios.create({
      baseURL: getEbayEnv().apiUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.authClient = new EbayAuthToken({
      clientId: config.appId,
      clientSecret: config.certId,
      redirectUri: config.ruName,
      env: config.sandbox ? "SANDBOX" : "PRODUCTION",
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as (typeof error.config & { _retryCount?: number }) | undefined;
        if (config && isRetryableEbayError(error)) {
          config._retryCount = (config._retryCount || 0) + 1;
          if (config._retryCount <= MAX_RETRIES) {
            const delayMs = RETRY_BASE_DELAY_MS * config._retryCount;
            console.warn(
              `[eBay Client] Transient error (${error.code || error.response?.status}) on ` +
                `${config.method?.toUpperCase()} ${config.url} - retrying ` +
                `${config._retryCount}/${MAX_RETRIES} in ${delayMs}ms`
            );
            await sleep(delayMs);
            return this.axiosInstance!.request(config);
          }
        }
        return this.handleApiError(error);
      }
    );
  }

  private http(): AxiosInstance {
    this.ensureReady();
    return this.axiosInstance!;
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<any> {
    this.ensureReady();
    try {
      console.log("Exchanging code for token:", {
        environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
        timestamp: new Date().toISOString(),
        code: code.substring(0, 10) + "..." // Log first 10 chars for debugging
      });

      if (!code) {
        throw new Error("Authorization code is required");
      }

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: validatedConfig.ruName, // eBay requires RuName for token exchange
      });

      console.log("Token exchange request:", {
        url: EBAY_ENDPOINTS.token,
        redirect_uri: validatedConfig.ruName, // Using RuName for token exchange
        code: code.substring(0, 20) + "...",
        timestamp: new Date().toISOString()
      });

      const response = await this.http().post(
        EBAY_ENDPOINTS.token,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${validatedConfig.appId}:${validatedConfig.certId}`
            ).toString('base64')}`,
          },
        }
      );

      if (!response.data || !response.data.access_token) {
        throw new Error("Invalid token response from eBay");
      }

      console.log("Token exchange successful:", {
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        timestamp: new Date().toISOString(),
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token
      });

      return response.data;
    } catch (error) {
      console.error("Token exchange error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        requestUrl: EBAY_ENDPOINTS.token,
        environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION"
      });

      if (error instanceof AxiosError && error.response) {
        console.error("eBay API error response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          requestUrl: EBAY_ENDPOINTS.token,
          requestParams: {
            grant_type: 'authorization_code',
            code: code.substring(0, 20) + "...",
            redirect_uri: validatedConfig.ruName
          }
        });
      }

      throw this.handleError(error, "Failed to exchange code for token");
    }
  }

  private validateState(state: string): boolean {
    return typeof state === "string" && state.length > 0;
  }

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      this.ensureReady();
      console.log("Refreshing token...");
      // The underlying library requires `scopes` for the refresh_token
      // grant (it throws "scopes is required" without it, silently
      // breaking every token refresh ~2 hours after connecting until the
      // user fully reconnects) - caught by scripts/verify-ebay-integration.ts.
      const response = await this.authClient.getAccessToken(
        validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
        refreshToken,
        validatedConfig.scopes
      );

      const data = JSON.parse(response);
      return {
        accessToken: data.access_token,
        // eBay's refresh_token grant response normally does NOT include a
        // new refresh_token (they're long-lived and reused) - fall back to
        // the one we refreshed with so callers never persist `undefined`.
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error("Error refreshing token:", error);
      throw error;
    }
  }

  // Inventory methods
  async createInventoryItem(
    userId: string,
    item: EbayInventoryItem
  ): Promise<EbayApiResponse<void>> {
    try {
      if (!userId || typeof userId !== "string") {
        throw new Error("Invalid user ID");
      }

      const validatedItem = ebayInventoryItemSchema.parse(item);
      const credentials = await this.getUserCredentials(userId);

      // eBay's createOrReplaceInventoryItem call is PUT-only; POST returns
      // a generic, unhelpful "Invalid request" (2004) with no indication
      // that the method itself is wrong.
      const response = await this.http().put(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.item(item.sku)}`,
        validatedItem,
        {
          headers: getHeaders(credentials.accessToken),
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error, "Failed to create inventory item");
    }
  }

  async createOffer(
    userId: string,
    offer: EbayOffer
  ): Promise<EbayApiResponse<{ offerId: string }> & { offerId?: string }> {
    try {
      if (!userId || typeof userId !== "string") {
        throw new Error("Invalid user ID");
      }

      const validatedOffer = ebayOfferSchema.parse(offer);
      const credentials = await this.getUserCredentials(userId);

      const response = await this.http().post(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.offer}`,
        validatedOffer,
        {
          headers: getHeaders(credentials.accessToken),
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error, "Failed to create offer");
    }
  }

  async updateInventoryItem(
    userId: string,
    item: EbayInventoryItem
  ): Promise<void> {
    try {
      const validatedItem = ebayInventoryItemSchema.parse(item);
      const credentials = await this.getUserCredentials(userId);

      await this.http().put(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.item(item.sku)}`,
        validatedItem,
        { headers: getHeaders(credentials.accessToken) }
      );
    } catch (error) {
      throw this.handleError(error, "Failed to update inventory item");
    }
  }

  async deleteInventoryItem(userId: string, sku: string): Promise<void> {
    try {
      const credentials = await this.getUserCredentials(userId);
      await this.http().delete(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.item(sku)}`,
        { headers: getHeaders(credentials.accessToken) }
      );
    } catch (error) {
      // eBay returns 404 if it's already gone - treat that as success.
      if (error instanceof AxiosError && error.response?.status === 404) return;
      throw this.handleError(error, "Failed to delete inventory item");
    }
  }

  async updateOffer(userId: string, offerId: string, offer: Partial<EbayOffer>): Promise<void> {
    try {
      const credentials = await this.getUserCredentials(userId);
      await this.http().put(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.offerById(offerId)}`,
        offer,
        { headers: getHeaders(credentials.accessToken) }
      );
    } catch (error) {
      throw this.handleError(error, "Failed to update offer");
    }
  }

  async getOffersForSku(userId: string, sku: string): Promise<any[]> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const response = await this.http().get(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.offers(sku)}`,
        { headers: getHeaders(credentials.accessToken) }
      );
      return response.data?.offers || [];
    } catch (error) {
      // 404 means "no offers found" directly. eBay also returns HTTP 400
      // with errorId 25713 ("This Offer is not available") for the same
      // "nothing exists yet for this SKU" case - that's expected for a
      // brand-new SKU, not a real failure. Note: the response interceptor
      // (handleApiError) already converts AxiosErrors into plain Errors
      // with the errorId baked into the message (e.g. "... (25713)"), so
      // by the time we get here `error` is no longer an AxiosError - match
      // on the message instead of the (already-gone) response body.
      if (error instanceof AxiosError && error.response?.status === 404) return [];
      if (error instanceof Error && /\(25713\)/.test(error.message)) return [];
      throw this.handleError(error, "Failed to fetch offers for SKU");
    }
  }

  /**
   * Publish a previously created offer, making it a live eBay listing.
   * Returns the resulting eBay listing (item) id.
   */
  async publishOffer(userId: string, offerId: string): Promise<string> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const response = await this.http().post(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.publishOffer(offerId)}`,
        {},
        { headers: getHeaders(credentials.accessToken) }
      );
      return response.data.listingId;
    } catch (error) {
      throw this.handleError(error, "Failed to publish offer");
    }
  }

  async withdrawOffer(userId: string, offerId: string): Promise<void> {
    try {
      const credentials = await this.getUserCredentials(userId);
      await this.http().post(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.withdrawOffer(offerId)}`,
        {},
        { headers: getHeaders(credentials.accessToken) }
      );
    } catch (error) {
      // Already ended/withdrawn - not fatal.
      if (error instanceof AxiosError && error.response?.status === 404) return;
      throw this.handleError(error, "Failed to withdraw offer");
    }
  }

  /**
   * eBay requires sellers to explicitly opt in to the Business Policies
   * program before fulfillment/payment/return policies can be listed or
   * created, and before inventory locations work at all. This is a
   * one-time, idempotent, per-account call - safe to call every time;
   * eBay returns an error if already opted in, which we ignore.
   */
  private async optInToBusinessPolicies(headers: Record<string, string>) {
    try {
      // Bypass this.http()'s response interceptor (which converts errors
      // to plain Errors, losing the status code) so we can reliably tell
      // "already opted in" (409) apart from a real failure.
      await axios.post(
        `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.optIn}`,
        { programType: "SELLING_POLICY_MANAGEMENT" },
        { headers }
      );
    } catch {
      // Opt-in errors are never fatal on their own: eBay returns 409 once
      // already opted in (the common case after the first call), and any
      // genuine eligibility problem will surface with a clear message
      // from the policy fetch/create calls that follow this.
    }
  }

  /**
   * Fetch the seller's business policies (fulfillment/payment/return) for
   * the configured marketplace, auto opting-in and creating sensible
   * defaults for any that are missing so a brand-new (sandbox or
   * production) seller account works out of the box.
   */
  async getDefaultBusinessPolicies(userId: string): Promise<EbayBusinessPolicies> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const headers = getHeaders(credentials.accessToken);
      const params = { marketplace_id: EBAY_MARKETPLACE_ID };

      await this.optInToBusinessPolicies(headers);

      const [fulfillment, payment, ret] = await Promise.all([
        this.http().get(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.fulfillment}`,
          { headers, params }
        ),
        this.http().get(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.payment}`,
          { headers, params }
        ),
        this.http().get(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.return}`,
          { headers, params }
        ),
      ]);

      let fulfillmentPolicyId = fulfillment.data?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
      let paymentPolicyId = payment.data?.paymentPolicies?.[0]?.paymentPolicyId;
      let returnPolicyId = ret.data?.returnPolicies?.[0]?.returnPolicyId;

      const categoryTypes = [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }];

      if (!fulfillmentPolicyId) {
        const created = await this.http().post(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.fulfillment}`,
          {
            name: "Kirbo Autolister Default Shipping",
            marketplaceId: EBAY_MARKETPLACE_ID,
            categoryTypes,
            handlingTime: { value: 1, unit: "DAY" },
            shippingOptions: [
              {
                optionType: "DOMESTIC",
                costType: "FLAT_RATE",
                shippingServices: [
                  {
                    sortOrder: 1,
                    shippingCarrierCode: "USPS",
                    shippingServiceCode: "USPSPriority",
                    shippingCost: { value: "5.00", currency: "USD" },
                    freeShipping: false,
                  },
                ],
              },
            ],
          },
          { headers }
        );
        fulfillmentPolicyId = created.data.fulfillmentPolicyId;
      }

      if (!paymentPolicyId) {
        const created = await this.http().post(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.payment}`,
          {
            name: "Kirbo Autolister Default Payment",
            marketplaceId: EBAY_MARKETPLACE_ID,
            categoryTypes,
            immediatePay: false,
          },
          { headers }
        );
        paymentPolicyId = created.data.paymentPolicyId;
      }

      if (!returnPolicyId) {
        const created = await this.http().post(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.return}`,
          {
            name: "Kirbo Autolister Default Returns",
            marketplaceId: EBAY_MARKETPLACE_ID,
            categoryTypes,
            returnsAccepted: true,
            returnPeriod: { value: 30, unit: "DAY" },
            refundMethod: "MONEY_BACK",
            returnShippingCostPayer: "BUYER",
          },
          { headers }
        );
        returnPolicyId = created.data.returnPolicyId;
      }

      if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
        throw new Error(
          "Could not find or create eBay business policies for this account."
        );
      }

      return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
    } catch (error) {
      throw this.handleError(error, "Failed to fetch eBay business policies");
    }
  }

  /**
   * Ensure the seller has at least one inventory location, creating a
   * default one from EBAY_MERCHANT_LOCATION_* env vars if needed. eBay
   * requires a merchantLocationKey on every offer.
   */
  async ensureMerchantLocation(userId: string): Promise<EbayMerchantLocation> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const headers = getHeaders(credentials.accessToken);

      const existing = await this.http().get(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.locations}`,
        { headers }
      );

      const locations = existing.data?.locations || [];
      if (locations.length > 0) {
        return { merchantLocationKey: locations[0].merchantLocationKey };
      }

      const merchantLocationKey = process.env.EBAY_MERCHANT_LOCATION_KEY || "default-location";
      await this.http().post(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.locationByKey(
          merchantLocationKey
        )}`,
        {
          location: {
            address: {
              // eBay's inventory location API returns an opaque "System
              // error" (25001) if addressLine1 is omitted, even though
              // their docs list it as optional - always send it.
              addressLine1:
                process.env.EBAY_MERCHANT_LOCATION_ADDRESS_LINE1 || "2005 Hamilton Ave",
              city: process.env.EBAY_MERCHANT_LOCATION_CITY || "San Jose",
              stateOrProvince: process.env.EBAY_MERCHANT_LOCATION_STATE || "CA",
              postalCode: process.env.EBAY_MERCHANT_LOCATION_POSTAL_CODE || "95125",
              country: process.env.EBAY_MERCHANT_LOCATION_COUNTRY || "US",
            },
          },
          locationTypes: ["WAREHOUSE"],
          name: "Default Location",
          merchantLocationStatus: "ENABLED",
        },
        { headers }
      );

      return { merchantLocationKey };
    } catch (error) {
      throw this.handleError(error, "Failed to set up eBay inventory location");
    }
  }

  /**
   * Return a valid (refreshed if necessary) access token for this user.
   * Public wrapper around getUserCredentials() for callers that just need
   * to make an ad-hoc authenticated request (e.g. the eBay integration
   * health-check script) without going through a specific business method.
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const credentials = await this.getUserCredentials(userId);
    return credentials.accessToken;
  }

  // Helper methods
  private async getUserCredentials(userId: string): Promise<EbayTokens> {
    const row = await prisma.ebaycredential.findUnique({
      where: { userId },
    });

    if (!row) {
      throw new Error("eBay credentials not found");
    }

    // accessToken/refreshToken are encrypted at rest (lib/crypto.ts) -
    // decrypt() transparently passes through any pre-encryption-rollout
    // plaintext rows unchanged.
    const credentials = {
      accessToken: decrypt(row.accessToken),
      refreshToken: decrypt(row.refreshToken),
      expiresAt: row.expiresAt,
    };

    if (!credentials.expiresAt || credentials.expiresAt < new Date()) {
      const newTokens = await this.refreshToken(credentials.refreshToken);
      await prisma.ebaycredential.update({
        where: { userId },
        data: {
          accessToken: encrypt(newTokens.accessToken),
          refreshToken: encrypt(newTokens.refreshToken),
          expiresAt: newTokens.expiresAt,
        },
      });
      return newTokens;
    }

    return credentials;
  }

  private handleApiError(error: AxiosError): never {
    if (error.response?.data) {
      const ebayError = error.response.data as { errors?: EbayError[] };
      if (ebayError.errors?.[0]) {
        throw new Error(formatEbayError(ebayError.errors[0]));
      }
    }
    throw error;
  }

  private handleError(error: any, context: string): never {
    console.error(`[eBay Client] ${context}:`, error);

    if (error instanceof AxiosError) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as { errors?: EbayError[] };
      if (errorData?.errors?.[0]) {
        throw new Error(formatEbayError(errorData.errors[0]));
      }
      throw new Error(`${context}: ${axiosError.message}`);
    }

    if (error instanceof Error) {
      throw new Error(`${context}: ${error.message}`);
    }

    throw new Error(`${context}: Unknown error`);
  }
  async getListings(accessToken: string): Promise<any[]> {
    try {
      const response = await this.http().get(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.offer}`,
        {
          headers: getHeaders(accessToken),
        }
      );
      return response.data.items; // Adjust based on the actual API response
    } catch (error) {
      throw this.handleError(error, "Failed to fetch listings");
    }
  }
  
  async syncListings(accessToken: string): Promise<void> {
    try {
      // Implement the logic to sync listings
      // For example, fetch listings from eBay and update your database
      const listings = await this.getListings(accessToken);
  
      // Add logic to sync listings with your database
      console.log("Syncing listings:", listings);
    } catch (error) {
      throw this.handleError(error, "Failed to sync listings");
    }
  }
}

// Singleton instance
let ebayClientInstance: EbayClient | null = null;

export const getEbayClient = (): EbayClient => {
  if (!ebayClientInstance) {
    ebayClientInstance = new EbayClient();
  }
  return ebayClientInstance;
};