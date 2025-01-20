import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import { db } from "../../../../lib/db";

// Depop credentials schema
const depopCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// POST /api/platforms/depop/auth - Authenticate with Depop
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const credentials = depopCredentialsSchema.parse(json);

    // Authenticate with Depop API
    const authResponse = await fetch("https://api.depop.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        username: credentials.username,
        password: credentials.password,
        client_id: process.env.DEPOP_CLIENT_ID!,
        client_secret: process.env.DEPOP_CLIENT_SECRET!,
      }),
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Invalid Depop credentials" },
        { status: 401 }
      );
    }

    const tokens = await authResponse.json();

    // Store the connection
    await db.platformconnection.create({
      data: {
        userId: session.user.id,
        platformId: "depop",
        isEnabled: true,
        credentials: JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error authenticating with Depop:", error);
    return NextResponse.json(
      { error: "Failed to authenticate with Depop" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/depop/list - List a product on Depop
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
      include: { images: true }
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get Depop credentials
    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId: "depop",
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Depop account not connected" },
        { status: 400 }
      );
    }

    const credentials = JSON.parse(connection.credentials as string);

    // Check if token needs refresh
    if (Date.now() >= credentials.expiresAt) {
      // Refresh token logic here
    }

    // Map condition to Depop's format
    const conditionMap: Record<string, string> = {
      "new-with-tags": "BRAND_NEW",
      "new-without-tags": "LIKE_NEW",
      "very-good": "EXCELLENT",
      "good": "GOOD",
      "fair": "FAIR",
    };

    // Create Depop listing
    const listing = {
      title: product.name,
      description: product.description,
      price: {
        amount: Math.round(product.price * 100), // Depop uses cents
        currency: "USD",
      },
      condition: conditionMap[product.condition],
      quantity: product.quantity,
      pictures: product.images.map((img) => ({
        url: img.url,
        width: 1200,
        height: 1200,
      })),
      category_id: "MENS_CLOTHING",
      brand_id: "OTHER",
      size: {
        id: "OS",
      },
      shipping: {
        parcel_size: "MEDIUM",
        price: {
          amount: 1000,
          currency: "USD",
        },
      },
      national_shipping_cost: 1000,
      international_shipping_cost: null,
      style_tags: ["vintage", "streetwear"],
    };

    // Create listing on Depop
    const listingResponse = await fetch("https://api.depop.com/api/v2/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(listing),
    });

    const listingResult = await listingResponse.json();

    // Update platform listing status
    await db.listing.updateMany({
      where: {
        productId: product.id,
        platformId: "depop",
        userId: session.user.id,
      },
      data: {
        status: "ACTIVE",
        platformListingId: listingResult.id,
      },
    });

    return NextResponse.json({ success: true, listingId: listingResult.id });
  } catch (error) {
    console.error("Error listing on Depop:", error);
    return NextResponse.json(
      { error: "Failed to list product on Depop" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return Depop platform info
  return NextResponse.json({
    name: "Depop",
    status: "coming_soon"
  });
} 