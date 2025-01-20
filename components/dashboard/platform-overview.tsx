"use client";

import Link from "next/link";

import { EbayConnection } from "@/components/platforms/ebay/ebay-connection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export function PlatformOverview() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Connected Platforms</CardTitle>
          <CardDescription>Manage your selling platform integrations</CardDescription>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/platforms">
            <Icons.refresh className="mr-2 h-4 w-4" />
            Manage Platforms
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <EbayConnection />
          {/* Add other platform connections here */}
        </div>
      </CardContent>
    </Card>
  );
}
