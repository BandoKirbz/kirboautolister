import { BasePlatformIntegration } from "./base-platform";
import {
  PlatformCredentials,
  PlatformError,
  PlatformListing,
  PlatformProduct,
} from "./types";

interface EbayCredentials extends PlatformCredentials {
  clientId: string;
  clientSecret: string;
  ruName: string;
}

interface EbayProduct extends PlatformProduct {
  category: string; // eBay category ID
  specifics?: Record<string, string>; // Item specifics
}

export class EbayIntegration extends BasePlatformIntegration {
  private readonly apiUrl = process.env.EBAY_API_URL || "https://api.ebay.com";
  private readonly clientId = process.env.EBAY_CLIENT_ID;
  private readonly clientSecret = process.env.EBAY_CLIENT_SECRET;
  private readonly ruName = process.env.EBAY_RUNAME;

  constructor() {
    super("ebay");
  }

  async authenticate(credentials: EbayCredentials): Promise<PlatformCredentials> {
    try {
      // Implement eBay OAuth flow
      // This is a placeholder for the actual implementation
      const response = await fetch(`${this.apiUrl}/identity/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${credentials.clientId}:${credentials.clientSecret}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: credentials.accessToken!, // The authorization code from eBay
          redirect_uri: credentials.ruName,
        }),
      });

      if (!response.ok) {
        throw new Error(`eBay authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      throw this.handleError(error, "Authentication");
    }
  }

  async refreshAuth(credentials: EbayCredentials): Promise<PlatformCredentials> {
    try {
      const response = await fetch(`${this.apiUrl}/identity/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${credentials.clientId}:${credentials.clientSecret}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken!,
        }),
      });

      if (!response.ok) {
        throw new Error(`eBay token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      throw this.handleError(error, "Token refresh");
    }
  }

  async createListing(
    product: EbayProduct,
    credentials: EbayCredentials
  ): Promise<PlatformListing> {
    try {
      // Transform product data to eBay's format
      const ebayListing = this.transformProductToEbayListing(product);

      // Create listing on eBay
      const response = await fetch(`${this.apiUrl}/sell/inventory/v1/inventory_item`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        body: JSON.stringify(ebayListing),
      });

      if (!response.ok) {
        throw new Error(`Failed to create eBay listing: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        id: data.listingId,
        externalId: data.itemId,
        status: "ACTIVE",
        url: `https://www.ebay.com/itm/${data.itemId}`,
        lastSyncedAt: new Date(),
        platformSpecificData: data,
      };
    } catch (error) {
      throw this.handleError(error, "Create listing");
    }
  }

  async updateListing(
    listingId: string,
    product: Partial<EbayProduct>,
    credentials: EbayCredentials
  ): Promise<PlatformListing> {
    try {
      // Transform product data to eBay's format
      const ebayListing = this.transformProductToEbayListing(product as EbayProduct);

      // Update listing on eBay
      const response = await fetch(
        `${this.apiUrl}/sell/inventory/v1/inventory_item/${listingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${credentials.accessToken}`,
          },
          body: JSON.stringify(ebayListing),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update eBay listing: ${response.statusText}`);
      }

      return this.getListing(listingId, credentials);
    } catch (error) {
      throw this.handleError(error, "Update listing");
    }
  }

  async deleteListing(listingId: string, credentials: EbayCredentials): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiUrl}/sell/inventory/v1/inventory_item/${listingId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete eBay listing: ${response.statusText}`);
      }
    } catch (error) {
      throw this.handleError(error, "Delete listing");
    }
  }

  async getListing(listingId: string, credentials: EbayCredentials): Promise<PlatformListing> {
    try {
      const response = await fetch(
        `${this.apiUrl}/sell/inventory/v1/inventory_item/${listingId}`,
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get eBay listing: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        id: listingId,
        externalId: data.itemId,
        status: this.mapEbayStatus(data.status),
        url: `https://www.ebay.com/itm/${data.itemId}`,
        lastSyncedAt: new Date(),
        platformSpecificData: data,
      };
    } catch (error) {
      throw this.handleError(error, "Get listing");
    }
  }

  protected async validatePlatformSpecific(product: EbayProduct): Promise<string[]> {
    const errors: string[] = [];

    // Validate eBay-specific requirements
    if (!product.category) {
      errors.push("eBay category ID is required");
    }

    // Add more eBay-specific validation as needed
    // For example, check title length, validate specifics, etc.

    return errors;
  }

  // Helper methods
  private transformProductToEbayListing(product: EbayProduct) {
    return {
      title: product.title,
      description: product.description,
      price: {
        value: product.price,
        currency: "USD",
      },
      condition: this.mapConditionToEbay(product.condition),
      availability: {
        quantity: product.quantity,
      },
      categoryId: product.category,
      itemSpecifics: product.specifics,
    };
  }

  private mapConditionToEbay(condition: string): string {
    const conditionMap: Record<string, string> = {
      "new-with-tags": "NEW_WITH_TAGS",
      "new-without-tags": "NEW_WITHOUT_TAGS",
      "very-good": "VERY_GOOD",
      "good": "GOOD",
      "fair": "FAIR",
    };
    return conditionMap[condition] || "NEW_OTHER";
  }

  private mapEbayStatus(ebayStatus: string): PlatformListing["status"] {
    const statusMap: Record<string, PlatformListing["status"]> = {
      ACTIVE: "ACTIVE",
      ENDED: "SOLD",
      OUT_OF_STOCK: "SOLD",
      INACTIVE: "PAUSED",
    };
    return statusMap[ebayStatus] || "ERROR";
  }
} 