import { EbayService } from "./service";
import { PlatformAdapter, UnifiedProduct, PlatformListingResponse } from "../types";
import { ebayDb } from "./db";

export class EbayAdapter extends PlatformAdapter {
  private ebayService: EbayService;

  constructor() {
    super();
    this.ebayService = new EbayService();
  }

  async createListing(product: UnifiedProduct): Promise<PlatformListingResponse> {
    try {
      // Get eBay credentials for the user
      const credentials = await ebayDb.getCredentials(product.userId);
      if (!credentials) {
        throw new Error("eBay credentials not found");
      }

      // Map the unified product to eBay format
      const ebayListing = this.mapToEbayFormat(product);

      // Create the listing on eBay
      const result = await this.ebayService.createListing(
        product.userId,
        ebayListing,
        credentials.accessToken
      );

      return {
        id: result.listingId,
        status: "ACTIVE",
        platformSpecificData: result
      };
    } catch (error) {
      console.error("Failed to create eBay listing:", error);
      return {
        id: "",
        status: "ERROR",
        errors: [error instanceof Error ? error.message : "Unknown error"]
      };
    }
  }

  async updateListing(id: string, product: Partial<UnifiedProduct>): Promise<PlatformListingResponse> {
    try {
      const credentials = await ebayDb.getCredentials(product.userId!);
      if (!credentials) {
        throw new Error("eBay credentials not found");
      }

      const ebayListing = this.mapToEbayFormat(product as UnifiedProduct);
      await this.ebayService.updateListing(
        product.userId!,
        id,
        ebayListing,
        credentials.accessToken
      );

      return {
        id,
        status: "ACTIVE",
      };
    } catch (error) {
      console.error("Failed to update eBay listing:", error);
      return {
        id,
        status: "ERROR",
        errors: [error instanceof Error ? error.message : "Unknown error"]
      };
    }
  }

  async deleteListing(id: string): Promise<void> {
    try {
      const listing = await ebayDb.getListing(id);
      if (!listing) {
        throw new Error("Listing not found");
      }

      const credentials = await ebayDb.getCredentials(listing.userId);
      if (!credentials) {
        throw new Error("eBay credentials not found");
      }

      await this.ebayService.deleteListing(listing.userId, id);
    } catch (error) {
      console.error("Failed to delete eBay listing:", error);
      throw error;
    }
  }

  async getListing(id: string): Promise<UnifiedProduct> {
    try {
      const listing = await ebayDb.getListing(id);
      if (!listing) {
        throw new Error("Listing not found");
      }

      const credentials = await ebayDb.getCredentials(listing.userId);
      if (!credentials) {
        throw new Error("eBay credentials not found");
      }

      const ebayListing = await this.ebayService.getListing(listing.userId, id);
      return this.mapFromEbayFormat(ebayListing);
    } catch (error) {
      console.error("Failed to get eBay listing:", error);
      throw error;
    }
  }

  async syncListing(id: string): Promise<PlatformListingResponse> {
    try {
      const listing = await ebayDb.getListing(id);
      if (!listing) {
        throw new Error("Listing not found");
      }

      const credentials = await ebayDb.getCredentials(listing.userId);
      if (!credentials) {
        throw new Error("eBay credentials not found");
      }

      const result = await this.ebayService.syncListing(listing.userId, id);
      return {
        id,
        status: result.status,
        platformSpecificData: result
      };
    } catch (error) {
      console.error("Failed to sync eBay listing:", error);
      return {
        id,
        status: "ERROR",
        errors: [error instanceof Error ? error.message : "Unknown error"]
      };
    }
  }

  private mapToEbayFormat(product: UnifiedProduct): any {
    return {
      title: product.title,
      description: product.description,
      startPrice: product.price,
      quantity: product.quantity,
      pictureUrls: product.images,
      condition: this.mapConditionToEbay(product.condition),
      categoryId: product.category,
      itemSpecifics: Object.entries(product.specifications).map(([name, value]) => ({
        name,
        value: [value]
      }))
    };
  }

  private mapFromEbayFormat(ebayListing: any): UnifiedProduct {
    return {
      title: ebayListing.title,
      description: ebayListing.description,
      price: parseFloat(ebayListing.price.value),
      quantity: ebayListing.quantity,
      images: ebayListing.images || [],
      condition: this.mapConditionFromEbay(ebayListing.condition),
      category: ebayListing.categoryId,
      specifications: this.mapSpecificationsFromEbay(ebayListing.itemSpecifics),
      userId: ebayListing.userId
    };
  }

  private mapConditionToEbay(condition: string): string {
    // Implement condition mapping logic
    const conditionMap: Record<string, string> = {
      "new": "1000",
      "like-new": "1500",
      "used": "3000",
      // Add more mappings as needed
    };
    return conditionMap[condition.toLowerCase()] || "3000";
  }

  private mapConditionFromEbay(condition: string): string {
    // Implement reverse condition mapping logic
    const conditionMap: Record<string, string> = {
      "1000": "new",
      "1500": "like-new",
      "3000": "used",
      // Add more mappings as needed
    };
    return conditionMap[condition] || "used";
  }

  private mapSpecificationsFromEbay(itemSpecifics: any[]): Record<string, string> {
    const specs: Record<string, string> = {};
    if (Array.isArray(itemSpecifics)) {
      itemSpecifics.forEach(spec => {
        specs[spec.name] = Array.isArray(spec.value) ? spec.value[0] : spec.value;
      });
    }
    return specs;
  }
} 