import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";

// Validation schema for creating/updating listings
const listingSchema = z.object({
  productId: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  condition: z.string(),
  images: z.array(z.string().url()),
  categoryId: z.string(),
});

// POST /api/platforms/ebay/listings - Create new listing
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = listingSchema.parse(await req.json());
    const result = await ebayService.createListing(session.user.id, data.productId, data);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[eBay Listings] Create failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid listing data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create eBay listing" },
      { status: 500 }
    );
  }
}

// PATCH /api/platforms/ebay/listings - Update existing listing
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = listingSchema.partial().parse(await req.json());
    if (!data.productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    await ebayService.updateListing(session.user.id, data.productId, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[eBay Listings] Update failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid listing data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update eBay listing" },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms/ebay/listings?productId={id} - Delete listing
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    await ebayService.deleteListing(session.user.id, productId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[eBay Listings] Delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete eBay listing" },
      { status: 500 }
    );
  }
} 