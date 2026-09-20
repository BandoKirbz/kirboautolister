import { db } from "@/lib/db";
import { EbayTokens } from "./types";

export interface CreateEbayCredentialsData extends EbayTokens {
  userId: string;
  ebayUsername?: string;
  scope?: string[];
}

export interface UpdateEbayListingData {
  status?: "DRAFT" | "PENDING" | "ACTIVE" | "ERROR" | "ENDED" | "OUT_OF_STOCK";
  ebayItemId?: string;
  categoryId?: string;
  lastSyncedAt?: Date;
  errors?: any;
  specificsList?: any;
}

export const ebayDb = {
  // Credential operations
  async createCredentials(data: CreateEbayCredentialsData) {
    return db.ebaycredential.create({
      data: {
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        ebayUsername: data.ebayUsername,
        scope: data.scope,
      },
    });
  },
  
  async updateCredentials(userId: string, data: Partial<EbayTokens>) {
    return db.ebaycredential.update({
      where: { userId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  },

  async getCredentials(userId: string) {
    return db.ebaycredential.findUnique({
      where: { userId },
    });
  },

  async deleteCredentials(userId: string) {
    return db.ebaycredential.delete({
      where: { userId },
    });
  },

  // Listing operations
  async createListing(productId: string, data: UpdateEbayListingData) {
    return db.ebaylisting.create({
      data: {
        productId,
        status: data.status || "DRAFT",
        ebayItemId: data.ebayItemId,
        categoryId: data.categoryId,
        lastSyncedAt: data.lastSyncedAt,
        errors: data.errors,
        specificsList: data.specificsList,
      },
    });
  },

  async updateListing(productId: string, data: UpdateEbayListingData) {
    return db.ebaylisting.update({
      where: { productId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  },

  async getListing(productId: string) {
    return db.ebaylisting.findUnique({
      where: { productId },
    });
  },

  async deleteListing(productId: string) {
    return db.ebaylisting.delete({
      where: { productId },
    });
  },

  // Query helpers
  async getActiveListings(userId: string) {
    return db.ebaylisting.findMany({
      where: {
        product: {
          userId,
        },
        status: "ACTIVE",
      },
      include: {
        product: {
          include: {
            images: true,
          },
        },
      },
    });
  },

  async getListingsNeedingSync(minutesThreshold = 60) {
    const threshold = new Date(Date.now() - minutesThreshold * 60 * 1000);
    
    return db.ebaylisting.findMany({
      where: {
        status: "ACTIVE",
        lastSyncedAt: {
          lt: threshold,
        },
      },
      include: {
        product: {
          include: {
            user: {
              include: {
                ebayCredential: true,
              },
            },
          },
        },
      },
    });
  },

  async getFailedListings(userId: string) {
    return db.ebaylisting.findMany({
      where: {
        product: {
          userId,
        },
        status: "ERROR",
      },
      include: {
        product: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  },

  // Stats and analytics
  async getUserStats(userId: string) {
    const [
      activeCount,
      draftCount,
      errorCount,
      totalRevenue,
    ] = await Promise.all([
      db.ebaylisting.count({
        where: {
          product: { userId },
          status: "ACTIVE",
        },
      }),
      db.ebaylisting.count({
        where: {
          product: { userId },
          status: "DRAFT",
        },
      }),
      db.ebaylisting.count({
        where: {
          product: { userId },
          status: "ERROR",
        },
      }),
      db.ebaylisting.findMany({
        where: {
          product: { userId },
          status: "ACTIVE",
        },
        include: {
          product: {
            select: {
              price: true,
            },
          },
        },
      }).then((listings: any) => 
        listings.reduce((sum: any, listing: any) => sum + (listing.product.price || 0), 0)
      ),
    ]);

    return {
      activeListings: activeCount,
      draftListings: draftCount,
      failedListings: errorCount,
      estimatedRevenue: totalRevenue,
    };
  },

  // Product quantity management
  async updateProductQuantity(productId: string, quantityChange: number) {
    if (quantityChange === 0) {
      // Set quantity to 0
      return db.product.update({
        where: { id: productId },
        data: { quantity: 0 },
      });
    } else {
      // Increment/decrement quantity
      return db.product.update({
        where: { id: productId },
        data: {
          quantity: {
            increment: quantityChange,
          },
        },
      });
    }
  },

  // Get listing by eBay item ID
  async getListingByEbayItemId(ebayItemId: string) {
    return db.ebaylisting.findFirst({
      where: { ebayItemId },
    });
  },

  // Update listing with webhook data
  async updateListingWithWebhook(
    productId: string,
    data: UpdateEbayListingData & {
      webhookData?: {
        type: string;
        timestamp: string;
        payload: any;
      };
    }
  ) {
    return db.ebaylisting.update({
      where: { productId },
      data: {
        ...data,
        // Store webhook history
        specificsList: {
          ...(data.specificsList || {}),
          webhookHistory: [
            ...(data.webhookData
              ? [{
                  type: data.webhookData.type,
                  timestamp: data.webhookData.timestamp,
                  payload: data.webhookData.payload,
                }]
              : []),
          ],
        },
      },
    });
  },
};