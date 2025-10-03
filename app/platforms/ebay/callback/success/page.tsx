"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export default function EbayAuthSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push("/dashboard?platform=ebay&status=connected");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="container flex min-h-screen items-center justify-center py-10">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Icons.ebay className="h-6 w-6" />
            <span>Successfully Connected</span>
          </CardTitle>
          <CardDescription>Your eBay account has been successfully connected!</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    </div>
  );
}
