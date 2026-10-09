import { NextResponse } from "next/server";
import { z } from "zod";
import { type NextRequest } from "next/server";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { ebayService } from "@/lib/ebay/service";
import { toPublicImageUrl } from "@/lib/ebay/utils";
import { publishProductToDepop } from "@/lib/depop/service";
import { deleteS3ObjectByUrl } from "@/lib/s3";

// Product update validation schema
const productUpdateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  condition: z.enum(["new-with-tags", "new-without-tags", "very-good", "good", "fair"]).optional(),
  price: z.number().min(0.01, "Price must be greater than 0").optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1").optional(),
  images: z.array(z.string()).min(1, "At least one image is required").optional(),
  platforms: z.array(z.string()).default([]),
  isDraft: z.boolean().optional(),
}).refine((data) => {
  // Only enforce description length for non-drafts
  if (!data.isDraft && data.description !== undefined) {
    return data.description.length >= 10;
  }
  return true;
}, {
  message: "Description must be at least 10 characters",
  path: ["description"]
});

// GET /api/products/[id] - Get a single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        images: true,
        listings: {
          include: {
            platform: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Format price with $ prefix
    const formattedProduct = {
      ...product,
      price: `$${product.price.toFixed(2)}`,
      listings: product.listings.map(listing => ({
        ...listing,
        price: `$${listing.price.toFixed(2)}`
      }))
    };

    return NextResponse.json(formattedProduct);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

// PATCH /api/products/[id] - Update a product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const json = await request.json();
    const validatedData = productUpdateSchema.parse(json);
    const isDraft = json.isDraft;

    // Check if product exists and belongs to user
    const existingProduct = await db.product.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        listings: true,
        images: true,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      name: validatedData.title || existingProduct.name,
      description: validatedData.description || existingProduct.description,
      brand: validatedData.brand !== undefined ? validatedData.brand : existingProduct.brand,
      condition: validatedData.condition || existingProduct.condition,
      quantity: validatedData.quantity || existingProduct.quantity,
      price: validatedData.price !== undefined ? validatedData.price : existingProduct.price,
    };
    
    // Handle image updates if provided
    if (validatedData.images) {
      // Images are replaced wholesale (not diffed), so anything in the old
      // set that isn't in the new set is genuinely gone - clean up its S3
      // object too, or it's an orphaned file nothing will ever delete.
      const newImageUrls = new Set(validatedData.images);
      const removedImages = existingProduct.images.filter((img) => !newImageUrls.has(img.url));
      await Promise.allSettled(removedImages.map((img) => deleteS3ObjectByUrl(img.url)));

      await db.productimage.deleteMany({
        where: { productId: id },
      });
      updateData.images = {
        create: validatedData.images.map((url) => ({ url })),
      };
    }

    // Handle platform updates if provided
    if (validatedData.platforms) {
      // Update existing listings instead of deleting and recreating
      const existingListings = await db.listing.findMany({
        where: { productId: id }
      });

      const existingPlatformIds = existingListings.map(l => l.platformId);
      const newPlatformIds = validatedData.platforms;

      // Update existing listings
      for (const listing of existingListings) {
        if (newPlatformIds.includes(listing.platformId)) {
          await db.listing.update({
            where: { id: listing.id },
            data: {
              title: validatedData.title || existingProduct.name,
              description: validatedData.description || existingProduct.description,
              price: validatedData.price !== undefined ? validatedData.price : existingProduct.price,
              quantity: validatedData.quantity || existingProduct.quantity,
              condition: validatedData.condition || existingProduct.condition,
              status: isDraft ? "DRAFT" : "PENDING",
            }
          });
        } else {
          // Delete listings for platforms that were removed
          await db.listing.delete({
            where: { id: listing.id }
          });
        }
      }

      // Create listings for new platforms
      const platformsToAdd = newPlatformIds.filter(p => !existingPlatformIds.includes(p));
      if (platformsToAdd.length > 0) {
        await db.listing.createMany({
          data: platformsToAdd.map(platformId => ({
            userId: session.user.id,
            productId: id,
            platformId,
            title: validatedData.title || existingProduct.name,
            description: validatedData.description || existingProduct.description,
            price: validatedData.price !== undefined ? validatedData.price : existingProduct.price,
            quantity: validatedData.quantity || existingProduct.quantity,
            condition: validatedData.condition || existingProduct.condition,
            status: isDraft ? "DRAFT" : "PENDING"
          }))
        });
      }
    }

    const updatedProduct = await db.product.update({
      where: { id },
      data: updateData,
      include: {
        images: true,
        listings: {
          include: {
            platform: true,
          },
        },
      },
    });

    // Push the change to eBay (synchronously) if eBay is one of the
    // selected platforms and this isn't a draft. As with product create,
    // a failure here doesn't fail the whole request - it's surfaced as a
    // warning and the eBay listing row is marked ERROR.
    let ebayError: string | undefined;
    const hadEbayListing = existingProduct.listings.some((l) => l.platformId === "ebay");
    const wantsEbay = validatedData.platforms
      ? validatedData.platforms.includes("ebay")
      : updatedProduct.listings.some((l) => l.platformId === "ebay");

    if (!isDraft && wantsEbay) {
      try {
        await ebayService.updateListing(session.user.id, id, {
          title: updateData.name,
          description: updateData.description,
          brand: updateData.brand,
          price: updateData.price,
          quantity: updateData.quantity,
          condition: updateData.condition,
          // eBay fetches images itself - it can't reach data: URLs, so
          // rewrite uploaded images to our public /api/images/{id} route.
          images: updatedProduct.images.map(toPublicImageUrl),
        });
      } catch (err) {
        ebayError = err instanceof Error ? err.message : "Failed to update eBay listing";
        console.error("[PRODUCT_PATCH] eBay update failed:", ebayError);
      }
    } else if (hadEbayListing) {
      // eBay was previously selected but is now either unchecked or the
      // product was converted back to a draft - end the live eBay listing
      // instead of just deleting our local row and leaving it live/orphaned
      // on eBay's side. ebayService.deleteListing is idempotent (safe to
      // call even if nothing was ever actually published).
      try {
        await ebayService.deleteListing(session.user.id, id);
      } catch (err) {
        ebayError = err instanceof Error ? err.message : "Failed to end eBay listing";
        console.error("[PRODUCT_PATCH] eBay delist failed:", ebayError);
      }
    }

    // Depop publish is an idempotent PUT by SKU, so editing a product just
    // re-pushes it. Failures are surfaced as a warning, never fail the save.
    let depopError: string | undefined;
    if (!isDraft && validatedData.platforms.includes("depop")) {
      try {
        await publishProductToDepop(session.user.id, {
          id,
          name: updatedProduct.name,
          description: updatedProduct.description,
          price: updatedProduct.price,
          condition: updatedProduct.condition,
          brand: updatedProduct.brand,
          quantity: updatedProduct.quantity,
          images: updatedProduct.images,
        });
      } catch (err) {
        depopError = err instanceof Error ? err.message : "Failed to update Depop listing";
        console.error("[PRODUCT_PATCH] Depop update failed:", depopError);
      }
    }

    // Format price with $ prefix
    const formattedProduct = {
      ...updatedProduct,
      price: `$${updatedProduct.price.toFixed(2)}`,
      listings: updatedProduct.listings.map(listing => ({
        ...listing,
        price: `$${listing.price.toFixed(2)}`
      })),
      ...((ebayError || depopError) && {
        warning: `Product updated, but ${[
          ebayError && `eBay sync failed: ${ebayError}`,
          depopError && `Depop sync failed: ${depopError}`,
        ]
          .filter(Boolean)
          .join(" | ")}`,
      }),
    };

    return NextResponse.json(formattedProduct);
  } catch (error) {
    console.error("[PRODUCT_PATCH] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: {
            message: "Validation failed",
            errors: error.errors.map(err => ({
              message: err.message,
              path: err.path.join("."),
            }))
          }
        }, 
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { message: "Failed to update product" } },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    console.log("[PRODUCT_DELETE] Attempting to delete product:", id);

    // First verify the product belongs to the user
    const product = await db.product.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: { images: true },
    });

    if (!product) {
      console.log("[PRODUCT_DELETE] Product not found:", id);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.log("[PRODUCT_DELETE] Found product, deleting...");

    // Clean up S3 objects for this product's images - nothing else will
    // ever reference them once the product row is gone.
    await Promise.allSettled(product.images.map((img) => deleteS3ObjectByUrl(img.url)));

    // End the eBay listing first (if any) so it doesn't stay live after
    // we remove our local record of it.
    const ebayListing = await db.listing.findFirst({
      where: { productId: id, platformId: "ebay" },
    });
    if (ebayListing) {
      try {
        await ebayService.deleteListing(session.user.id, id);
      } catch (err) {
        console.error("[PRODUCT_DELETE] Failed to end eBay listing:", err);
      }
    }

    // Delete related records first
    await db.productimage.deleteMany({
      where: { productId: id }
    });

    await db.listing.deleteMany({
      where: { productId: id }
    });

    // Then delete the product
    await db.product.delete({
      where: { id }
    });

    console.log("[PRODUCT_DELETE] Successfully deleted product:", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[PRODUCT_DELETE] Error:", errorMessage);
    console.error("[PRODUCT_DELETE] Full error:", error);
    
    return NextResponse.json({ 
      error: "Failed to delete product",
      details: errorMessage
    }, { 
      status: 500 
    });
  }
} 