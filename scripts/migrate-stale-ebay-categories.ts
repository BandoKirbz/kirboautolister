/**
 * Move ACTIVE eBay listings still on the stale 50979 category onto
 * EBAY_DEFAULT_CATEGORY_ID (175687). Uses the same publish path as the app
 * (update existing offer in place, then publish).
 *
 * Run with: npx tsx scripts/migrate-stale-ebay-categories.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const STALE_CATEGORY_ID = "50979";

async function main() {
  const { db } = await import("../lib/db");
  const { ebayService } = await import("../lib/ebay/service");
  const { getEbayEnv } = await import("../lib/ebay/env");
  const { toPublicImageUrl } = await import("../lib/ebay/utils");

  const targetCategoryId = getEbayEnv().defaultCategoryId;
  if (!targetCategoryId) {
    throw new Error("EBAY_DEFAULT_CATEGORY_ID is not set");
  }

  const stale = await db.ebaylisting.findMany({
    where: { status: "ACTIVE", categoryId: STALE_CATEGORY_ID },
    include: {
      product: {
        include: { images: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (stale.length === 0) {
    console.log("No ACTIVE listings on category", STALE_CATEGORY_ID);
    return;
  }

  console.log(`Updating ${stale.length} listing(s) ${STALE_CATEGORY_ID} → ${targetCategoryId}\n`);

  for (const listing of stale) {
    const product = listing.product;
    const name = product.name;
    try {
      await ebayService.createListing(product.userId, product.id, {
        title: product.name,
        description: product.description,
        brand: product.brand ?? undefined,
        price: product.price,
        quantity: product.quantity,
        condition: product.condition,
        images: product.images.map(toPublicImageUrl),
        categoryId: targetCategoryId,
      });
      console.log(`✅ ${name} (${listing.ebayItemId})`);
    } catch (err) {
      console.error(`❌ ${name} (${listing.ebayItemId}):`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
