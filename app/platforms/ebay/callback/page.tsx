"use client";

import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export default function EbayCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const code = searchParams.get("code");
        const authError = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        const state = searchParams.get("state");

        // Log all incoming parameters
        console.log("eBay callback received:", {
          code: code ? code.substring(0, 10) + "..." : "missing",
          error: authError,
          errorDescription,
          state,
          timestamp: new Date().toISOString(),
          origin: window.location.origin,
          opener: !!window.opener,
        });

        if (authError) {
          const errorMsg = errorDescription || authError;
          console.error("eBay auth error:", errorMsg);
          setError(errorMsg);
          if (window.opener) {
            window.opener.postMessage(
              { type: "EBAY_AUTH_ERROR", error: errorMsg },
              window.location.origin
            );
            setTimeout(() => window.close(), 2000);
          } else {
            router.push(
              `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`
            );
          }
          return;
        }

        if (!code) {
          const errorMsg = "No authorization code received";
          console.error(errorMsg);
          setError(errorMsg);
          if (window.opener) {
            window.opener.postMessage(
              { type: "EBAY_AUTH_ERROR", error: errorMsg },
              window.location.origin
            );
            setTimeout(() => window.close(), 2000);
          } else {
            router.push(
              `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`
            );
          }
          return;
        }

        // Exchange code for tokens
        console.log("Exchanging code for tokens...");
        const response = await fetch("/api/platforms/ebay/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            state,
            timestamp: new Date().toISOString(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || "Failed to complete authentication";
          console.error("eBay token exchange failed:", data);
          setError(errorMsg);
          if (window.opener) {
            window.opener.postMessage(
              { type: "EBAY_AUTH_ERROR", error: errorMsg },
              window.location.origin
            );
            setTimeout(() => window.close(), 2000);
          } else {
            router.push(
              `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`
            );
          }
          return;
        }

        console.log("eBay authentication successful:", {
          username: data.username,
          environment: data.environment,
          timestamp: new Date().toISOString(),
        });

        // Send success message to opener
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "EBAY_AUTH_SUCCESS",
              data: {
                username: data.username,
                environment: data.environment,
                timestamp: new Date().toISOString(),
              },
            },
            window.location.origin
          );
          setTimeout(() => window.close(), 2000);
        } else {
          router.push("/dashboard?platform=ebay&status=connected");
        }
      } catch (error: any) {
        const errorMsg = error.message || "An unexpected error occurred";
        console.error("eBay callback error:", error);
        setError(errorMsg);

        if (window.opener) {
          window.opener.postMessage(
            {
              type: "EBAY_AUTH_ERROR",
              error: errorMsg,
              timestamp: new Date().toISOString(),
            },
            window.location.origin
          );
          setTimeout(() => window.close(), 3000);
        } else {
          router.push(
            `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`
          );
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
            <span>{error ? "Connection Failed" : "Connecting to eBay"}</span>
          </CardTitle>
          <CardDescription>
            {error
              ? "Failed to complete connection"
              : "Please wait while we complete your connection..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 py-6">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <Icons.spinner className="h-8 w-8 animate-spin" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
