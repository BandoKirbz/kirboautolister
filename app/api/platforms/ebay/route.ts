import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { ebayService } from "@/lib/ebay/service";

export const runtime = "nodejs";

// POST /api/platforms/ebay - Create or update eBay connection
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: "Authorization code required" }, { status: 400 });
    }

    await ebayService.handleCallback(session.user.id, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("eBay connection error:", error);
    return NextResponse.json(
      { error: "Failed to connect eBay account" },
      { status: 500 }
    );
  }
}

// GET /api/platforms/ebay - Get eBay connection status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId: "ebay",
        },
      },
      select: {
        isEnabled: true,
        credentials: true,
      },
    });

    return NextResponse.json({
      connected: !!connection?.credentials,
      enabled: connection?.isEnabled ?? false,
    });
  } catch (error) {
    console.error("eBay status error:", error);
    return NextResponse.json(
      { error: "Failed to get eBay status" },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms/ebay - Disconnect eBay account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.platformconnection.delete({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId: "ebay",
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("eBay disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect eBay account" },
      { status: 500 }
    );
  }
} 