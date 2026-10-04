import { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/app/auth";
import { DisconnectedEbayListingsBanner } from "@/components/dashboard/disconnected-ebay-listings-banner";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AnalyticsCards } from "@/components/dashboard/analytics-cards";
import { PlatformOverview } from "@/components/dashboard/platform-overview";
import { PlatformStatus } from "@/components/dashboard/platform-status";
import { ProductGrid } from "@/components/dashboard/product-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getEbayItemUrl } from "@/lib/ebay/config";
import { ebayDb } from "@/lib/ebay/db";
import { PLATFORM_CATALOG } from "@/lib/platforms";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your product listing dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Fetch initial data
  const [products, ebayCredentials, listings] = await Promise.all([
    db.product.findMany({
      where: { userId: session.user.id },
      include: {
        images: true,
        listings: {
          include: { platform: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    ebayDb.getCredentials(session.user.id),
    db.listing.findMany({
      where: { userId: session.user.id },
      include: { platform: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  // Attach the real, publicly-viewable listing URL for any listing that's
  // actually live on its platform, so the UI can link out to it directly
  // instead of just showing a status badge.
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

  // Honest platform status: eBay is connected only with real OAuth tokens;
  // other platforms are "coming soon" until implemented.
  const platformStatus = PLATFORM_CATALOG.map((platform) => ({
    id: platform.id,
    name: platform.name,
    logo: platform.logo,
    availability: platform.availability,
    connected: platform.id === "ebay" ? !!ebayCredentials : false,
    username: platform.id === "ebay" ? ebayCredentials?.ebayUsername ?? null : null,
  }));

  const showDisconnectedBanner =
    !ebayCredentials && listings.some((listing) => listing.platformId === "ebay");

  const connectedCount = platformStatus.filter((p) => p.connected).length;

  // Calculate analytics
  const analytics = {
    totalProducts: products.length,
    activeListings: products.filter((p) => p.listings.some((l) => l.status === "ACTIVE")).length,
    totalPlatforms: connectedCount,
    averagePrice: products.length
      ? (products.reduce((sum, p) => sum + p.price, 0) / products.length).toFixed(2)
      : "0.00",
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Manage your products and platform listings</p>
        </div>
      </div>

      {showDisconnectedBanner && <DisconnectedEbayListingsBanner />}

      <AnalyticsCards analytics={analytics} />

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Products</CardTitle>
              <CardDescription>Manage and track all your product listings</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductGrid initialProducts={productsWithListingUrls as any} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <PlatformStatus platforms={platformStatus} />
          <ActivityFeed listings={listings} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PlatformOverview />
      </div>
    </div>
  );
}
