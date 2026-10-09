import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { DepopApiError, listDepopProducts } from "@/lib/depop/client";
import {
  defaultDepopSettings,
  encryptDepopApiKey,
  parseConnectionSettings,
  parseStoredCredentials,
} from "@/lib/depop/credentials";
import { DEPOP_ACCESS_REASON } from "@/lib/depop/status";

export const runtime = "nodejs";

const connectSchema = z.object({
  apiKey: z.string().min(8, "API key is required"),
  environment: z.enum(["staging", "production"]).default("staging"),
  settings: z
    .object({
      department: z.string().optional(),
      productType: z.string().optional(),
      sizeSetId: z.number().int().positive().optional(),
      sizeId: z.number().int().positive().optional(),
      countryCode: z.string().min(2).max(2).optional(),
      state: z.string().optional(),
      priceCurrency: z.string().min(3).max(3).optional(),
      nationalShippingCost: z.string().optional(),
      internationalShippingCost: z.string().optional(),
    })
    .optional(),
});

async function ensureDepopPlatform() {
  await db.platform.upsert({
    where: { id: "depop" },
    update: {
      name: "Depop",
      slug: "depop",
      website: "https://www.depop.com",
    },
    create: {
      id: "depop",
      name: "Depop",
      slug: "depop",
      website: "https://www.depop.com",
    },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await db.platformconnection.findUnique({
    where: {
      userId_platformId: { userId: session.user.id, platformId: "depop" },
    },
  });

  const stored = parseStoredCredentials(connection?.credentials);
  return NextResponse.json({
    available: true,
    connected: Boolean(connection?.isEnabled && stored),
    environment: stored?.environment ?? "staging",
    accessHint: DEPOP_ACCESS_REASON,
    settings: parseConnectionSettings(connection?.settings),
  });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const body = connectSchema.parse(json);

    // Validate the key against Depop before saving.
    try {
      await listDepopProducts(
        { apiKey: body.apiKey, environment: body.environment },
        1
      );
    } catch (error) {
      if (error instanceof DepopApiError) {
        const hint =
          error.status === 401 || error.status === 403
            ? DEPOP_ACCESS_REASON
            : error.body || error.message;
        return NextResponse.json(
          { error: `Depop rejected this API key (${error.status}). ${hint}` },
          { status: 400 }
        );
      }
      throw error;
    }

    await ensureDepopPlatform();

    const credentials = {
      apiKey: encryptDepopApiKey(body.apiKey),
      environment: body.environment,
    };
    const settings = defaultDepopSettings(body.settings);

    await db.platformconnection.upsert({
      where: {
        userId_platformId: { userId: session.user.id, platformId: "depop" },
      },
      update: {
        isEnabled: true,
        credentials,
        settings,
      },
      create: {
        userId: session.user.id,
        platformId: "depop",
        isEnabled: true,
        credentials,
        settings,
      },
    });

    return NextResponse.json({
      connected: true,
      environment: body.environment,
      message: "Depop connected. Listings can use PUT /api/platforms/depop/listings.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Depop connect error:", error);
    return NextResponse.json({ error: "Failed to connect Depop" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.platformconnection.deleteMany({
    where: { userId: session.user.id, platformId: "depop" },
  });

  return NextResponse.json({
    connected: false,
    message: "Depop disconnected",
  });
}
