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

import { db } from "@/lib/db";

// eBay OAuth credentials schema
const ebayCredentialsSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  refreshToken: z.string().optional(),
});

// POST /api/platforms/ebay/auth - Authenticate with eBay
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { clientId, clientSecret } = ebayCredentialsSchema.parse(json);

    // Initialize eBay OAuth flow
    const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${process.env.EBAY_REDIRECT_URI}&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Error initiating eBay auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate eBay authentication" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/ebay/callback - Handle eBay OAuth callback
export async function callback(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    // Exchange code for tokens
    const tokenResponse = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_REDIRECT_URI!,
      }),
    });

    const tokens = await tokenResponse.json();

    // Store the connection
    await db.platformconnection.create({
      data: {
        userId: session.user.id,
        platformId: "ebay",
        credentials: JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
        isEnabled: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling eBay callback:", error);
    return NextResponse.json(
      { error: "Failed to complete eBay authentication" },
      { status: 500 }
    );
  }
}

// POST /api/platforms/ebay/list - List a product on eBay
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

    // Get eBay credentials
    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId: "ebay",
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "eBay account not connected" },
        { status: 400 }
      );
    }

    type EbayCredentials = {
      expiresAt: number;
      accessToken: string;
      refreshToken: string;
    }

    const credentials: EbayCredentials = JSON.parse(connection.credentials as string);

    // Check if token needs refresh
    if (Date.now() >= credentials.expiresAt) {
      // Refresh token logic here
    }

    // Create eBay inventory item
    const inventoryItem = {
      product: {
        title: product.name,
        description: product.description,
        aspects: {
          Condition: [product.condition],
        },
        imageUrls: product.images.map((img: ProductImage) => img.url),
      },
      availability: {
        shipToLocationAvailability: {
          quantity: product.quantity,
        },
      },
      condition: product.condition,
      packageWeightAndSize: {
        weight: {
          value: 1,
          unit: "POUND",
        },
      },
    };

    // Create eBay offer
    const offer = {
      sku: product.id,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      availableQuantity: product.quantity,
      categoryId: "11450", // You might want to map your categories to eBay's
      listingDescription: product.description,
      listingPolicies: {
        paymentPolicyId: "PAYMENT_POLICY_ID",
        returnPolicyId: "RETURN_POLICY_ID",
        shippingPolicyId: "SHIPPING_POLICY_ID",
      },
      pricingSummary: {
        price: {
          currency: "USD",
          value: product.price.toString(),
        },
      },
    };

    // Create inventory item
    await fetch("https://api.ebay.com/sell/inventory/v1/inventory_item", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(inventoryItem),
    });

    // Create offer
    const offerResponse = await fetch("https://api.ebay.com/sell/inventory/v1/offer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(offer),
    });

    const offerResult = await offerResponse.json();

    // Update platform listing status
    await db.listing.updateMany({
      where: {
        productId: product.id,
        platformId: "ebay",
        userId: session.user.id,
      },
      data: {
        status: "ACTIVE",
        platformListingId: offerResult.offerId,
      },
    });

    return NextResponse.json({ success: true, offerId: offerResult.offerId });
  } catch (error) {
    console.error("Error listing on eBay:", error);
    return NextResponse.json(
      { error: "Failed to list product on eBay" },
      { status: 500 }
    );
  }
} 