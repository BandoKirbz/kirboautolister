import { NextResponse } from "next/server";

import { auth } from "@/app/auth";
import { GRAILED_UNAVAILABLE_REASON, grailedIntegrationStatus } from "@/lib/grailed/status";

export const runtime = "nodejs";

// GET /api/platforms/grailed - Honest status. Never reports connected.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(grailedIntegrationStatus());
}

// POST /api/platforms/grailed - Publishing is blocked until Grailed ships an API.
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ error: GRAILED_UNAVAILABLE_REASON }, { status: 501 });
}

// DELETE /api/platforms/grailed - Nothing to disconnect.
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(grailedIntegrationStatus());
}
