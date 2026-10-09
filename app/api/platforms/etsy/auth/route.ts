import { NextResponse } from "next/server";

import { auth } from "@/app/auth";
import { getEtsyEnv, isEtsyConfigured } from "@/lib/etsy/env";
import { etsyService } from "@/lib/etsy/service";

export const runtime = "nodejs";

/** GET /api/platforms/etsy/auth — OAuth connect URL for the signed-in user. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isEtsyConfigured()) {
      try {
        getEtsyEnv();
      } catch (err) {
        return NextResponse.json(
          {
            error: err instanceof Error ? err.message : "Etsy is not configured",
            configured: false,
          },
          { status: 400 }
        );
      }
    }

    const url = await etsyService.getAuthUrl(session.user.id);
    return NextResponse.json({ url, configured: true });
  } catch (error) {
    console.error("[Etsy Auth] Failed to get auth URL:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get Etsy authorization URL",
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/platforms/etsy/auth — disconnect. */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await etsyService.disconnect(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Etsy Auth] Disconnect failed:", error);
    return NextResponse.json({ error: "Failed to disconnect Etsy" }, { status: 500 });
  }
}
