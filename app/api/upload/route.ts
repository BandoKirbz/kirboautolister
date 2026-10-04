import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { deleteS3ObjectByUrl, createPresignedUpload, MAX_UPLOAD_BYTES } from "@/lib/s3";

const uploadRequestSchema = z.object({
  fileType: z.string().min(1),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, `File must be under ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`),
});

// POST /api/upload - Get a presigned URL to upload a product image
// directly to S3. See lib/s3.ts and docs/image-storage-setup.md.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { fileType, fileSize } = uploadRequestSchema.parse(json);

    const { key, uploadUrl, publicUrl } = await createPresignedUpload({
      userId: session.user.id,
      contentType: fileType,
      contentLength: fileSize,
    });

    return NextResponse.json({ uploadUrl, key, url: publicUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    console.error("Error generating upload URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}

const deleteRequestSchema = z.object({
  url: z.string().url(),
});

// DELETE /api/upload - Delete a previously-uploaded image from S3.
// Only used for images a user removes *before* saving the product (once
// saved, product deletion cleans these up itself - see
// app/api/products/[id]/route.ts).
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = deleteRequestSchema.parse(await request.json());

    // Keys are namespaced by userId (product-images/{userId}/...) - refuse
    // to delete anything outside the caller's own namespace.
    if (!url.includes(`/product-images/${session.user.id}/`)) {
      return NextResponse.json({ error: "Not authorized to delete this image" }, { status: 403 });
    }

    await deleteS3ObjectByUrl(url);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    console.error("Error deleting image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
