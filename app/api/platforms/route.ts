import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/auth";
import { db } from "@/lib/db";

// Platform connection schema
const platformConnectionSchema = z.object({
  platformId: z.string(),
  credentials: z.record(z.string()),
});

// GET /api/platforms - Get user's platform connections
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platforms = await db.platformconnection.findMany({
      where: { userId: session.user.id },
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
    });

    return NextResponse.json(platforms);
  } catch (error) {
    console.error("Error fetching platforms:", error);
    return NextResponse.json(
      { error: "Failed to fetch platforms" },
      { status: 500 }
    );
  }
}

// POST /api/platforms - Connect a new platform
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { platformId, credentials } = platformConnectionSchema.parse(json);

    // Check if connection already exists
    const existingConnection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId,
        },
      },
    });

    if (existingConnection) {
      return NextResponse.json(
        { error: "Platform already connected" },
        { status: 400 }
      );
    }

    // Validate and store credentials securely
    // TODO: Implement platform-specific credential validation and encryption
    const encryptedCredentials = JSON.stringify(credentials); // Replace with proper encryption

    const connection = await db.platformconnection.create({
      data: {
        userId: session.user.id,
        platformId,
        credentials: encryptedCredentials,
        isEnabled: true,
      },
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
    });

    return NextResponse.json(connection, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error connecting platform:", error);
    return NextResponse.json(
      { error: "Failed to connect platform" },
      { status: 500 }
    );
  }
}

// DELETE /api/platforms - Disconnect a platform
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platformId } = await request.json();

    // Check if connection exists
    const connection = await db.platformconnection.findUnique({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId,
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Platform connection not found" },
        { status: 404 }
      );
    }

    // Delete connection
    await db.platformconnection.delete({
      where: {
        userId_platformId: {
          userId: session.user.id,
          platformId,
        },
      },
    });

    return NextResponse.json({ message: "Platform disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting platform:", error);
    return NextResponse.json(
      { error: "Failed to disconnect platform" },
      { status: 500 }
    );
  }
} 