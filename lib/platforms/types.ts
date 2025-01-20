import { z } from "zod";

// Platform-agnostic types
export type PlatformId = "ebay" | "grailed" | "depop" | "offerup";

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  [key: string]: any; // For platform-specific credentials
}

export interface PlatformProduct {
  title: string;
  description: string;
  price: number;
  condition: string;
  images: string[];
  quantity: number;
  category?: string;
  [key: string]: any; // For platform-specific fields
}

export interface PlatformListing {
  id: string;
  externalId: string;
  status: "ACTIVE" | "SOLD" | "DRAFT" | "PENDING" | "ERROR" | "PAUSED";
  url?: string;
  lastSyncedAt: Date;
  platformSpecificData?: any;
}

// Base error type for platform operations
export class PlatformError extends Error {
  constructor(
    message: string,
    public platform: PlatformId,
    public code?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

// Validation schemas
export const platformCredentialsSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
}).passthrough(); // Allow additional platform-specific fields

export const platformProductSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.number().positive(),
  condition: z.string(),
  images: z.array(z.string()),
  quantity: z.number().int().positive(),
  category: z.string().optional(),
}).passthrough(); // Allow additional platform-specific fields

// Platform integration interface
export interface PlatformIntegration {
  platformId: PlatformId;
  
  // Authentication
  authenticate(credentials: PlatformCredentials): Promise<PlatformCredentials>;
  refreshAuth(credentials: PlatformCredentials): Promise<PlatformCredentials>;
  validateAuth(credentials: PlatformCredentials): Promise<boolean>;
  
  // Listing operations
  createListing(product: PlatformProduct, credentials: PlatformCredentials): Promise<PlatformListing>;
  updateListing(listingId: string, product: Partial<PlatformProduct>, credentials: PlatformCredentials): Promise<PlatformListing>;
  deleteListing(listingId: string, credentials: PlatformCredentials): Promise<void>;
  getListing(listingId: string, credentials: PlatformCredentials): Promise<PlatformListing>;
  
  // Sync operations
  syncListing(listingId: string, credentials: PlatformCredentials): Promise<PlatformListing>;
  validateProduct(product: PlatformProduct): Promise<{ valid: boolean; errors?: string[] }>;
} 