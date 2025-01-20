import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";

// GET /api/platforms/ebay/auth - Get eBay OAuth URL
export async function GET() {
  try {
    const authUrl = await ebayService.getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("[eBay Auth] Failed to get auth URL:", error);
    return NextResponse.json(
      { error: "Failed to get eBay authorization URL" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/ebay/auth - Handle eBay OAuth callback
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    await ebayService.handleCallback(session.user.id, code);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[eBay Auth] Callback failed:", error);
    return NextResponse.json(
      { error: "Failed to complete eBay authentication" },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms/ebay/auth - Disconnect eBay account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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