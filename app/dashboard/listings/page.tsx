import { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/app/auth";
import { ListingsTable } from "@/components/dashboard/listings-table";
import { db } from "@/lib/db";
import { getEbayItemUrl } from "@/lib/ebay/config";

export const metadata: Metadata = {
  title: "Listings",
  description: "Track every listing you've published across platforms",
};

export default async function ListingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const listings = await db.listing.findMany({
    where: { userId: session.user.id },
    include: {
      platform: true,
      product: {
        include: { images: { orderBy: { order: "asc" }, take: 1 } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const listingsWithUrls = listings.map((listing) => ({
    ...listing,
    listingUrl:
      listing.platformId === "ebay" && listing.platformListingId
        ? getEbayItemUrl(listing.platformListingId)
        : null,
  }));

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Listings</h2>
        <p className="text-muted-foreground">
          Every per-platform listing generated from your products, and its live sync status
        </p>
      </div>

      <ListingsTable listings={listingsWithUrls as any} />
    </div>
  );
}
