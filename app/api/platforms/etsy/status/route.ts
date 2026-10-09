import { NextResponse } from "next/server";

import { auth } from "@/app/auth";
import { etsyDb } from "@/lib/etsy/db";
import { isEtsyConfigured } from "@/lib/etsy/env";

export const runtime = "nodejs";

/** GET /api/platforms/etsy/status */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isEtsyConfigured();
  const creds = await etsyDb.getCredentials(session.user.id);
  const connected = Boolean(creds?.shopId);

  return NextResponse.json({
    available: true,
    configured,
    connected,
    shopId: creds?.shopId ?? null,
    shopName: creds?.shopName ?? null,
    etsyUserId: creds?.etsyUserId ?? null,
  });
}
