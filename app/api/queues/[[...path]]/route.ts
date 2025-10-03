import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { serverAdapter } from "@/lib/queue";

export async function GET(request: Request) {
  try {
    // Check if user is authenticated and is an admin
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // You might want to add additional admin checks here
    // if (!session.user.isAdmin) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    const response = await serverAdapter.getRouter()(request);
    return response;
  } catch (error) {
    console.error("Queue monitoring error:", error);
    return NextResponse.json(
      { error: "Failed to access queue monitor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await serverAdapter.getRouter()(request);
    return response;
  } catch (error) {
    console.error("Queue monitoring error:", error);
    return NextResponse.json(
      { error: "Failed to access queue monitor" },
      { status: 500 }
    );
  }
} 