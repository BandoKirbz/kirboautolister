import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  sandbox: boolean;
}

export function EbayConnection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch eBay connection status
  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/platforms/ebay/status", {
        // Add cache headers to optimize data fetching
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch status");
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching eBay status:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch eBay connection status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle URL parameters for OAuth callback results
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const platform = urlParams.get("platform");
    const status = urlParams.get("status");
    const message = urlParams.get("message");
    const username = urlParams.get("username");

    if (platform === "ebay") {
      if (status === "connected") {
        console.log("eBay auth success detected from URL");
        fetchStatus();
        toast({
          title: "Success",
          description: username
            ? `Connected to eBay as ${username}`
            : "Connected to eBay successfully",
        });
        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("platform");
        newUrl.searchParams.delete("status");
        newUrl.searchParams.delete("message");
        newUrl.searchParams.delete("username");
        window.history.replaceState({}, "", newUrl.toString());
      } else if (status === "error") {
        console.error("eBay auth error detected from URL:", message);
        toast({
          title: "Error",
          description: message || "Failed to connect to eBay",
          variant: "destructive",
        });
        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("platform");
        newUrl.searchParams.delete("status");
        newUrl.searchParams.delete("message");
        newUrl.searchParams.delete("username");
        window.history.replaceState({}, "", newUrl.toString());
      }
    }
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200" />
            <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
        </CardFooter>
      </Card>
    );
  }

  if (!status) return null;

  // Handle connect button click
  const handleConnect = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/platforms/ebay/auth");
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        throw new Error(
          data.error ||
            "Failed to get eBay authorization URL. Set EBAY_CLIENT_SECRET (Cert ID) in .env.local and use an HTTPS RuName Accept URL."
        );
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Error connecting to eBay:", error);
      toast({
        title: "eBay not ready",
        description: error instanceof Error ? error.message : "Failed to connect to eBay",
        variant: "destructive",
      });
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

      setStatus((prev) => (prev ? { ...prev, connected: false, username: undefined, stats: undefined } : null));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Icons.ebay className="h-6 w-6" />
          <span>eBay {status.sandbox ? "(Sandbox)" : ""}</span>
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
            <div className="flex space-x-2">
              <Button className="bg-secondary" onClick={handleConnect} disabled={isLoading}>
                {isLoading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.refresh className="mr-2 h-4 w-4" />
                )}
                Reconnect
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="bg-destructive text-destructive-foreground"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.logout className="mr-2 h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect eBay?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll need to reconnect (sign in to eBay again) before you can publish or
                      update listings from here. Any listings already live on eBay stay live -
                      disconnecting only removes this app's ability to manage them until you
                      reconnect.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
