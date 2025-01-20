import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type UserUpdateInput = {
  name?: string;
  email?: string;
  username?: string;
  image?: string;
};

export class UserError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "UserError";
  }
}

export const userUtils = {
  async getById(id: string) {
    try {
      return await db.user.findUnique({
        where: { id },
        include: {
          platformConnections: {
            include: {
              platform: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new UserError(
          "Failed to fetch user",
          error.code
        );
      }
      throw error;
    }
  },

  async update(id: string, data: UserUpdateInput) {
    try {
      return await db.user.update({
        where: { id },
        data,
        include: {
          platformConnections: {
            include: {
              platform: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new UserError(
          "Failed to update user",
          error.code
        );
      }
      throw error;
    }
  },

  async getOrCreate(data: {
    id: string;
    name?: string | null;
    email?: string | null;
    username?: string | null;
    image?: string | null;
  }) {
    try {
      const user = await db.user.findUnique({
        where: { id: data.id },
      });

      if (user) return user;

      return await db.user.create({
        data: {
          id: data.id,
          name: data.name || "",
          email: data.email || "",
          username: data.username || "",
          image: data.image || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new UserError(
          "Failed to get or create user",
          error.code
        );
      }
      throw error;
    }
  },

  async getUserStats(userId: string) {
    try {
      const [products, platforms, listings] = await Promise.all([
        db.product.count({
          where: { userId },
        }),
        db.platformconnection.count({
          where: { userId, isEnabled: true },
        }),
        db.listing.findMany({
          where: { userId },
          select: {
            status: true,
          },
        }),
      ]);

      const activeListings = listings.filter((l) => l.status === "ACTIVE").length;
      const totalListings = listings.length;

      return {
        totalProducts: products,
        connectedPlatforms: platforms,
        activeListings,
        totalListings,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new UserError(
          "Failed to fetch user stats",
          error.code
        );
      }
      throw error;
    }
  },
}; 