import { db } from "@/lib/db";
import {
  PlatformCredentials,
  PlatformError,
  PlatformId,
  PlatformIntegration,
  PlatformListing,
  PlatformProduct,
  platformCredentialsSchema,
  platformProductSchema,
} from "./types";

export abstract class BasePlatformIntegration implements PlatformIntegration {
  constructor(public readonly platformId: PlatformId) {}

  // Authentication methods
  abstract authenticate(credentials: PlatformCredentials): Promise<PlatformCredentials>;
  abstract refreshAuth(credentials: PlatformCredentials): Promise<PlatformCredentials>;

  async validateAuth(credentials: PlatformCredentials): Promise<boolean> {
    try {
      const validated = platformCredentialsSchema.parse(credentials);
      if (!validated.accessToken) return false;
      
      // Check if token is expired
      if (validated.expiresAt && validated.expiresAt < new Date()) {
        if (!validated.refreshToken) return false;
        // Try to refresh the token
        const refreshedCreds = await this.refreshAuth(validated);
        return !!refreshedCreds.accessToken;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Listing operations
  abstract createListing(
    product: PlatformProduct,
    credentials: PlatformCredentials
  ): Promise<PlatformListing>;
  
  abstract updateListing(
    listingId: string,
    product: Partial<PlatformProduct>,
    credentials: PlatformCredentials
  ): Promise<PlatformListing>;
  
  abstract deleteListing(
    listingId: string,
    credentials: PlatformCredentials
  ): Promise<void>;
  
  abstract getListing(
    listingId: string,
    credentials: PlatformCredentials
  ): Promise<PlatformListing>;

  // Sync operations
  async syncListing(
    listingId: string,
    credentials: PlatformCredentials
  ): Promise<PlatformListing> {
    try {
      // Get the latest listing data from the platform
      const platformListing = await this.getListing(listingId, credentials);

      // Update the listing in our database
      await db.listing.update({
        where: { id: listingId },
        data: {
          status: platformListing.status,
          lastSyncedAt: new Date(),
          externalId: platformListing.externalId,
          url: platformListing.url,
          platformSpecificData: platformListing.platformSpecificData,
        },
      });

      return platformListing;
    } catch (error) {
      throw new PlatformError(
        `Failed to sync listing: ${error.message}`,
        this.platformId,
        "SYNC_ERROR",
        error
      );
    }
  }

  async validateProduct(product: PlatformProduct): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // Validate against base schema
      platformProductSchema.parse(product);
      
      // Platform-specific validation
      const errors = await this.validatePlatformSpecific(product);
      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => e.message),
        };
      }
      throw error;
    }
  }

  // Helper method for platform-specific validation
  protected abstract validatePlatformSpecific(product: PlatformProduct): Promise<string[]>;

  // Utility methods
  protected async updatePlatformConnection(userId: string, credentials: PlatformCredentials) {
    await db.platformconnection.upsert({
      where: {
        userId_platformId: {
          userId,
          platformId: this.platformId,
        },
      },
      create: {
        userId,
        platformId: this.platformId,
        credentials,
        isEnabled: true,
        lastSyncedAt: new Date(),
      },
      update: {
        credentials,
        isEnabled: true,
        lastSyncedAt: new Date(),
      },
    });
  }

  protected handleError(error: any, operation: string): never {
    console.error(`[${this.platformId}] ${operation} error:`, error);
    
    if (error instanceof PlatformError) {
      throw error;
    }

    throw new PlatformError(
      `${operation} failed: ${error.message}`,
      this.platformId,
      error.code || "UNKNOWN_ERROR",
      error
    );
  }
} 