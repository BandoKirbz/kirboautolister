import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { EtsyApiError } from "@/lib/etsy/client";
import { etsyService } from "@/lib/etsy/service";

export const runtime = "nodejs";

const publishSchema = z.object({
  productId: z.string().min(1),
});

/**
 * POST /api/platforms/etsy/listings
 * Create an Etsy draft (and activate when shipping/readiness env is set).
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = publishSchema.parse(await request.json());
    const product = await db.product.findFirst({
      where: { id: productId, userId: session.user.id },
      include: { images: { orderBy: { order: "asc" } } },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await etsyService.publishProduct(session.user.id, {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      condition: product.condition,
      quantity: product.quantity,
      images: product.images,
    });

    await db.platform.upsert({
      where: { id: "etsy" },
      update: {},
      create: {
        id: "etsy",
        name: "Etsy",
        slug: "etsy",
        website: "https://www.etsy.com",
      },
    });

    const existing = await db.listing.findFirst({
      where: { productId: product.id, platformId: "etsy" },
    });
    const listingData = {
      title: product.name,
      description: product.description,
      price: product.price,
      quantity: product.quantity && product.quantity > 0 ? product.quantity : 1,
      condition: product.condition,
      status: result.status === "ACTIVE" ? ("ACTIVE" as const) : ("DRAFT" as const),
      platformListingId: String(result.listingId),
      errors: result.warning || null,
    };
    if (existing) {
      await db.listing.update({ where: { id: existing.id }, data: listingData });
    } else {
      await db.listing.create({
        data: {
          productId: product.id,
          platformId: "etsy",
          userId: session.user.id,
          ...listingData,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      listingId: result.listingId,
      status: result.status,
      activated: result.activated,
      warning: result.warning ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (error instanceof EtsyApiError) {
      return NextResponse.json(
        { error: error.message, detail: error.body },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Etsy publish error:", error);
    return NextResponse.json({ error: "Failed to publish to Etsy" }, { status: 500 });
  }
}
