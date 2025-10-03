import { EbayAdapter } from "../platforms/ebay/ebay-adapter";
import { ListingJob, ListingJobResult, PlatformAdapter, UnifiedProduct } from "../platforms/types";
import { db } from "../db";
import { queues } from "../queue";

export class ListingService {
  private platforms: Map<string, PlatformAdapter>;
  private queue: typeof queues.listings;

  constructor() {
    this.platforms = new Map([
      ['ebay', new EbayAdapter()],
      // Add other platform adapters as they're implemented
    ]);

    this.queue = queues.listings;
    this.setupQueueHandlers();
  }

  async createListing(product: UnifiedProduct, platforms: string[]): Promise<string> {
    // First, create the listing in our database
    const dbListing = await db.listing.create({
      data: {
        userId: product.userId,
        title: product.title,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        condition: product.condition,
        status: "PENDING",
      },
    });

    // Add the job to the queue
    const job = await this.queue.add('create', {
      type: 'create',
      product: {
        ...product,
        specifications: product.specifications || {},
      },
      platforms,
      listingId: dbListing.id,
    });

    return job.id;
  }

  async updateListing(id: string, product: Partial<UnifiedProduct>, platforms: string[]): Promise<string> {
    // Update the listing in our database
    await db.listing.update({
      where: { id },
      data: {
        ...product,
        status: "PENDING",
      },
    });

    // Add the update job to the queue
    const job = await this.queue.add('update', {
      type: 'update',
      product: product as UnifiedProduct,
      platforms,
      listingId: id,
    });

    return job.id;
  }

  async deleteListing(id: string, platforms: string[]): Promise<string> {
    // Mark the listing as pending deletion in our database
    await db.listing.update({
      where: { id },
      data: { status: "PENDING_DELETION" },
    });

    // Add the delete job to the queue
    const job = await this.queue.add('delete', {
      type: 'delete',
      platforms,
      listingId: id,
      product: {} as UnifiedProduct, // Required by type but not used for deletion
    });

    return job.id;
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const state = await job.getState();
    const result = job.returnvalue;

    return {
      id: job.id,
      state,
      result,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
    };
  }

  private setupQueueHandlers() {
    this.queue.process('create', async (job) => {
      const { product, platforms, listingId } = job.data;
      const results = new Map<string, any>();
      const errors: Record<string, string> = {};

      for (const platformId of platforms) {
        const adapter = this.platforms.get(platformId);
        if (adapter) {
          try {
            const result = await adapter.createListing(product);
            results.set(platformId, result);

            // Update the platform-specific listing ID in our database
            if (result.id) {
              await db.listing.update({
                where: { id: listingId },
                data: {
                  [`${platformId}ListingId`]: result.id,
                  status: "ACTIVE",
                },
              });
            }
          } catch (error) {
            console.error(`Failed to create listing on ${platformId}:`, error);
            errors[platformId] = error instanceof Error ? error.message : 'Unknown error';
          }
        }
      }

      const success = Object.keys(errors).length === 0;
      if (!success) {
        // Update listing status to error in our database
        await db.listing.update({
          where: { id: listingId },
          data: { status: "ERROR" },
        });
      }

      return {
        success,
        platformResults: results,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      } as ListingJobResult;
    });

    this.queue.process('update', async (job) => {
      const { product, platforms, listingId } = job.data;
      const results = new Map<string, any>();
      const errors: Record<string, string> = {};

      for (const platformId of platforms) {
        const adapter = this.platforms.get(platformId);
        if (adapter) {
          try {
            const result = await adapter.updateListing(listingId, product);
            results.set(platformId, result);
          } catch (error) {
            console.error(`Failed to update listing on ${platformId}:`, error);
            errors[platformId] = error instanceof Error ? error.message : 'Unknown error';
          }
        }
      }

      return {
        success: Object.keys(errors).length === 0,
        platformResults: results,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      } as ListingJobResult;
    });

    this.queue.process('delete', async (job) => {
      const { platforms, listingId } = job.data;
      const errors: Record<string, string> = {};

      for (const platformId of platforms) {
        const adapter = this.platforms.get(platformId);
        if (adapter) {
          try {
            await adapter.deleteListing(listingId);
          } catch (error) {
            console.error(`Failed to delete listing on ${platformId}:`, error);
            errors[platformId] = error instanceof Error ? error.message : 'Unknown error';
          }
        }
      }

      if (Object.keys(errors).length === 0) {
        // If all platforms successfully deleted, delete from our database
        await db.listing.delete({
          where: { id: listingId },
        });
      }

      return {
        success: Object.keys(errors).length === 0,
        platformResults: new Map(),
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      } as ListingJobResult;
    });

    // Handle failed jobs
    this.queue.on('failed', async (job, err) => {
      console.error('Job failed:', {
        jobId: job.id,
        type: job.data.type,
        error: err.message,
        stack: err.stack,
      });

      // Update listing status in database if this was the final retry
      if (job.attemptsMade >= job.opts.attempts!) {
        const { listingId } = job.data;
        await db.listing.update({
          where: { id: listingId },
          data: {
            status: "ERROR",
            errorMessage: err.message,
          },
        });
      }
    });
  }
} 