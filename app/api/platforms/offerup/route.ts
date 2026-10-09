import { NextResponse } from "next/server";

import { auth } from "@/app/auth";
import { getPlatformDefinition } from "@/lib/platforms";

export const runtime = "nodejs";

const REASON =
  getPlatformDefinition("offerup")?.unavailableReason ||
  "OfferUp has no public seller API.";

function status() {
  return { available: false as const, connected: false as const, reason: REASON };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(status());
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: REASON }, { status: 501 });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(status());
}
