"use client";

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
import { useToast } from "@/hooks/use-toast";

type EtsyStatus = {
  available: boolean;
  configured: boolean;
  connected: boolean;
  shopId: number | null;
  shopName: string | null;
};

export function EtsyConnection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<EtsyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/platforms/etsy/status", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch Etsy status");
      }
      setStatus((await response.json()) as EtsyStatus);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load Etsy status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("platform") !== "etsy") return;
    const connectStatus = params.get("status");
    const message = params.get("message");
    const shopId = params.get("shopId");

    if (connectStatus === "connected") {
      toast({
        title: "Etsy connected",
        description: shopId ? `Shop id ${shopId}` : "Account linked",
      });
      void fetchStatus();
    } else if (connectStatus === "error") {
      toast({
        title: "Etsy connect failed",
        description: message || "Unknown error",
        variant: "destructive",
      });
    }

    const next = new URL(window.location.href);
    ["platform", "status", "message", "shopId"].forEach((key) =>
      next.searchParams.delete(key)
    );
    window.history.replaceState({}, "", next.toString());
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/platforms/etsy/auth");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(
          data.error ||
            "Etsy is not configured. Set ETSY_API_KEYSTRING and ETSY_SHARED_SECRET in .env.local."
        );
      }
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Etsy not ready",
        description: error instanceof Error ? error.message : "Connect failed",
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/platforms/etsy/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to disconnect");
      setStatus((prev) =>
        prev ? { ...prev, connected: false, shopId: null, shopName: null } : prev
      );
      toast({ title: "Disconnected from Etsy" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Disconnect failed",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Etsy</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🧶</span>
          Etsy
        </CardTitle>
        <CardDescription>
          {status?.connected
            ? `Connected${status.shopId ? ` · shop ${status.shopId}` : ""}`
            : status?.configured
              ? "Connect your Etsy shop with OAuth to publish drafts."
              : "Add ETSY_API_KEYSTRING + ETSY_SHARED_SECRET in .env.local, then connect."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Publish creates a draft listing and uploads S3 images. Auto-activate needs
        ETSY_SHIPPING_PROFILE_ID and ETSY_READINESS_STATE_ID.
      </CardContent>
      <CardFooter className="justify-between gap-2">
        {status?.connected ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={busy}>
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Etsy?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes OAuth tokens from Kirbo. Listings already on Etsy stay on Etsy.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDisconnect()}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={() => void handleConnect()} disabled={busy}>
            {busy ? "Redirecting…" : "Connect Etsy"}
          </Button>
        )}
        <Button variant="link" asChild>
          <a
            href="https://www.etsy.com/developers/your-apps"
            target="_blank"
            rel="noreferrer"
          >
            Etsy apps
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
