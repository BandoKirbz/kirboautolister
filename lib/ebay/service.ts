import axios, { AxiosError, AxiosInstance } from "axios";
import { EbayClient, validatedConfig } from "./client";
import { EBAY_ENDPOINTS, getHeaders, EBAY_API_URL } from "./config";
import { ebayDb } from "./db";
import { EbayError, EbayTokens } from "./types";


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
      // Fetch stats using the db helper
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

  // Authentication methods
  async getAuthUrl(): Promise<string> {
    try {
      const baseUrl = validatedConfig.sandbox
        ? "https://auth.sandbox.ebay.com/oauth2/authorize"
        : "https://auth.ebay.com/oauth2/authorize";

      const state = Math.random().toString(36).substring(7);

      const params = new URLSearchParams({
        client_id: validatedConfig.appId,
        response_type: "code",
        redirect_uri: validatedConfig.ruName,
        scope: validatedConfig.scopes.join(" "),
        prompt: "login",
        state: state,
      });

      const url = `${baseUrl}?${params.toString()}`;
      console.log("Generated eBay auth URL:", url);
      return url;
    } catch (error) {
      throw this.handleError(error, "Failed to generate auth URL");
    }
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

  async handleCallback(userId: string, code: string, state?: string): Promise<void> {
    try {
      // Exchange the authorization code for tokens
      const tokens = await this.ebayClient.exchangeCodeForToken(code, state);

      // Get user information
      const userInfo = await this.getUserInfo(tokens.accessToken);

      // Store the tokens in the database
      await ebayDb.createCredentials({
        userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        ebayUsername: userInfo.username,
      });

      console.log("Successfully stored eBay credentials for user:", userId);
    } catch (error) {
      throw this.handleError(error, "Failed to handle eBay callback");
    }
  }

  private async getUserInfo(accessToken: string) {
    try {
      const response = await this.axiosInstance.get(`${EBAY_API_URL}/ws/api.dll`, {
        params: {
          'callname': 'GetUser',
          'responseencoding': 'JSON',
          'siteid': '0',
          'version': '1199',
        },
        headers: {
          'X-EBAY-API-IAF-TOKEN': accessToken,
        }
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
      // Delete the eBay credentials from the database
      await ebayDb.deleteCredentials(userId);
      console.log("Successfully disconnected eBay account for user:", userId);
    } catch (error) {
      throw this.handleError(error, "Failed to disconnect eBay account");
    }
  }
} 

// Export a singleton instance
export const ebayService = new EbayService();