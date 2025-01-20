import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";

interface EbayStats {
  activeListings: number;
  draftListings: number;
  failedListings: number;
  estimatedRevenue: number;
}

interface EbayStatus {
  connected: boolean;
  username?: string;
  stats?: EbayStats;
}

export function EbayConnection() {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch eBay connection status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/platforms/ebay/status");
        if (!response.ok) throw new Error("Failed to fetch status");
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Error fetching eBay status:", error);
        toast({
          title: "Error",
          description: "Failed to fetch eBay connection status",
          variant: "destructive",
        });
      }
    }

    fetchStatus();
  }, [toast]);

  // Handle connect button click
  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/platforms/ebay/auth");
      if (!response.ok) throw new Error("Failed to get auth URL");
      const { url } = await response.json();

      // Open eBay auth in new window
      window.location.href = url;
    } catch (error) {
      console.error("Error connecting to eBay:", error);
      toast({
        title: "Error",
        description: "Failed to connect to eBay",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle disconnect button click
  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/platforms/ebay/auth", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to disconnect");

      setStatus((prev) => (prev ? { ...prev, connected: false } : null));
      toast({
        title: "Success",
        description: "Disconnected from eBay successfully",
      });
    } catch (error) {
      console.error("Error disconnecting from eBay:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect from eBay",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sync button click
  const handleSync = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/platforms/ebay/status/sync", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to sync");

      toast({
        title: "Success",
        description: "eBay listings synced successfully",
      });

      // Refresh status after sync
      router.refresh();
    } catch (error) {
      console.error("Error syncing eBay listings:", error);
      toast({
        title: "Error",
        description: "Failed to sync eBay listings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!status) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Icons.ebay className="h-6 w-6" />
          <span>eBay</span>
        </CardTitle>
        <CardDescription>
          {status.connected
            ? `Connected as ${status.username}`
            : "Connect your eBay account to start selling"}
        </CardDescription>
      </CardHeader>

      {status.connected && status.stats && (
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Active Listings</p>
              <p className="text-2xl font-bold">{status.stats.activeListings}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Draft Listings</p>
              <p className="text-2xl font-bold">{status.stats.draftListings}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Failed Listings</p>
              <p className="text-2xl font-bold">{status.stats.failedListings}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Est. Revenue</p>
              <p className="text-2xl font-bold">${status.stats.estimatedRevenue.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      )}

      <CardFooter className="flex justify-between">
        {status.connected ? (
          <>
            <Button variant="outline" onClick={handleSync} disabled={isLoading}>
              {isLoading ? (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icons.refresh className="mr-2 h-4 w-4" />
              )}
              Sync Listings
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isLoading}>
              {isLoading ? (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icons.logout className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={isLoading} className="w-full">
            {isLoading ? (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.login className="mr-2 h-4 w-4" />
            )}
            Connect to eBay
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
