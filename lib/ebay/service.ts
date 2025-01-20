import { ebayClient } from "./client";
import { ebayDb } from "./db";
import { EbayInventoryItem, EbayOffer } from "./types";

export class EbayService {
  // Auth flow
  async getAuthUrl() {
    return ebayClient.getAuthUrl();
  }

  async handleCallback(userId: string, code: string) {
    try {
      // Exchange code for tokens
      const tokens = await ebayClient.exchangeCodeForToken(code);

      // Store credentials in database
      await ebayDb.createCredentials({
        userId,
        ...tokens,
      });

      return { success: true };
    } catch (error) {
      console.error("[eBay Service] Auth callback failed:", error);
      throw new Error("Failed to complete eBay authentication");
    }
  }

  async disconnect(userId: string) {
    try {
      await ebayDb.deleteCredentials(userId);
      return { success: true };
    } catch (error) {
      console.error("[eBay Service] Disconnect failed:", error);
      throw new Error("Failed to disconnect eBay account");
    }
  }

  // Listing management
  async createListing(userId: string, productId: string, data: {
    title: string;
    description: string;
    price: number;
    quantity: number;
    condition: string;
    images: string[];
    categoryId: string;
  }) {
    try {
      // Create inventory item
      const sku = `P-${productId}`;
      const inventoryItem: EbayInventoryItem = {
        sku,
        locale: "en-US",
        product: {
          title: data.title,
          description: data.description,
          imageUrls: data.images,
        },
        condition: data.condition,
        availability: {
          shipToLocationAvailability: {
            quantity: data.quantity,
          },
        },
      };

      await ebayClient.createInventoryItem(userId, inventoryItem);

      // Create offer
      const offer: EbayOffer = {
        sku,
        marketplaceId: "EBAY_US",
        format: "FIXED_PRICE",
        availableQuantity: data.quantity,
        categoryId: data.categoryId,
        listingDescription: data.description,
        listingPolicies: {
          fulfillmentPolicyId: "default", // TODO: Allow customization
          paymentPolicyId: "default",
          returnPolicyId: "default",
        },
        pricingSummary: {
          price: {
            value: data.price.toFixed(2),
            currency: "USD",
          },
        },
      };

      const { offerId } = await ebayClient.createOffer(userId, offer);

      // Create listing record in database
      await ebayDb.createListing(productId, {
        status: "ACTIVE",
        ebayItemId: offerId,
        categoryId: data.categoryId,
        lastSyncedAt: new Date(),
      });

      return { success: true, offerId };
    } catch (error) {
      console.error("[eBay Service] Create listing failed:", error);
      
      // Store error in database
      await ebayDb.createListing(productId, {
        status: "ERROR",
        errors: error instanceof Error ? error.message : "Unknown error",
      });

      throw new Error("Failed to create eBay listing");
    }
  }

  async updateListing(userId: string, productId: string, data: Partial<{
    title: string;
    description: string;
    price: number;
    quantity: number;
    condition: string;
    images: string[];
    categoryId: string;
  }>) {
    try {
      const listing = await ebayDb.getListing(productId);
      if (!listing) {
        throw new Error("eBay listing not found");
      }

      // TODO: Implement update logic using eBay Inventory API
      throw new Error("Not implemented");
    } catch (error) {
      console.error("[eBay Service] Update listing failed:", error);
      
      // Update error status in database
      await ebayDb.updateListing(productId, {
        status: "ERROR",
        errors: error instanceof Error ? error.message : "Unknown error",
      });

      throw new Error("Failed to update eBay listing");
    }
  }

  async deleteListing(userId: string, productId: string) {
    try {
      const listing = await ebayDb.getListing(productId);
      if (!listing) {
        throw new Error("eBay listing not found");
      }

      // TODO: Implement deletion logic using eBay Inventory API
      throw new Error("Not implemented");
    } catch (error) {
      console.error("[eBay Service] Delete listing failed:", error);
      throw new Error("Failed to delete eBay listing");
    }
  }

  // Sync operations
  async syncListings(userId: string) {
    try {
      const listings = await ebayDb.getActiveListings(userId);
      
      // TODO: Implement sync logic to update local listing status
      // from eBay Inventory API
      throw new Error("Not implemented");
    } catch (error) {
      console.error("[eBay Service] Sync listings failed:", error);
      throw new Error("Failed to sync eBay listings");
    }
  }

  // Analytics
  async getStats(userId: string) {
    return ebayDb.getUserStats(userId);
  }
}

// Export singleton instance
export const ebayService = new EbayService(); 