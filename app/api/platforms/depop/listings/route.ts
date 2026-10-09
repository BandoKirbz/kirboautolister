import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { DepopApiError } from "@/lib/depop/client";
import { publishProductToDepop } from "@/lib/depop/service";

export const runtime = "nodejs";

const publishSchema = z.object({
  productId: z.string().min(1),
});

/**
 * POST /api/platforms/depop/listings
 * Publish (or upsert) a Kirbo product onto Depop by SKU `kirbo-{productId}`.
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

    const result = await publishProductToDepop(session.user.id, {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      condition: product.condition,
      brand: product.brand,
      quantity: product.quantity,
      images: product.images,
    });

    return NextResponse.json({
      ok: true,
      sku: result.sku,
      depopProductId: result.depopProductId,
      environment: result.environment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (error instanceof DepopApiError) {
      return NextResponse.json(
        { error: error.message, detail: error.body },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Depop publish error:", error);
    return NextResponse.json({ error: "Failed to publish to Depop" }, { status: 500 });
  }
}
