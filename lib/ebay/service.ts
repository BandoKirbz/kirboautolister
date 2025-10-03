import axios, { AxiosError, AxiosInstance } from "axios";
import { EbayClient, validatedConfig } from "./client";
import { EBAY_ENDPOINTS, getHeaders, EBAY_API_URL } from "./config";
import { ebayDb } from "./db";
import { EbayAuthResponse, EbayConnectionStatus, EbayError, EbayTokens } from "./types";
import { randomBytes } from "crypto";
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

  async getAuthUrl(userId?: string): Promise<string> {
    try {
      const state = randomBytes(16).toString('hex');
      // Include userId in state for session recovery
      const stateWithUserId = userId ? `${state}:${userId}` : state;
      
      // Log the userId for debugging
      if (userId) {
        console.log("Generating auth URL for user:", userId);
      }
      
      const params = new URLSearchParams({
        client_id: validatedConfig.appId,
        response_type: 'code',
        redirect_uri: validatedConfig.ruName, // eBay requires RuName for auth URL
        scope: validatedConfig.scopes.join(' '),
        prompt: 'login',
        state: stateWithUserId,
      });

      // Add userId as a custom parameter that will be preserved in the redirect
      if (userId) {
        params.append('user_id', userId);
      }

      // Ensure HTTPS for non-localhost URLs
      const authUrl = `${EBAY_ENDPOINTS.auth}?${params.toString()}`;
      console.log("Generated eBay auth URL:", {
        url: authUrl,
        redirectUri: validatedConfig.ruName,
        state: stateWithUserId,
        userId: userId,
        timestamp: new Date().toISOString(),
        environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION"
      });
      
      return authUrl;
    } catch (error) {
      throw this.handleError(error, "Failed to generate eBay authorization URL");
    }
  }

  async handleCallback(userId: string, code: string, state?: string, username?: string): Promise<EbayAuthResponse> {
    try {
      console.log("Handling eBay callback:", {
        userId,
        code: code.substring(0, 10) + "...",
        state,
        username,
        timestamp: new Date().toISOString(),
        sandbox: validatedConfig.sandbox
      });

      let tokenData: any;
      let userInfo: any;

      // Check if this is an eBay legacy token flow (v^1.1#) or OAuth code flow
      if (code.startsWith('v^1.1#') || code.startsWith('v1.1#') || code.includes('ebaytkn')) {
        // This is an eBay legacy token flow - we already have the token
        console.log("Detected eBay legacy token flow");
        
        // For eBay legacy token flow, the code IS the access token
        tokenData = {
          access_token: code, // Use the code as the access token
          refresh_token: code, // eBay legacy flow might not have refresh tokens
          expires_in: 7200, // Default 2 hours
          token_type: 'Bearer'
        };

        userInfo = {
          username: username || 'eBay User'
        };
      } else {
        // Standard OAuth code flow
        console.log("Detected OAuth code flow");
        
        // Exchange code for tokens
        tokenData = await this.ebayClient.exchangeCodeForToken(code);
        console.log("Token exchange successful:", {
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          timestamp: new Date().toISOString()
        });

        if (!tokenData.access_token || !tokenData.refresh_token) {
          throw new Error("Invalid token response from eBay");
        }

        // Get user info using the access token
        userInfo = await this.getUserInfo(tokenData.access_token);
        console.log("Got user info:", {
          username: userInfo?.username,
          timestamp: new Date().toISOString()
        });

        if (!userInfo?.username) {
          throw new Error("Failed to get eBay username");
        }
      }

      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Store credentials in database
      await ebayDb.createCredentials({
        userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        ebayUsername: userInfo.username,
        scope: tokenData.scope ? tokenData.scope.split(' ') : undefined
      });

      // Create platform connection
      await db.platformconnection.upsert({
        where: {
          userId_platformId: {
            userId,
            platformId: "ebay"
          }
        },
        create: {
          userId,
          platformId: "ebay",
          isEnabled: true,
          credentials: JSON.stringify({
            username: userInfo.username,
            environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION"
          })
        },
        update: {
          isEnabled: true,
          credentials: JSON.stringify({
            username: userInfo.username,
            environment: validatedConfig.sandbox ? "SANDBOX" : "PRODUCTION"
          })
        }
      });

      return {
        username: userInfo.username,
        timestamp: new Date(),
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope ? tokenData.scope.split(' ') : undefined
      };
    } catch (error) {
      console.error("eBay callback error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        timestamp: new Date().toISOString()
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
          'callname': 'GetUser',
          'responseencoding': 'JSON',
          'siteid': '0',
          'version': '1199',
        },
        headers: {
          ...getHeaders(accessToken),
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
      await ebayDb.deleteCredentials(userId);
      console.log("Successfully disconnected eBay account for user:", userId);
    } catch (error) {
      throw this.handleError(error, "Failed to disconnect eBay account");
    }
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