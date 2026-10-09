import { db } from "@/lib/db";
import { upsertDepopProduct } from "./client";
import { getUserDepopClient } from "./db";
import { buildDepopListingDraft } from "./listing";

/**
 * Publish (or upsert) a Kirbo product onto Depop by SKU `kirbo-{productId}`.
 * Shared by POST /api/platforms/depop/listings and product create.
 */
export async function publishProductToDepop(
  userId: string,
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    condition: string;
    brand?: string | null;
    quantity?: number | null;
    images: Array<{ url: string }>;
  }
) {
  const client = await getUserDepopClient(userId);
  if (!client) {
    throw new Error("Connect Depop with an API key first.");
  }

  const draft = buildDepopListingDraft(
    {
      id: product.id,
      title: product.name,
      description: product.description,
      price: product.price,
      condition: product.condition,
      brand: product.brand,
      quantity: product.quantity,
      images: product.images,
    },
    client.settings
  );

  const result = await upsertDepopProduct(
    { apiKey: client.apiKey, environment: client.environment },
    draft.sku,
    draft.body
  );

  await db.platform.upsert({
    where: { id: "depop" },
    update: {},
    create: {
      id: "depop",
      name: "Depop",
      slug: "depop",
      website: "https://www.depop.com",
    },
  });

  const existing = await db.listing.findFirst({
    where: { productId: product.id, platformId: "depop" },
  });
  const listingData = {
    title: product.name,
    description: product.description,
    price: product.price,
    quantity: product.quantity && product.quantity > 0 ? product.quantity : 1,
    condition: product.condition,
    status: "ACTIVE" as const,
    platformListingId: String(result.product_id ?? draft.sku),
    errors: null,
  };
  if (existing) {
    await db.listing.update({
      where: { id: existing.id },
      data: listingData,
    });
  } else {
    await db.listing.create({
      data: {
        productId: product.id,
        platformId: "depop",
        userId,
        ...listingData,
      },
    });
  }

  return {
    sku: draft.sku,
    depopProductId: result.product_id ?? null,
    environment: client.environment,
  };
}
