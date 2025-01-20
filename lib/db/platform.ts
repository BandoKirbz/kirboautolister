import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type PlatformConnectionInput = {
  userId: string;
  platformId: string;
  credentials: Record<string, string>;
};

export class PlatformError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "PlatformError";
  }
}

export const platformUtils = {
  async connect(input: PlatformConnectionInput) {
    try {
      return await db.platformconnection.create({
        data: {
          userId: input.userId,
          platformId: input.platformId,
          credentials: input.credentials,
          isEnabled: true,
        },
        include: {
          platform: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new PlatformError(
          "Failed to connect platform",
          error.code
        );
      }
      throw error;
    }
  },

  async disconnect(userId: string, platformId: string) {
    try {
      await db.platformconnection.delete({
        where: {
          userId_platformId: {
            userId,
            platformId,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new PlatformError(
          "Failed to disconnect platform",
          error.code
        );
      }
      throw error;
    }
  },

  async getUserConnections(userId: string) {
    try {
      return await db.platformconnection.findMany({
        where: { userId },
        include: {
          platform: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new PlatformError(
          "Failed to fetch platform connections",
          error.code
        );
      }
      throw error;
    }
  },

  async updateConnection(
    userId: string,
    platformId: string,
    isEnabled: boolean,
    credentials?: Record<string, string>
  ) {
    try {
      return await db.platformconnection.update({
        where: {
          userId_platformId: {
            userId,
            platformId,
          },
        },
        data: {
          isEnabled,
          ...(credentials && { credentials }),
        },
        include: {
          platform: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new PlatformError(
          "Failed to update platform connection",
          error.code
        );
      }
      throw error;
    }
  },

  async syncPlatformListing(
    userId: string,
    productId: string,
    platformId: string,
    externalId: string,
    status: string
  ) {
    try {
      return await db.listing.update({
        where: {
          userId_productId_platformId: {
            userId,
            productId,
            platformId,
          },
        },
        data: {
          externalId,
          status,
          lastSyncedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new PlatformError(
          "Failed to sync platform listing",
          error.code
        );
      }
      throw error;
    }
  },
}; 