import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { z } from "zod";

import { db } from "@/lib/db";

// Profile update schema - mirrors the real, persisted columns on `user`.
// (Previously this accepted a `preferences` object that has no matching
// DB column - passing it through to `db.user.update` would have thrown a
// Prisma "Unknown argument" error the first time anyone actually saved
// notification preferences, since that feature doesn't exist yet.)
const profileUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .toLowerCase()
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  // Accepts either a real https URL or a data: URL (uploaded image encoded
  // client-side, same approach as product photos - see lib/ebay/utils.ts).
  image: z
    .string()
    .refine((v) => v === "" || v.startsWith("http") || v.startsWith("data:image/"), {
      message: "Invalid image",
    })
    .optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  location: z.string().max(100).optional(),
  website: z
    .string()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\//.test(v), {
      message: "Website must start with http:// or https://",
    })
    .optional(),
  businessName: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
});

const profileSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  bio: true,
  username: true,
  location: true,
  website: true,
  businessName: true,
  taxId: true,
  createdAt: true,
  platforms: {
    select: {
      platformId: true,
      isEnabled: true,
      platform: {
        select: {
          name: true,
          logoUrl: true,
        },
      },
    },
  },
} as const;

// GET /api/user/profile - Get user profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.user.findUnique({
      where: { id: session.user.id },
      select: profileSelect,
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PATCH /api/user/profile - Update user profile
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const validatedData = profileUpdateSchema.parse(json);

    // Check if email is being changed and verify it's not taken
    if (validatedData.email && validatedData.email !== session.user.email) {
      const existingUser = await db.user.findUnique({
        where: { email: validatedData.email },
      });
      if (existingUser) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
    }

    // Same check for username - it's what the eBay-style "connected as"
    // and login flows key off, so it has to stay unique.
    if (validatedData.username && validatedData.username !== session.user.username) {
      const existingUsername = await db.user.findUnique({
        where: { username: validatedData.username },
      });
      if (existingUsername) {
        return NextResponse.json({ error: "Username already taken" }, { status: 400 });
      }
    }

    const updatedProfile = await db.user.update({
      where: { id: session.user.id },
      data: validatedData,
      select: profileSelect,
    });

    return NextResponse.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
