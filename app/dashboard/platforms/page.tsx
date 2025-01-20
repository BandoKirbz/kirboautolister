"use client";

import { EbayConnection } from "@/components/platforms/ebay/ebay-connection";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformsPage() {
  return (
    <div className="container py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Platform Connections</CardTitle>
          <CardDescription>Connect and manage your selling platform integrations</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <EbayConnection />
        {/* Add other platform connections here */}
      </div>
    </div>
  );
}
