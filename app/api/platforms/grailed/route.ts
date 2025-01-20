import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { z } from "zod";

// Define ProductImage type to match Prisma schema
type ProductImage = {
  id: string;
  productId: string;
  url: string;
  order: number;
};

// Define Condition type based on schema
type Condition = "new-with-tags" | "new-without-tags" | "very-good" | "good" | "fair";

import { db } from "@/lib/db";

// Grailed credentials schema
const grailedCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
  apiKey: z.string().optional(),
});

// POST /api/platforms/grailed/auth - Authenticate with Grailed
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const credentials = grailedCredentialsSchema.parse(json);

    // Authenticate with Grailed API
    const authResponse = await fetch("https://www.grailed.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.username,
        password: credentials.password,
      }),
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Invalid Grailed credentials" },
        { status: 401 }
      );
    }

    const { token } = await authResponse.json();

    // Store the connection
    await db.platformconnection.create({
      data: {
        userId: session.user.id,
        platformId: "grailed",
        credentials: JSON.stringify({
          token,
          username: credentials.username,
        }),
        isEnabled: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error authenticating with Grailed:", error);
    return NextResponse.json(
      { error: "Failed to authenticate with Grailed" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/grailed/list - List a product on Grailed
export async function list(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await request.json();

    // Get product details
    const product = await db.product.findUnique({
      where: { id: productId, userId: session.user.id },
      include: { images: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get Grailed credentials
    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId: "grailed",
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Grailed account not connected" },
        { status: 400 }
      );
    }

    const credentials = JSON.parse(connection.credentials as string);

    // Map condition to Grailed's format
    const conditionMap: Record<string, string> = {
      "new-with-tags": "New/Never Worn",
      "new-without-tags": "New/Never Worn",
      "very-good": "Gently Used",
      "good": "Used",
      "fair": "Very Worn",
    };

    // Create Grailed listing
    const listing = {
      title: product.name,
      description: product.description,
      price: product.price,
      condition: conditionMap[product.condition],
      photos: product.images.map((img: ProductImage) => img.url),
      category: "menswear", // You might want to map your categories
      designer: "other", // You might want to add designer field to your product
      size: "OS", // You might want to add size field to your product
      shipping_us: true,
      shipping_intl: false,
    };

    // Create listing on Grailed
    const listingResponse = await fetch("https://www.grailed.com/api/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.token}`,
      },
      body: JSON.stringify(listing),
    });

    const listingResult = await listingResponse.json();

    // Update platform listing status
    await db.listing.updateMany({
      where: {
        productId: product.id,
        platformId: "grailed",
        userId: product.userId,
      },
      data: {
        status: "ACTIVE",
        platformListingId: listingResult.id.toString(),
      },
    });

    return NextResponse.json({ success: true, listingId: listingResult.id });
  } catch (error) {
    console.error("Error listing on Grailed:", error);
    return NextResponse.json(
      { error: "Failed to list product on Grailed" },
      { status: 500 }
    );
  }
} 