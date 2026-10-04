"use client";

import { EbayConnection } from "@/components/platforms/ebay/ebay-connection";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_CATALOG } from "@/lib/platforms";

function ComingSoonPlatformCard({
  name,
  logo,
}: {
  name: string;
  logo: string;
}) {
  return (
    <Card className="opacity-80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>{logo}</span>
            {name}
          </span>
          <Badge variant="secondary">Coming soon</Badge>
        </CardTitle>
        <CardDescription>
          {name} integration is not available yet. We&apos;re starting with eBay.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function PlatformsPage() {
  const otherPlatforms = PLATFORM_CATALOG.filter((p) => p.id !== "ebay");

  return (
    <div className="container py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Platform Connections</CardTitle>
          <CardDescription>
            Connect selling platforms so listings you create here can be published elsewhere.
            eBay is the live marketplace. Grailed, Depop, and OfferUp are not available yet.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <EbayConnection />
        {otherPlatforms.map((platform) => (
          <ComingSoonPlatformCard
            key={platform.id}
            name={platform.name}
            logo={platform.logo}
          />
        ))}
      </div>
    </div>
  );
}
