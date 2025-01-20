import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";
import { ebayDb } from "@/lib/ebay/db";

// GET /api/platforms/ebay/status - Get eBay connection status and stats
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const [credentials, stats] = await Promise.all([
      ebayDb.getCredentials(session.user.id),
      ebayService.getStats(session.user.id),
    ]);

    return NextResponse.json({
      connected: !!credentials,
      username: credentials?.ebayUsername,
      stats,
    });
  } catch (error) {
    console.error("[eBay Status] Status check failed:", error);
    return NextResponse.json(
      { error: "Failed to get eBay status" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/ebay/status/sync - Trigger sync of eBay listings
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await ebayService.syncListings(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[eBay Status] Sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync eBay listings" },
      { status: 500 }
    );
  }
} 