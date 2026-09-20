import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";

// GET /api/platforms/ebay/auth - Get eBay OAuth URL for the current user.
// The user id is signed into the returned URL's `state` param and verified
// again in /api/ebay/callback, so the flow works even if the eBay redirect
// doesn't carry the app's session cookie back with it.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authUrl = await ebayService.getAuthUrl(session.user.id);
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("[eBay Auth] Failed to get auth URL:", error);
    return NextResponse.json(
      { error: "Failed to get eBay authorization URL" },
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
