import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ListingService } from "@/lib/services/listing-service";
import { UnifiedProduct } from "@/lib/platforms/types";
import { z } from "zod";

const listingService = new ListingService();

// Validation schema for creating/updating listings
const listingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be positive"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  condition: z.string(),
  category: z.string(),
  images: z.array(z.string().url()),
  specifications: z.record(z.string()),
  platforms: z.array(z.string()),
});

// POST /api/listings - Create a new listing
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const validatedData = listingSchema.parse(json);

    const product: UnifiedProduct = {
      ...validatedData,
      userId: session.user.id,
    };

    const jobId = await listingService.createListing(
      product,
      validatedData.platforms
    );

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Failed to create listing:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid listing data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}

// PATCH /api/listings/:id - Update an existing listing
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const validatedData = listingSchema.partial().parse(json);

    const jobId = await listingService.updateListing(
      params.id,
      {
        ...validatedData,
        userId: session.user.id,
      },
      validatedData.platforms || []
    );

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Failed to update listing:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid listing data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}

// DELETE /api/listings/:id - Delete a listing
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platforms = searchParams.get("platforms")?.split(",") || [];

    const jobId = await listingService.deleteListing(params.id, platforms);
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Failed to delete listing:", error);
    return NextResponse.json(
      { error: "Failed to delete listing" },
      { status: 500 }
    );
  }
}

// GET /api/listings/jobs/:jobId - Get job status
export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await listingService.getJobStatus(params.jobId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to get job status:", error);
    return NextResponse.json(
      { error: "Failed to get job status" },
      { status: 500 }
    );
  }
} 