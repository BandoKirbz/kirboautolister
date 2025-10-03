import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";

// GET /api/platforms/ebay/auth - Get eBay OAuth URL
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.error("[eBay Auth] Unauthorized: No session or user ID found");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Generating eBay auth URL for user:", session.user.id);
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

// POST /api/platforms/ebay/auth - Handle eBay OAuth callback
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.error("[eBay Auth] Unauthorized: No session or user ID found");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { code, state, timestamp } = await req.json();
    console.log("[eBay Auth] Processing callback:", {
      userId: session.user.id,
      state,
      timestamp,
    });

    if (!code) {
      console.error("[eBay Auth] Missing authorization code");
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    const authResponse = await ebayService.handleCallback(session.user.id, code, state);
    console.log("[eBay Auth] Callback processed successfully:", {
      userId: session.user.id,
      username: authResponse.username,
      timestamp: authResponse.timestamp,
      environment: process.env.EBAY_SANDBOX === "true" ? "SANDBOX" : "PRODUCTION",
    });

    // Get the current connection status
    const connectionStatus = await ebayService.getConnectionStatus(session.user.id);

    return NextResponse.json({
      success: true,
      username: authResponse.username,
      environment: connectionStatus.environment,
      lastConnected: connectionStatus.lastConnected,
    });
  } catch (error) {
    console.error("[eBay Auth] Callback failed:", error);
    return NextResponse.json(
      { 
        error: "Failed to complete eBay authentication",
        details: error instanceof Error ? error.message : "Unknown error"
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
      console.error("[eBay Auth] Unauthorized: No session or user ID found");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[eBay Auth] Disconnecting account:", {
      userId: session.user.id,
      timestamp: new Date().toISOString(),
    });

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