import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { parseStoredCredentials } from "@/lib/depop/credentials";
import { ebayDb } from "@/lib/ebay/db";
import { etsyDb } from "@/lib/etsy/db";
import { PLATFORM_CATALOG } from "@/lib/platforms";

const platformConnectionSchema = z.object({
  platformId: z.string(),
  credentials: z.record(z.string()),
});

async function ensurePlatformRows() {
  for (const platform of PLATFORM_CATALOG) {
    await db.platform.upsert({
      where: { id: platform.id },
      update: {
        name: platform.name,
        slug: platform.slug,
        website: platform.website,
      },
      create: {
        id: platform.id,
        name: platform.name,
        slug: platform.slug,
        website: platform.website,
      },
    });
  }
}

/**
 * GET /api/platforms
 * Returns every known platform with an honest connection status for the
 * current user. eBay is "connected" only when real OAuth credentials exist
 * in ebaycredential — not just a platformconnection row.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePlatformRows();

    const [connections, ebayCredentials, etsyCredentials] = await Promise.all([
      db.platformconnection.findMany({
        where: { userId: session.user.id },
        select: {
          platformId: true,
          isEnabled: true,
          credentials: true,
        },
      }),
      ebayDb.getCredentials(session.user.id),
      etsyDb.getCredentials(session.user.id),
    ]);

    const connectionById = new Map(connections.map((c) => [c.platformId, c]));

    const platforms = PLATFORM_CATALOG.map((platform) => {
      const connection = connectionById.get(platform.id);

      if (platform.id === "ebay") {
        const connected = !!ebayCredentials;
        return {
          id: platform.id,
          name: platform.name,
          logo: platform.logo,
          availability: platform.availability,
          connected,
          enabled: connected && (connection?.isEnabled ?? true),
          username: ebayCredentials?.ebayUsername ?? null,
          sandbox: process.env.EBAY_SANDBOX === "true",
        };
      }

      if (platform.id === "etsy") {
        const connected = Boolean(etsyCredentials?.shopId);
        return {
          id: platform.id,
          name: platform.name,
          logo: platform.logo,
          availability: platform.availability,
          connected,
          enabled: connected,
          username: etsyCredentials?.shopName ?? (etsyCredentials?.shopId
            ? `shop ${etsyCredentials.shopId}`
            : null),
          sandbox: false,
        };
      }

      if (platform.id === "depop") {
        const stored = parseStoredCredentials(connection?.credentials);
        const connected = Boolean(connection?.isEnabled && stored);
        return {
          id: platform.id,
          name: platform.name,
          logo: platform.logo,
          availability: platform.availability,
          connected,
          enabled: connected,
          username: null,
          sandbox: stored?.environment === "staging",
        };
      }

      // Other platforms are not implemented yet — never claim "Connected".
      return {
        id: platform.id,
        name: platform.name,
        logo: platform.logo,
        availability: platform.availability,
        connected: false,
        enabled: false,
        username: null,
        sandbox: false,
        unavailableReason: platform.unavailableReason,
      };
    });

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("Error fetching platforms:", error);
    return NextResponse.json({ error: "Failed to fetch platforms" }, { status: 500 });
  }
}

// POST /api/platforms - generic connect (not used for eBay OAuth)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { platformId, credentials } = platformConnectionSchema.parse(json);

    if (platformId === "ebay") {
      return NextResponse.json(
        { error: "Use /api/platforms/ebay/auth to connect eBay" },
        { status: 400 }
      );
    }

    if (platformId === "etsy") {
      return NextResponse.json(
        { error: "Use GET /api/platforms/etsy/auth to connect Etsy" },
        { status: 400 }
      );
    }

    if (platformId === "depop") {
      return NextResponse.json(
        { error: "Use POST /api/platforms/depop with { apiKey, environment }" },
        { status: 400 }
      );
    }

    const definition = PLATFORM_CATALOG.find((p) => p.id === platformId);
    if (!definition || definition.availability !== "available") {
      return NextResponse.json(
        { error: "This platform is not available yet" },
        { status: 400 }
      );
    }

    const existingConnection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId,
        },
      },
    });

    if (existingConnection) {
      return NextResponse.json({ error: "Platform already connected" }, { status: 400 });
    }

    await ensurePlatformRows();

    const connection = await db.platformconnection.create({
      data: {
        userId: session.user.id,
        platformId,
        credentials: JSON.stringify(credentials),
        isEnabled: true,
      },
      select: {
        platformId: true,
        isEnabled: true,
        platform: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    return NextResponse.json(connection, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error connecting platform:", error);
    return NextResponse.json({ error: "Failed to connect platform" }, { status: 500 });
  }
}

// DELETE /api/platforms - Disconnect a platform
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platformId } = await request.json();

    if (platformId === "ebay") {
      return NextResponse.json(
        { error: "Use DELETE /api/platforms/ebay/auth to disconnect eBay" },
        { status: 400 }
      );
    }

    if (platformId === "etsy") {
      return NextResponse.json(
        { error: "Use DELETE /api/platforms/etsy/auth to disconnect Etsy" },
        { status: 400 }
      );
    }

    if (platformId === "depop") {
      return NextResponse.json(
        { error: "Use DELETE /api/platforms/depop to disconnect Depop" },
        { status: 400 }
      );
    }

    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId,
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ error: "Platform connection not found" }, { status: 404 });
    }

    await db.platformconnection.delete({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId,
        },
      },
    });

    return NextResponse.json({ message: "Platform disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting platform:", error);
    return NextResponse.json({ error: "Failed to disconnect platform" }, { status: 500 });
  }
}
