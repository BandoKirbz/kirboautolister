import { db } from "@/lib/db";
import { z } from "zod";
import { ListingStatus } from "@prisma/client";
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
          status: platformListing.status as ListingStatus,
          updatedAt: new Date(),
          platformListingId: platformListing.externalId,
        },
      });

      return platformListing;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new PlatformError(
          `Failed to sync listing: ${error.message}`,
          this.platformId,
          "SYNC_ERROR",
          error
        );
      }
      throw new PlatformError(
        "Failed to sync listing: Unknown error",
        this.platformId,
        "SYNC_ERROR"
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
        credentials: JSON.stringify(credentials),
        isEnabled: true,
      },
      update: {
        credentials: JSON.stringify(credentials),
        isEnabled: true,
      },
    });
  }

  protected handleError(error: unknown, operation: string): never {
    console.error(`[${this.platformId}] ${operation} error:`, error);
    
    if (error instanceof PlatformError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new PlatformError(
        `${operation} failed: ${error.message}`,
        this.platformId,
        "UNKNOWN_ERROR",
        error
      );
    }

    throw new PlatformError(
      `${operation} failed: Unknown error`,
      this.platformId,
      "UNKNOWN_ERROR"
    );
  }
} 