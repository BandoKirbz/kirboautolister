import axios, { AxiosError, AxiosInstance } from "axios";
import EbayAuthToken from "ebay-oauth-nodejs-client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  scopes: (process.env.EBAY_SCOPES || "").split(" ").filter(Boolean),
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
      // Validate state if provided
      if (state && !this.validateState(state)) {
        throw new Error("Invalid state parameter");
      }

      console.log("Exchanging code for token...");
      console.log("Environment:", validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION");
      console.log("RuName:", validatedConfig.ruName);
      console.log("Code:", code);

      const response = await this.authClient.exchangeCodeForAccessToken(
        validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION",
        code
      );

      console.log("Raw token exchange response:", response);
      
      let data;
      try {
        data = JSON.parse(response);
        console.log("Parsed token data:", {
          ...data,
          access_token: "HIDDEN",
          refresh_token: "HIDDEN",
        });
      } catch (parseError) {
        console.error("Failed to parse token response:", parseError);
        throw new Error("Invalid token response format");
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error("Error exchanging code for token:", error);
      if (error instanceof AxiosError) {
        console.error("API Error Response:", error.response?.data);
      }
      throw error;
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
  ): Promise<EbayApiResponse<{ offerId: string }>> {
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