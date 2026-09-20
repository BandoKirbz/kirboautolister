import axios, { AxiosError, AxiosInstance } from "axios";
import { EbayClient, validatedConfig } from "./client";
import { EBAY_ENDPOINTS, getHeaders, EBAY_API_URL, EBAY_MARKETPLACE_ID } from "./config";
import { ebayDb } from "./db";
import {
  EbayAuthResponse,
  EbayConnectionStatus,
  EbayError,
  EbayListingInput,
} from "./types";
import { createEbayOAuthState, mapConditionToEbay } from "./utils";
import { db } from "../db";

export class EbayService {
  private ebayClient: EbayClient;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.ebayClient = new EbayClient();
    this.axiosInstance = axios.create({
      baseURL: EBAY_API_URL,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  async getStats(userId: string) {
    try {
      const stats = await ebayDb.getUserStats(userId);
      return {
        activeListings: stats.activeListings,
        draftListings: stats.draftListings,
        failedListings: stats.failedListings,
        estimatedRevenue: stats.estimatedRevenue,
      };
    } catch (error) {
      console.error("Error fetching eBay stats:", error);
      throw error;
    }
  }

  /**
   * Build the URL the user is sent to in order to authorize this app with
   * their eBay account. `userId` is signed into the `state` parameter so
   * the callback can reliably identify which user initiated the flow,
   * without depending on cookies/session surviving the round trip to eBay.
   */
  async getAuthUrl(userId: string): Promise<string> {
    try {
      if (!userId) {
        throw new Error("A userId is required to start the eBay OAuth flow");
      }

      const state = createEbayOAuthState(userId);

      const params = new URLSearchParams({
        client_id: validatedConfig.appId,
        response_type: "code",
        redirect_uri: validatedConfig.ruName, // eBay requires RuName here, not the raw callback URL
        scope: validatedConfig.scopes.join(" "),
        prompt: "login",
        state,
      });

      return `${EBAY_ENDPOINTS.auth}?${params.toString()}`;
    } catch (error) {
      throw this.handleError(error, "Failed to generate eBay authorization URL");
    }
  }

  /**
   * Handle the OAuth authorization code eBay sends back to our callback,
   * exchange it for tokens, and persist the connection for `userId`.
   *
   * `userId` must already be verified by the caller (see
   * `verifyEbayOAuthState` / the callback route) - this method does not
   * re-derive the user from any ambient session.
   */
  async handleCallback(userId: string, code: string): Promise<EbayAuthResponse> {
    try {
      if (!userId) throw new Error("Missing userId for eBay callback");
      if (!code) throw new Error("Missing authorization code from eBay");

      const tokenData = await this.ebayClient.exchangeCodeForToken(code);

      if (!tokenData.access_token || !tokenData.refresh_token) {
        throw new Error("Invalid token response from eBay");
      }

      const userInfo = await this.getUserInfo(tokenData.access_token);
      if (!userInfo?.username) {
        throw new Error("Failed to get eBay username");
      }

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Upsert credentials (a user may reconnect after disconnecting).
      const existing = await ebayDb.getCredentials(userId);
      if (existing) {
        await ebayDb.updateCredentials(userId, {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          scope: tokenData.scope ? tokenData.scope.split(" ") : undefined,
        });
        await db.ebaycredential.update({
          where: { userId },
          data: { ebayUsername: userInfo.username },
        });
      } else {
        await ebayDb.createCredentials({
          userId,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          ebayUsername: userInfo.username,
          scope: tokenData.scope ? tokenData.scope.split(" ") : undefined,
        });
      }

      // Create/enable the generic platform connection record.
      await db.platformconnection.upsert({
        where: { userId_platformId: { userId, platformId: "ebay" } },
        create: {
          userId,
          platformId: "ebay",
          isEnabled: true,
          credentials: JSON.stringify({
            username: userInfo.username,
            environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
          }),
        },
        update: {
          isEnabled: true,
          credentials: JSON.stringify({
            username: userInfo.username,
            environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
          }),
        },
      });

      return {
        username: userInfo.username,
        timestamp: new Date(),
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope ? tokenData.scope.split(" ") : undefined,
      };
    } catch (error) {
      console.error("eBay callback error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw this.handleError(error, "Failed to handle eBay callback");
    }
  }

  async getConnectionStatus(userId: string): Promise<EbayConnectionStatus> {
    try {
      const credentials = await ebayDb.getCredentials(userId);
      if (!credentials) {
        return {
          connected: false,
          environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
        };
      }

      return {
        connected: true,
        username: credentials.ebayUsername || undefined,
        lastConnected: credentials.updatedAt,
        environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
      };
    } catch (error) {
      console.error("Error getting eBay connection status:", error);
      return {
        connected: false,
        environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async getUserInfo(accessToken: string) {
    try {
      const response = await this.axiosInstance.get(`${EBAY_API_URL}/ws/api.dll`, {
        params: {
          callname: "GetUser",
          responseencoding: "JSON",
          siteid: "0",
          version: "1199",
        },
        headers: {
          ...getHeaders(accessToken),
          "X-EBAY-API-IAF-TOKEN": accessToken,
        },
      });

      const data = response.data.User;
      return {
        username: data.UserID,
      };
    } catch (error) {
      throw this.handleError(error, "Failed to get user information");
    }
  }

  async disconnect(userId: string): Promise<void> {
    try {
      await ebayDb.deleteCredentials(userId);
      await db.platformconnection.updateMany({
        where: { userId, platformId: "ebay" },
        data: { isEnabled: false },
      });
      console.log("Successfully disconnected eBay account for user:", userId);
    } catch (error) {
      throw this.handleError(error, "Failed to disconnect eBay account");
    }
  }

  // ---------------------------------------------------------------------
  // Listing operations
  //
  // Publishing a listing to eBay via the Sell API is a multi-step process:
  //   1. Create/replace the inventory item (product data, images, quantity)
  //   2. Create an "offer" for that item (price, category, policies)
  //   3. Publish the offer, which turns it into a live listing
  //
  // Steps 2 requires the seller to already have Business Policies
  // (payment/fulfillment/return) and at least one inventory location set
  // up on their eBay (sandbox or production) account - this is done once,
  // outside of our app, via eBay's Seller Hub / API account setup.
  // ---------------------------------------------------------------------

  async createListing(userId: string, productId: string, data: EbayListingInput) {
    const credentials = await ebayDb.getCredentials(userId);
    if (!credentials) {
      throw new Error("eBay account is not connected. Connect your eBay account and try again.");
    }

    try {
      const sku = productId;
      const categoryId = data.categoryId || process.env.EBAY_DEFAULT_CATEGORY_ID;
      if (!categoryId) {
        throw new Error(
          "Missing eBay category id. Provide categoryId, or set EBAY_DEFAULT_CATEGORY_ID for testing."
        );
      }

      const [location, policies] = await Promise.all([
        this.ebayClient.ensureMerchantLocation(userId),
        this.ebayClient.getDefaultBusinessPolicies(userId),
      ]);

      await this.ebayClient.createInventoryItem(userId, {
        sku,
        locale: "en_US",
        product: {
          title: data.title,
          description: data.description,
          imageUrls: data.images,
        },
        condition: mapConditionToEbay(data.condition),
        availability: {
          shipToLocationAvailability: { quantity: data.quantity },
        },
      });

      const offerResult = await this.ebayClient.createOffer(userId, {
        sku,
        marketplaceId: EBAY_MARKETPLACE_ID,
        format: "FIXED_PRICE",
        availableQuantity: data.quantity,
        categoryId,
        listingDescription: data.description,
        listingPolicies: policies,
        pricingSummary: {
          price: { value: data.price.toFixed(2), currency: "USD" },
        },
        merchantLocationKey: location.merchantLocationKey,
      });

      const offerId = (offerResult as any).offerId;
      if (!offerId) {
        throw new Error("eBay did not return an offer id");
      }

      const ebayItemId = await this.ebayClient.publishOffer(userId, offerId);

      await ebayDb.createListing(productId, {
        status: "ACTIVE",
        ebayItemId,
        categoryId,
        lastSyncedAt: new Date(),
        specificsList: { offerId },
      });

      await this.markListingRow(userId, productId, "ACTIVE", ebayItemId);

      return { status: "ACTIVE" as const, ebayItemId, offerId };
    } catch (error) {
      await ebayDb
        .updateListing(productId, {
          status: "ERROR",
          errors: { message: error instanceof Error ? error.message : "Unknown error" },
        })
        .catch(() => ebayDb.createListing(productId, { status: "ERROR" }));
      await this.markListingRow(
        userId,
        productId,
        "ERROR",
        undefined,
        error instanceof Error ? error.message : "Unknown error"
      );
      throw this.handleError(error, "Failed to create eBay listing");
    }
  }

  async updateListing(userId: string, productId: string, data: Partial<EbayListingInput>) {
    const credentials = await ebayDb.getCredentials(userId);
    if (!credentials) {
      throw new Error("eBay account is not connected. Connect your eBay account and try again.");
    }

    const existing = await ebayDb.getListing(productId);
    if (!existing?.ebayItemId) {
      // Never published - just create it now if we have enough data.
      if (data.title && data.description && data.price != null && data.quantity != null && data.condition && data.images) {
        return this.createListing(userId, productId, data as EbayListingInput);
      }
      throw new Error("This listing has not been published to eBay yet.");
    }

    try {
      const sku = productId;
      const offers = await this.ebayClient.getOffersForSku(userId, sku);
      const offerId = offers[0]?.offerId || (existing.specificsList as any)?.offerId;

      if (data.title || data.description || data.images || data.quantity != null || data.condition) {
        await this.ebayClient.updateInventoryItem(userId, {
          sku,
          locale: "en_US",
          product: {
            title: data.title || "",
            description: data.description || "",
            imageUrls: data.images,
          },
          condition: mapConditionToEbay(data.condition || "good"),
          availability: {
            shipToLocationAvailability: { quantity: data.quantity ?? 1 },
          },
        });
      }

      if (offerId && (data.price != null || data.quantity != null || data.description)) {
        await this.ebayClient.updateOffer(userId, offerId, {
          ...(data.price != null && {
            pricingSummary: { price: { value: data.price.toFixed(2), currency: "USD" } },
          }),
          ...(data.quantity != null && { availableQuantity: data.quantity }),
          ...(data.description && { listingDescription: data.description }),
        });
      }

      await ebayDb.updateListing(productId, { lastSyncedAt: new Date(), status: "ACTIVE" });
      await this.markListingRow(userId, productId, "ACTIVE", existing.ebayItemId);

      return { status: "ACTIVE" as const, ebayItemId: existing.ebayItemId };
    } catch (error) {
      await ebayDb.updateListing(productId, {
        status: "ERROR",
        errors: { message: error instanceof Error ? error.message : "Unknown error" },
      });
      throw this.handleError(error, "Failed to update eBay listing");
    }
  }

  async deleteListing(userId: string, productId: string) {
    const credentials = await ebayDb.getCredentials(userId);
    if (!credentials) {
      throw new Error("eBay account is not connected. Connect your eBay account and try again.");
    }

    try {
      const sku = productId;
      const existing = await ebayDb.getListing(productId);
      const offers = await this.ebayClient.getOffersForSku(userId, sku);
      const offerId = offers[0]?.offerId || (existing?.specificsList as any)?.offerId;

      if (offerId) {
        await this.ebayClient.withdrawOffer(userId, offerId);
      }
      await this.ebayClient.deleteInventoryItem(userId, sku);
      await ebayDb.deleteListing(productId).catch(() => undefined);
      await this.markListingRow(userId, productId, "ENDED");
    } catch (error) {
      throw this.handleError(error, "Failed to delete eBay listing");
    }
  }

  /** Update the platform-agnostic `listing` row for this product/eBay pair. */
  private async markListingRow(
    userId: string,
    productId: string,
    status: "ACTIVE" | "ERROR" | "ENDED",
    platformListingId?: string,
    errorMessage?: string
  ) {
    await db.listing
      .updateMany({
        where: { userId, productId, platformId: "ebay" },
        data: {
          status,
          platformListingId,
          errors: errorMessage ?? null,
        },
      })
      .catch((err) => console.error("Failed to update listing row:", err));
  }

  private handleError(error: any, context: string): never {
    console.error(`[eBay Service] ${context}:`, error);

    if (error instanceof AxiosError) {
      const errorData = error.response?.data as { errors?: EbayError[] };
      if (errorData?.errors?.[0]) {
        throw new Error(
          `eBay API Error: ${errorData.errors[0].message} (${errorData.errors[0].errorId})`
        );
      }
      throw new Error(`${context}: ${error.message}`);
    }

    if (error instanceof Error) {
      throw new Error(`${context}: ${error.message}`);
    }

    throw new Error(`${context}: Unknown error`);
  }
}

// Export a singleton instance
export const ebayService = new EbayService();
