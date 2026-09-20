import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Publicly serves a product image by id. This exists because uploaded
 * images are stored as base64 `data:` URLs (there's no external image
 * host yet), but third-party platforms like eBay require a real,
 * publicly-fetchable HTTPS URL for listing images. This route decodes the
 * stored data URL and serves the raw bytes so we can hand platforms a URL
 * like `${PUBLIC_BASE_URL}/api/images/{id}` instead of the data URL.
 *
 * Intentionally unauthenticated - listing photos are meant to be public,
 * and eBay's servers (not the logged-in user) are the ones fetching this.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const image = await db.productimage.findUnique({ where: { id } });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Already a real URL (e.g. from a future real image host) - just redirect.
  if (!image.url.startsWith("data:")) {
    return NextResponse.redirect(image.url);
  }

  const match = image.url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Unsupported image format" }, { status: 422 });
  }

  const [, contentType, base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
