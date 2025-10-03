import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/platforms/grailed - Create or update Grailed connection
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Grailed integration coming soon"
    });
  } catch (error) {
    console.error("Grailed connection error:", error);
    return NextResponse.json(
      { error: "Failed to connect Grailed account" },
      { status: 500 }
    );
  }
}

// GET /api/platforms/grailed - Get Grailed connection status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Grailed integration coming soon"
    });
  } catch (error) {
    console.error("Grailed status error:", error);
    return NextResponse.json(
      { error: "Failed to get Grailed status" },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms/grailed - Disconnect Grailed account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Grailed integration coming soon"
    });
  } catch (error) {
    console.error("Grailed disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Grailed account" },
      { status: 500 }
    );
  }
} 