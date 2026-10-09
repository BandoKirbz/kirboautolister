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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type DepopStatus = {
  available: boolean;
  connected: boolean;
  environment: "staging" | "production";
  accessHint: string;
};

export function DepopConnection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DepopStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/platforms/depop", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch Depop status");
      }
      const data = (await response.json()) as DepopStatus;
      setStatus(data);
      setEnvironment(data.environment || "staging");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load Depop status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const connect = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/platforms/depop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, environment }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to connect Depop");
      }
      setApiKey("");
      toast({ title: "Depop connected", description: data.message });
      await fetchStatus();
    } catch (error) {
      toast({
        title: "Could not connect",
        description: error instanceof Error ? error.message : "Depop connect failed",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const disconnect = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/platforms/depop", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      toast({ title: "Depop disconnected" });
      await fetchStatus();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Disconnect failed",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Depop</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🛍️</span>
          Depop
          {status?.connected ? (
            <span className="text-sm font-normal text-muted-foreground">
              ({status.environment})
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          {status?.connected
            ? "API key stored encrypted. Publish with POST /api/platforms/depop/listings."
            : status?.accessHint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.connected ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="depop-env">Environment</Label>
              <Select
                value={environment}
                onValueChange={(value) =>
                  setEnvironment(value as "staging" | "production")
                }
              >
                <SelectTrigger id="depop-env">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="depop-key">API key</Label>
              <Input
                id="depop-key"
                type="password"
                autoComplete="off"
                placeholder="Paste staging or production key from Depop"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connected. Taxonomy defaults (department / size) come from server env until
            the product form collects Depop-specific fields.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        {status?.connected ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isSaving}>
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Depop?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes the stored API key from Kirbo. Live Depop listings stay on Depop.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void disconnect()}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            onClick={() => void connect()}
            disabled={isSaving || apiKey.trim().length < 8}
          >
            {isSaving ? "Checking…" : "Connect Depop"}
          </Button>
        )}
        <Button variant="link" asChild>
          <a
            href="https://partnerapi.depop.com/api-docs/"
            target="_blank"
            rel="noreferrer"
          >
            API docs
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
