import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";
import { getEbayEnv, isEbayConfigured } from "@/lib/ebay/env";

// GET /api/platforms/ebay/auth - Get eBay OAuth URL for the current user.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isEbayConfigured()) {
      try {
        getEbayEnv();
      } catch (err) {
        return NextResponse.json(
          {
            error: err instanceof Error ? err.message : "eBay is not configured",
            configured: false,
          },
          { status: 400 }
        );
      }
    }

    const authUrl = await ebayService.getAuthUrl(session.user.id);
    return NextResponse.json({ url: authUrl, configured: true });
  } catch (error) {
    console.error("[eBay Auth] Failed to get auth URL:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get eBay authorization URL",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms/ebay/auth - Disconnect eBay account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ebayService.disconnect(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[eBay Auth] Disconnect failed:", error);
    return NextResponse.json(
      { error: "Failed to disconnect eBay account" },
      { status: 500 }
    );
  }
}
