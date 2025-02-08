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
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        const state = searchParams.get("state");

        console.log("eBay callback received:", { code, error, errorDescription, state });

        if (error) {
          console.error("eBay auth error:", error, errorDescription);
          window.opener?.postMessage({ type: "EBAY_AUTH_ERROR", error: errorDescription }, "*");
          router.push(
            `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorDescription || "Authentication failed")}`
          );
          return;
        }

        if (!code) {
          const error = "No authorization code received";
          console.error(error);
          window.opener?.postMessage({ type: "EBAY_AUTH_ERROR", error }, "*");
          throw new Error(error);
        }

        // Exchange code for tokens with retry
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            console.log(`Attempting to exchange code for token (attempt ${retryCount + 1})`);
            const response = await fetch("/api/platforms/ebay/auth", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ code, state }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || "Failed to complete authentication");
            }

            console.log("eBay authentication successful");
            window.opener?.postMessage({ type: "EBAY_AUTH_SUCCESS" }, "*");

            // Success - redirect back to dashboard
            router.push("/dashboard?platform=ebay&status=connected");
            return;
          } catch (error) {
            console.error(`eBay callback attempt ${retryCount + 1} failed:`, error);
            retryCount++;

            if (retryCount === maxRetries) {
              window.opener?.postMessage({ type: "EBAY_AUTH_ERROR", error: error.message }, "*");
              throw error;
            }

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } catch (error: any) {
        console.error("eBay callback error:", error);
        const errorMessage = error?.message || "An unexpected error occurred";
        window.opener?.postMessage({ type: "EBAY_AUTH_ERROR", error: errorMessage }, "*");
        router.push(
          `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMessage)}`
        );
      } finally {
        // Close the popup window
        if (window.opener) {
          window.close();
        }
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
