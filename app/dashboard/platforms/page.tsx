"use client";

import { DepopConnection } from "@/components/platforms/depop/depop-connection";
import { EbayConnection } from "@/components/platforms/ebay/ebay-connection";
import { EtsyConnection } from "@/components/platforms/etsy/etsy-connection";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_CATALOG } from "@/lib/platforms";

function ComingSoonPlatformCard({
  name,
  logo,
  reason,
}: {
  name: string;
  logo: string;
  reason?: string;
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
          {reason || `${name} integration is not available yet.`}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function PlatformsPage() {
  const comingSoon = PLATFORM_CATALOG.filter(
    (p) => p.availability === "coming_soon"
  );

  return (
    <div className="container py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Platform Connections</CardTitle>
          <CardDescription>
            Connect selling platforms so listings you create here can be published
            elsewhere. eBay and Etsy use OAuth. Depop needs a partner API key.
            Grailed and OfferUp are blocked until they offer an API.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <EbayConnection />
        <EtsyConnection />
        <DepopConnection />
        {comingSoon.map((platform) => (
          <ComingSoonPlatformCard
            key={platform.id}
            name={platform.name}
            logo={platform.logo}
            reason={platform.unavailableReason}
          />
        ))}
      </div>
    </div>
  );
}
