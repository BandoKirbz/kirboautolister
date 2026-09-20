import axios, { AxiosError, AxiosInstance } from "axios";
import EbayAuthToken from "ebay-oauth-nodejs-client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EBAY_API_URL, EBAY_ENDPOINTS, EBAY_MARKETPLACE_ID, ebayConfig, getHeaders } from "./config";
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

// Validate eBay configuration
const ebayConfigSchema = z.object({
  appId: z.string().min(1),
  certId: z.string().min(1),
  ruName: z.string().min(1),
  sandbox: z.boolean(),
  scopes: z.array(z.string()),
});

export const validatedConfig = {
  appId: process.env.EBAY_CLIENT_ID!,
  certId: process.env.EBAY_CLIENT_SECRET!,
  ruName: process.env.EBAY_RUNAME!,
  redirectUri: ebayConfig.redirectUri,
  sandbox: process.env.EBAY_SANDBOX === "true",
  // Falls back to the standard Sell API scope set (see ebayConfig.scopes in
  // ./config.ts) when EBAY_SCOPES isn't set. Previously this silently
  // resolved to an *empty* scope list whenever EBAY_SCOPES wasn't in
  // .env.local (it never was documented in EBAY_SETUP.md), which produced
  // an OAuth authorization URL with no scopes and made the whole sandbox
  // connect flow fail in confusing ways.
  scopes: process.env.EBAY_SCOPES
    ? process.env.EBAY_SCOPES.split(" ").filter(Boolean)
    : ebayConfig.scopes,
};

export class EbayClient {
  private axiosInstance: AxiosInstance;
  private authClient: any;

  constructor() {
    console.log("Initializing eBay client with config:", {
      ...validatedConfig,
      certId: "HIDDEN",
    });

    this.axiosInstance = axios.create({
      baseURL: process.env.EBAY_API_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.authClient = new EbayAuthToken({
      clientId: validatedConfig.appId,
      clientSecret: validatedConfig.certId,
      redirectUri: validatedConfig.redirectUri,
      env: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
    });

    // Add interceptors
    this.axiosInstance.interceptors.request.use((config) => {
      console.log("Request:", config.method?.toUpperCase(), config.url);
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      this.handleApiError
    );
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<any> {
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

      const response = await this.axiosInstance.post(
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
      console.log("Refreshing token...");
      const response = await this.authClient.getAccessToken(
        validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
        refreshToken
      );

      const data = JSON.parse(response);
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
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

      const response = await this.axiosInstance.post(
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

      const response = await this.axiosInstance.post(
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

      await this.axiosInstance.put(
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
      await this.axiosInstance.delete(
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
      await this.axiosInstance.put(
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
      const response = await this.axiosInstance.get(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.offers(sku)}`,
        { headers: getHeaders(credentials.accessToken) }
      );
      return response.data?.offers || [];
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return [];
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
      const response = await this.axiosInstance.post(
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
      await this.axiosInstance.post(
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
   * Fetch the seller's business policies (fulfillment/payment/return) for
   * the configured marketplace. eBay requires the seller to have opted in
   * to Business Policies and created at least one of each in their (sandbox
   * or production) account before offers can be published - this cannot be
   * done via API, only via Seller Hub / API account setup by the seller.
   */
  async getDefaultBusinessPolicies(userId: string): Promise<EbayBusinessPolicies> {
    try {
      const credentials = await this.getUserCredentials(userId);
      const headers = getHeaders(credentials.accessToken);
      const params = { marketplace_id: EBAY_MARKETPLACE_ID };

      const [fulfillment, payment, ret] = await Promise.all([
        this.axiosInstance.get(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.fulfillment}`,
          { headers, params }
        ),
        this.axiosInstance.get(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.payment}`,
          { headers, params }
        ),
        this.axiosInstance.get(
          `${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.return}`,
          { headers, params }
        ),
      ]);

      const fulfillmentPolicyId = fulfillment.data?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
      const paymentPolicyId = payment.data?.paymentPolicies?.[0]?.paymentPolicyId;
      const returnPolicyId = ret.data?.returnPolicies?.[0]?.returnPolicyId;

      if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
        throw new Error(
          "No eBay business policies found for this account. Before you can publish " +
            "listings, opt in to Business Policies and create at least one shipping " +
            "(fulfillment), payment, and return policy for your eBay (sandbox) seller " +
            "account, then try again."
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

      const existing = await this.axiosInstance.get(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.locations}`,
        { headers }
      );

      const locations = existing.data?.locations || [];
      if (locations.length > 0) {
        return { merchantLocationKey: locations[0].merchantLocationKey };
      }

      const merchantLocationKey = process.env.EBAY_MERCHANT_LOCATION_KEY || "default-location";
      await this.axiosInstance.post(
        `${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.locationByKey(
          merchantLocationKey
        )}`,
        {
          location: {
            address: {
              country: process.env.EBAY_MERCHANT_LOCATION_COUNTRY || "US",
              postalCode: process.env.EBAY_MERCHANT_LOCATION_POSTAL_CODE || "94105",
              stateOrProvince: process.env.EBAY_MERCHANT_LOCATION_STATE || "CA",
              city: process.env.EBAY_MERCHANT_LOCATION_CITY || "San Francisco",
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

  // Helper methods
  private async getUserCredentials(userId: string): Promise<EbayTokens> {
    const credentials = await prisma.ebaycredential.findUnique({
      where: { userId },
    });

    if (!credentials) {
      throw new Error("eBay credentials not found");
    }

    if (!credentials.expiresAt || credentials.expiresAt < new Date()) {
      const newTokens = await this.refreshToken(credentials.refreshToken);
      await prisma.ebaycredential.update({
        where: { userId },
        data: newTokens,
      });
      return newTokens;
    }

    return {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
    };
  }

  private handleApiError(error: AxiosError): never {
    if (error.response?.data) {
      const ebayError = error.response.data as { errors?: EbayError[] };
      if (ebayError.errors?.[0]) {
        throw new Error(
          `eBay API Error: ${ebayError.errors[0].message} (${ebayError.errors[0].errorId})`
        );
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
        throw new Error(
          `eBay API Error: ${errorData.errors[0].message} (${errorData.errors[0].errorId})`
        );
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
      const response = await this.axiosInstance.get(
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