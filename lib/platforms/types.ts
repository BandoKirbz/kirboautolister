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

// Platform-agnostic product type
export interface UnifiedProduct {
  title: string;
  description: string;
  price: number;
  quantity: number;
  images: string[];
  condition: string;
  category: string;
  specifications: Record<string, string>;
  userId: string;
}

// Platform-specific response types
export interface PlatformListingResponse {
  id: string;
  status: string;
  errors?: string[];
  platformSpecificData?: any;
}

// Base adapter interface
export abstract class PlatformAdapter {
  abstract createListing(product: UnifiedProduct): Promise<PlatformListingResponse>;
  abstract updateListing(id: string, product: Partial<UnifiedProduct>): Promise<PlatformListingResponse>;
  abstract deleteListing(id: string): Promise<void>;
  abstract getListing(id: string): Promise<UnifiedProduct>;
  abstract syncListing(id: string): Promise<PlatformListingResponse>;
}

// Queue job types
export interface ListingJob {
  type: 'create' | 'update' | 'delete' | 'sync';
  product: UnifiedProduct;
  platforms: string[];
  listingId?: string;
}

export interface ListingJobResult {
  success: boolean;
  platformResults: Map<string, PlatformListingResponse>;
  errors?: Record<string, string>;
} 