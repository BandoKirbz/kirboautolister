"use client";

import { useEffect } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export default function EbayAuthDeclinedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push(
        `/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorDescription || "Authorization declined")}`
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, [router, errorDescription]);

  return (
    <div className="container flex min-h-screen items-center justify-center py-10">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            <Icons.ebay className="h-6 w-6" />
            <span>Authorization Declined</span>
          </CardTitle>
          <CardDescription>
            {errorDescription || "The eBay authorization was declined or canceled."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    </div>
  );
}
