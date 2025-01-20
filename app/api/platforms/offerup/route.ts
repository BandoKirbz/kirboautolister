import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "../../../../lib/db";

// OfferUp credentials schema
const offerupCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/platforms/offerup/auth - Authenticate with OfferUp
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const credentials = offerupCredentialsSchema.parse(json);

    // Authenticate with OfferUp API
    const authResponse = await fetch("https://api.offerup.com/auth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        client_id: process.env.OFFERUP_CLIENT_ID,
        client_secret: process.env.OFFERUP_CLIENT_SECRET,
        grant_type: "password",
      }),
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Invalid OfferUp credentials" },
        { status: 401 }
      );
    }

    const tokens = await authResponse.json();

    // Store the connection
    await db.platformconnection.create({
      data: {
        userId: session.user.id,
        platformId: "offerup",
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
    console.error("Error authenticating with OfferUp:", error);
    return NextResponse.json(
      { error: "Failed to authenticate with OfferUp" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/offerup/list - List a product on OfferUp
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

    // Get OfferUp credentials
    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId: "offerup",
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "OfferUp account not connected" },
        { status: 400 }
      );
    }

    const credentials = JSON.parse(connection.credentials as string);

    // Check if token needs refresh
    if (Date.now() >= credentials.expiresAt) {
      // Refresh token logic here
    }

    // Map condition to OfferUp's format
    const conditionMap: Record<string, string> = {
      "new-with-tags": "NEW",
      "new-without-tags": "LIKE_NEW",
      "very-good": "GOOD",
      "good": "GOOD",
      "fair": "FAIR",
    };

    // Create OfferUp listing
    const listing = {
      title: product.name,
      description: product.description,
      price: product.price,
      condition: conditionMap[product.condition],
      quantity: product.quantity,
      images: product.images.map((img: { url: any; }) => ({
        url: img.url,
      })),
      category: "clothing", // You might want to map your categories
      location: {
        // You might want to add location to your user profile
        latitude: 0,
        longitude: 0,
        radius: 20, // miles
      },
      shipping: {
        enabled: true,
        cost: 10.00, // You might want to make this configurable
      },
    };

    // Create listing on OfferUp
    const listingResponse = await fetch("https://api.offerup.com/v2/listings", {
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
        platformId: "offerup",
        userId: session.user.id,
      },
      data: {
        status: "ACTIVE",
        platformListingId: listingResult.id,
      },
    });

    return NextResponse.json({ success: true, listingId: listingResult.id });
  } catch (error) {
    console.error("Error listing on OfferUp:", error);
    return NextResponse.json(
      { error: "Failed to list product on OfferUp" },
      { status: 500 }
    );
  }
} 