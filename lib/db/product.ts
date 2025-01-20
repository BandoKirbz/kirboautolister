import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type ProductCreateInput = {
  userId: string;
  title: string;
  description: string;
  condition: string;
  price: number;
  quantity: number;
  images: { url: string }[];
  platforms?: string[];
  isDraft?: boolean;
};

export type ProductUpdateInput = Partial<Omit<ProductCreateInput, "userId">>;

export class ProductError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ProductError";
  }
}

export const productUtils = {
  async create(input: ProductCreateInput) {
    try {
      const product = await db.product.create({
        data: {
          userId: input.userId,
          name: input.title,
          description: input.description,
          condition: input.condition,
          price: input.price,
          quantity: input.quantity,
          images: {
            create: input.images.map((img) => ({ url: img.url })),
          },
        },
        include: {
          images: true,
          listings: {
            include: {
              platform: true,
            },
          },
        },
      });

      if (input.platforms?.length) {
        await db.listing.createMany({
          data: input.platforms.map((platformId) => ({
            userId: input.userId,
            productId: product.id,
            platformId,
            title: input.title,
            description: input.description,
            price: input.price,
            quantity: input.quantity,
            condition: input.condition,
            status: input.isDraft ? "DRAFT" : "PENDING",
          })),
        });
      }

      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ProductError(
          "Failed to create product",
          error.code
        );
      }
      throw error;
    }
  },

  async update(id: string, userId: string, input: ProductUpdateInput) {
    try {
      const product = await db.product.update({
        where: { id_userId: { id, userId } },
        data: {
          name: input.title,
          description: input.description,
          condition: input.condition,
          price: input.price,
          quantity: input.quantity,
          ...(input.images && {
            images: {
              deleteMany: {},
              create: input.images.map((img) => ({ url: img.url })),
            },
          }),
        },
        include: {
          images: true,
          listings: {
            include: {
              platform: true,
            },
          },
        },
      });

      if (input.platforms?.length) {
        // Delete existing listings
        await db.listing.deleteMany({
          where: { productId: id },
        });

        // Create new listings
        await db.listing.createMany({
          data: input.platforms.map((platformId) => ({
            userId,
            productId: id,
            platformId,
            title: input.title!,
            description: input.description!,
            price: input.price!,
            quantity: input.quantity!,
            condition: input.condition!,
            status: input.isDraft ? "DRAFT" : "PENDING",
          })),
        });
      }

      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ProductError(
          "Failed to update product",
          error.code
        );
      }
      throw error;
    }
  },

  async delete(id: string, userId: string) {
    try {
      await db.product.delete({
        where: { id_userId: { id, userId } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ProductError(
          "Failed to delete product",
          error.code
        );
      }
      throw error;
    }
  },

  async getById(id: string, userId: string) {
    try {
      return await db.product.findUnique({
        where: { id_userId: { id, userId } },
        include: {
          images: true,
          listings: {
            include: {
              platform: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ProductError(
          "Failed to fetch product",
          error.code
        );
      }
      throw error;
    }
  },

  async getUserProducts(userId: string) {
    try {
      return await db.product.findMany({
        where: { userId },
        include: {
          images: true,
          listings: {
            include: {
              platform: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ProductError(
          "Failed to fetch user products",
          error.code
        );
      }
      throw error;
    }
  },
}; 