import axios, { AxiosError, AxiosInstance } from "axios";
import EbayAuthToken from "ebay-oauth-nodejs-client";

import { db } from "@/lib/db";

import { EBAY_API_URL, EBAY_ENDPOINTS, ebayConfig, getHeaders } from "./config";
import {
  EbayApiResponse,
  EbayError,
  EbayInventoryItem,
  EbayOffer,
  EbayTokens,
  ebayInventoryItemSchema,
  ebayOfferSchema,
} from "./types";

export class EbayClient {
  private axiosInstance: AxiosInstance;
  private authClient: any; // Type from ebay-oauth-nodejs-client

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: EBAY_API_URL,
    });

    this.authClient = new EbayAuthToken({
      clientId: ebayConfig.appId,
      clientSecret: ebayConfig.certId,
      devid: ebayConfig.devId,
      redirectUri: ebayConfig.ruName,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      this.handleApiError
    );
  }

  // Authentication methods
  async getAuthUrl(): Promise<string> {
    try {
      return this.authClient.generateUserAuthorizationUrl("PRODUCTION", ebayConfig.scopes);
    } catch (error) {
      throw this.handleError(error, "Failed to generate auth URL");
    }
  }

  async exchangeCodeForToken(code: string): Promise<EbayTokens> {
    try {
      const response = await this.authClient.exchangeCodeForAccessToken("PRODUCTION", code);
      const data = JSON.parse(response);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      throw this.handleError(error, "Failed to exchange code for token");
    }
  }

  async refreshToken(refreshToken: string): Promise<EbayTokens> {
    try {
      const response = await this.authClient.getAccessToken("PRODUCTION", refreshToken);
      const data = JSON.parse(response);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      throw this.handleError(error, "Failed to refresh token");
    }
  }

  // Inventory methods
  async createInventoryItem(
    userId: string,
    item: EbayInventoryItem
  ): Promise<EbayApiResponse<void>> {
    try {
      // Validate item data
      const validatedItem = ebayInventoryItemSchema.parse(item);

      // Get user's eBay credentials
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

  async createOffer(userId: string, offer: EbayOffer): Promise<EbayApiResponse<{ offerId: string }>> {
    try {
      // Validate offer data
      const validatedOffer = ebayOfferSchema.parse(offer);

      // Get user's eBay credentials
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

  // Helper methods
  private async getUserCredentials(userId: string): Promise<EbayTokens> {
    const credentials = await db.ebaycredential.findUnique({
      where: { userId },
    });

    if (!credentials) {
      throw new Error("eBay credentials not found");
    }

    // Check if token needs refresh
    if (credentials.expiresAt < new Date()) {
      const newTokens = await this.refreshToken(credentials.refreshToken);
      
      // Update credentials in database
      await db.ebaycredential.update({
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
    
    if (error instanceof Error) {
      throw new Error(`${context}: ${error.message}`);
    }
    
    throw new Error(`${context}: Unknown error`);
  }
}

// Export a singleton instance
export const ebayClient = new EbayClient(); 