import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";
import { ebayDb } from "@/lib/ebay/db";

// GET /api/platforms/ebay/status - Get eBay connection status and stats
export async function GET() {
  try {
    console.log("Fetching eBay status...");

    const session = await auth();
    if (!session?.user?.id) {
      console.error("Unauthorized: No session or user ID found");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Session user ID:", session.user.id);

    // Fetch credentials
    const credentials = await ebayDb.getCredentials(session.user.id);
    console.log("Credentials:", credentials);

    if (!credentials) {
      console.log("No eBay credentials found for user:", session.user.id);
      return NextResponse.json({
        connected: false,
        username: null,
        stats: null,
      });
    }

    // Fetch stats
    const stats = await ebayService.getStats(session.user.id);
    console.log("Stats:", stats);

    return NextResponse.json({
      connected: true,
      username: credentials.ebayUsername,
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