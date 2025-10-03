import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { db } from "@/lib/db";

// Depop credentials schema
const depopCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const runtime = "nodejs";

// POST /api/platforms/depop/auth - Authenticate with Depop
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Depop integration coming soon"
    });
  } catch (error) {
    console.error("Depop POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Depop integration coming soon"
    });
  } catch (error) {
    console.error("Depop GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 