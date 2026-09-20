import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { ebayDb } from "@/lib/ebay/db";
import { verifyEbaySignature } from "@/lib/ebay/utils";

/**
 * NOT WIRED UP TO REAL EBAY TRAFFIC YET.
 *
 * This route assumes a simplified/invented notification envelope
 * (`{ notificationType, itemId, ... }`) that does not match eBay's actual
 * Notification API payload shape (topic-based envelope:
 * `{ metadata: { topic }, notification: { notificationId, eventDate, data } }`,
 * see https://developer.ebay.com/api-docs/commerce/notification/overview.html).
 * Nothing in this codebase also calls eBay's Notification API to actually
 * subscribe this app to any topic (`POST /commerce/notification/v1/subscription`),
 * so eBay has no reason to ever send a request here - as-is this endpoint
 * is dead code, not a security hole, but it also means order/sale/revision
 * events are NOT currently synced from eBay. Before relying on this for
 * production: (1) subscribe to the real topics you need (e.g. via the
 * Notification API or by polling the Fulfillment API for orders instead),
 * (2) rebuild the schemas below to match eBay's actual envelope for each
 * topic, (3) verify `x-ebay-signature` against eBay's published public key
 * (fetched by `kid`), not just an HMAC of a shared secret.
 */

// Notification payload schemas
const baseNotificationSchema = z.object({
  notificationType: z.enum([
    "ITEM_SOLD",
    "ITEM_REVISED",
    "ITEM_OUT_OF_STOCK",
    "ITEM_ENDED",
    "ORDER_PAYMENT_STATUS",
  ]),
  timestamp: z.string().datetime(),
  itemId: z.string(),
});

const itemSoldSchema = baseNotificationSchema.extend({
  notificationType: z.literal("ITEM_SOLD"),
  quantity: z.number().int().positive(),
  orderId: z.string(),
  transactionId: z.string(),
  buyerUsername: z.string(),
  totalPrice: z.number(),
});

const itemRevisedSchema = baseNotificationSchema.extend({
  notificationType: z.literal("ITEM_REVISED"),
  changes: z.array(
    z.object({
      field: z.string(),
      oldValue: z.string().optional(),
      newValue: z.string(),
    })
  ),
});

const itemOutOfStockSchema = baseNotificationSchema.extend({
  notificationType: z.literal("ITEM_OUT_OF_STOCK"),
});

export async function POST(request: Request) {
  try {
    // Get and verify eBay signature
    const headersList = headers();
    const signature = (await headersList).get("x-ebay-signature");
    
    if (!signature || !verifyEbaySignature(signature, await request.clone().text())) {
      console.error("Invalid eBay signature");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate the notification
    const payload = await request.json();
    console.log("eBay Notification:", payload);
    const validatedBase = baseNotificationSchema.parse(payload);
    
    // Log the notification for debugging
    console.log("eBay Notification:", {
      type: validatedBase.notificationType,
      itemId: validatedBase.itemId,
      timestamp: validatedBase.timestamp,
    });

    // Handle different notification types
    switch (validatedBase.notificationType) {
      case "ITEM_SOLD": {
        const data = itemSoldSchema.parse(payload);
        await handleItemSold(data);
        break;
      }
      case "ITEM_REVISED": {
        const data = itemRevisedSchema.parse(payload);
        await handleItemRevised(data);
        break;
      }
      case "ITEM_OUT_OF_STOCK": {
        const data = itemOutOfStockSchema.parse(payload);
        await handleItemOutOfStock(data);
        break;
      }
      default:
        console.log("Unhandled notification type:", validatedBase.notificationType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("eBay webhook error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid notification format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleItemSold(data: z.infer<typeof itemSoldSchema>) {
  const listing = await ebayDb.getListing(data.itemId);
  if (!listing) {
    console.error("Listing not found for sold item:", data.itemId);
    return;
  }

  const existingSpecifics = (listing.specificsList as Record<string, any>) || {};
  await ebayDb.updateListing(listing.productId, {
    status: "ACTIVE",
    lastSyncedAt: new Date(),
    // Store sale information
    specificsList: {
      ...existingSpecifics,
      sales: [
        ...(existingSpecifics.sales || []),
        {
          orderId: data.orderId,
          transactionId: data.transactionId,
          quantity: data.quantity,
          buyerUsername: data.buyerUsername,
          totalPrice: data.totalPrice,
          soldAt: data.timestamp,
        },
      ],
    },
  });

  // Update product quantity
  await ebayDb.updateProductQuantity(listing.productId, -data.quantity);
}

async function handleItemRevised(data: z.infer<typeof itemRevisedSchema>) {
  const listing = await ebayDb.getListing(data.itemId);
  if (!listing) {
    console.error("Listing not found for revision:", data.itemId);
    return;
  }

  const existingSpecifics = (listing.specificsList as Record<string, any>) || {};
  await ebayDb.updateListing(listing.productId, {
    lastSyncedAt: new Date(),
    // Store revision history
    specificsList: {
      ...existingSpecifics,
      revisions: [
        ...(existingSpecifics.revisions || []),
        {
          changes: data.changes,
          timestamp: data.timestamp,
        },
      ],
    },
  });
}

async function handleItemOutOfStock(data: z.infer<typeof itemOutOfStockSchema>) {
  const listing = await ebayDb.getListing(data.itemId);
  if (!listing) {
    console.error("Listing not found for out of stock:", data.itemId);
    return;
  }

  await ebayDb.updateListing(listing.productId, {
    status: "OUT_OF_STOCK",
    lastSyncedAt: new Date(),
  });

  // Update product quantity to 0
  await ebayDb.updateProductQuantity(listing.productId, 0);
} 