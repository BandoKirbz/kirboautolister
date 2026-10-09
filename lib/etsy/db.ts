import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

function decryptCredential<T extends { accessToken: string; refreshToken: string }>(row: T): T {
  return {
    ...row,
    accessToken: decrypt(row.accessToken),
    refreshToken: decrypt(row.refreshToken),
  };
}

export type EtsyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string[];
  etsyUserId?: number | null;
  shopId?: number | null;
  shopName?: string | null;
};

export const etsyDb = {
  async upsertCredentials(userId: string, data: EtsyTokens) {
    const row = await db.etsycredential.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: encrypt(data.accessToken),
        refreshToken: encrypt(data.refreshToken),
        expiresAt: data.expiresAt,
        scope: data.scope || [],
        etsyUserId: data.etsyUserId ?? null,
        shopId: data.shopId ?? null,
        shopName: data.shopName ?? null,
      },
      update: {
        accessToken: encrypt(data.accessToken),
        refreshToken: encrypt(data.refreshToken),
        expiresAt: data.expiresAt,
        scope: data.scope || [],
        etsyUserId: data.etsyUserId ?? null,
        shopId: data.shopId ?? null,
        shopName: data.shopName ?? null,
      },
    });
    return decryptCredential(row);
  },

  async getCredentials(userId: string) {
    const row = await db.etsycredential.findUnique({ where: { userId } });
    return row ? decryptCredential(row) : null;
  },

  async deleteCredentials(userId: string) {
    try {
      await db.etsycredential.delete({ where: { userId } });
    } catch {
      // already gone
    }
  },

  async upsertListing(
    productId: string,
    data: {
      etsyListingId?: string | null;
      shopId?: number | null;
      status?: "DRAFT" | "PENDING" | "ACTIVE" | "ERROR" | "ENDED" | "OUT_OF_STOCK";
      errors?: unknown;
      taxonomyId?: string | null;
    }
  ) {
    return db.etsylisting.upsert({
      where: { productId },
      create: {
        productId,
        etsyListingId: data.etsyListingId ?? null,
        shopId: data.shopId ?? null,
        status: data.status || "DRAFT",
        errors: data.errors ?? undefined,
        taxonomyId: data.taxonomyId ?? null,
        lastSyncedAt: new Date(),
      },
      update: {
        etsyListingId: data.etsyListingId ?? undefined,
        shopId: data.shopId ?? undefined,
        status: data.status,
        errors: data.errors ?? undefined,
        taxonomyId: data.taxonomyId ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  },

  async getListing(productId: string) {
    return db.etsylisting.findUnique({ where: { productId } });
  },
};
