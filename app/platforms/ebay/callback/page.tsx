"use client";

import { useEffect } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export default function EbayCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleCallback() {
      try {
        const code = searchParams.get("code");
        if (!code) {
          throw new Error("No authorization code received");
        }

        // Exchange code for tokens
        const response = await fetch("/api/platforms/ebay/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error("Failed to complete authentication");
        }

        // Redirect back to dashboard on success
        router.push("/dashboard?platform=ebay&status=connected");
      } catch (error) {
        console.error("eBay callback error:", error);
        // Redirect with error on failure
        router.push("/dashboard?platform=ebay&status=error");
      }
    }

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="container flex min-h-screen items-center justify-center py-10">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Icons.ebay className="h-6 w-6" />
            <span>Connecting to eBay</span>
          </CardTitle>
          <CardDescription>Please wait while we complete your connection...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    </div>
  );
}
