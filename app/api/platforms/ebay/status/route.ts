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

    const sandbox = process.env.EBAY_SANDBOX === "true";
    const credentials = await ebayDb.getCredentials(session.user.id);

    if (!credentials) {
      return NextResponse.json({
        connected: false,
        username: null,
        stats: null,
        sandbox,
      });
    }

    const stats = await ebayService.getStats(session.user.id);

    return NextResponse.json({
      connected: true,
      username: credentials.ebayUsername,
      stats,
      sandbox,
    });
  } catch (error) {
    console.error("[eBay Status] Status check failed:", error);
    return NextResponse.json(
      { error: "Failed to get eBay status" },
      { status: 500 }
    );
  }
}