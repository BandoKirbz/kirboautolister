import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";
import { ebayService } from "@/lib/ebay/service";
import { toPublicImageUrl } from "@/lib/ebay/utils";

// Product validation schema
const productSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  condition: z.enum(["new-with-tags", "new-without-tags", "very-good", "good", "fair"]).optional(),
  price: z.number().optional(),
  quantity: z.number().int().optional(),
  images: z.array(z.string()).default([]),
  platforms: z.array(z.string().regex(/^(ebay|grailed|depop|offerup)$/, "Invalid platform ID")).default([]),
  isDraft: z.boolean().default(false),
}).superRefine((data, ctx) => {
  // Skip validation for drafts
  if (data.isDraft) return;

  // Validate required fields for non-drafts
  if (!data.title || data.title.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Title must be at least 3 characters",
      path: ["title"],
    });
  }

  if (!data.description || data.description.length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Description must be at least 10 characters",
      path: ["description"],
    });
  }

  if (!data.condition) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Condition is required",
      path: ["condition"],
    });
  }

  if (!data.price || data.price < 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price must be greater than 0",
      path: ["price"],
    });
  }

  if (!data.quantity || data.quantity < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Quantity must be at least 1",
      path: ["quantity"],
    });
  }

  if (data.images.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one image is required",
      path: ["images"],
    });
  }

  if (data.platforms.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one platform",
      path: ["platforms"],
    });
  }
});

// GET /api/products - Get all products for the current user
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await db.product.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        images: true,
        listings: {
          include: {
            platform: true
          }
        }
      }
    });

    // Format prices with $ prefix
    const formattedProducts = products.map(product => ({
      ...product,
      price: `$${product.price.toFixed(2)}`
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("[PRODUCTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/products - Create a new product
export async function POST(req: Request) {
  try {
    const session = await auth();
    console.log("Full session:", session);
    
    if (!session?.user?.id) {
      console.error("Missing user ID in session:", session);
      return NextResponse.json({ error: "Invalid session - missing user ID" }, { status: 401 });
    }

    const body = await req.json();
    
    try {
      const validatedData = productSchema.parse(body);
      
      // Get or create user
      let user = await db.user.findUnique({
        where: { id: session.user.id }
      });

      if (!user) {
        console.log("Creating new user:", session.user);
        user = await db.user.create({
          data: {
            id: session.user.id,
            name: session.user.name || '',
            email: session.user.email || '',
            username: session.user.username || '',
          }
        });
      }

      console.log("Using user:", user.id);
      
      const product = await db.product.create({
        data: {
          userId: session.user.id,
          name: validatedData.title || "Untitled Draft",
          description: validatedData.description || "",
          brand: validatedData.brand || null,
          condition: validatedData.condition || "good",
          quantity: validatedData.quantity || 1,
          price: validatedData.price || 0,
          images: {
            create: validatedData.images.map((url: string) => ({ url }))
          },
        },
        include: { images: true },
      });

      // Ensure platforms exist
      const platformData = [
        { id: 'ebay', name: 'eBay', slug: 'ebay', website: 'https://www.ebay.com' },
        { id: 'grailed', name: 'Grailed', slug: 'grailed', website: 'https://www.grailed.com' },
        { id: 'depop', name: 'Depop', slug: 'depop', website: 'https://www.depop.com' },
        { id: 'offerup', name: 'OfferUp', slug: 'offerup', website: 'https://www.offerup.com' }
      ];

      for (const platform of platformData) {
        await db.platform.upsert({
          where: { id: platform.id },
          update: {},
          create: platform
        });
      }

      // Create listings only if platforms are selected
      if (validatedData.platforms.length > 0) {
        await db.listing.createMany({
          data: validatedData.platforms.map((platformId: string) => ({
            userId: session.user.id,
            productId: product.id,
            platformId,
            title: validatedData.title || "Untitled Draft",
            description: validatedData.description || "",
            price: validatedData.price || 0,
            quantity: validatedData.quantity || 1,
            condition: validatedData.condition || "good",
            status: validatedData.isDraft ? "DRAFT" : "PENDING",
          }))
        });
      }

      // Actually publish to eBay (synchronously) if it was selected and
      // this isn't a draft. Failures here don't fail the whole request -
      // the product/listing rows are already saved; the eBay listing row
      // is marked ERROR with the reason so the UI can surface it and the
      // user can retry.
      let ebayError: string | undefined;
      if (!validatedData.isDraft && validatedData.platforms.includes("ebay")) {
        try {
          await ebayService.createListing(session.user.id, product.id, {
            title: validatedData.title || "Untitled Draft",
            description: validatedData.description || "",
            brand: validatedData.brand,
            price: validatedData.price || 0,
            quantity: validatedData.quantity || 1,
            condition: validatedData.condition || "good",
            // eBay fetches images itself - it can't reach data: URLs, so
            // rewrite uploaded images to our public /api/images/{id} route.
            images: product.images.map(toPublicImageUrl),
          });
        } catch (err) {
          ebayError = err instanceof Error ? err.message : "Failed to publish to eBay";
          console.error("[PRODUCTS_POST] eBay publish failed:", ebayError);
        }
      }

      return NextResponse.json({ 
        success: true, 
        productId: product.id,
        product: {
          ...product,
          price: `$${product.price.toFixed(2)}`
        },
        ...(ebayError && { warning: `Product saved, but eBay publish failed: ${ebayError}` }),
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: validationError.errors },
          { status: 400 }
        );
      }
      throw validationError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create product";
    console.error("[PRODUCTS_POST]", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 