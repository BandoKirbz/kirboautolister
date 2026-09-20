import { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/app/auth";
import { ProductGrid } from "@/components/dashboard/product-grid";
import { db } from "@/lib/db";
import { getEbayItemUrl } from "@/lib/ebay/config";

export const metadata: Metadata = {
  title: "Products",
  description: "Manage all of your products",
};

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const products = await db.product.findMany({
    where: { userId: session.user.id },
    include: {
      images: true,
      listings: {
        include: { platform: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Same treatment as the dashboard overview - attach a real, clickable
  // listing URL wherever a listing is actually live on its platform.
  const productsWithListingUrls = products.map((product) => ({
    ...product,
    listings: product.listings.map((listing) => ({
      ...listing,
      listingUrl:
        listing.platformId === "ebay" && listing.platformListingId
          ? getEbayItemUrl(listing.platformListingId)
          : null,
    })),
  }));

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Products</h2>
        <p className="text-muted-foreground">
          Search, filter, and manage every product in your catalog
        </p>
      </div>

      <ProductGrid initialProducts={productsWithListingUrls as any} />
    </div>
  );
}
