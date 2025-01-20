import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/platforms/offerup - Create or update OfferUp connection
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "OfferUp integration coming soon"
    });
  } catch (error) {
    console.error("OfferUp connection error:", error);
    return NextResponse.json(
      { error: "Failed to connect OfferUp account" },
      { status: 500 }
    );
  }
}

// GET /api/platforms/offerup - Get OfferUp connection status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "OfferUp integration coming soon"
    });
  } catch (error) {
    console.error("OfferUp status error:", error);
    return NextResponse.json(
      { error: "Failed to get OfferUp status" },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms/offerup - Disconnect OfferUp account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "OfferUp integration coming soon"
    });
  } catch (error) {
    console.error("OfferUp disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect OfferUp account" },
      { status: 500 }
    );
  }
} 