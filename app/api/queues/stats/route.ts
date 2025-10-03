import { NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { queues } from "@/lib/queue";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [waiting, active, completed, failed] = await Promise.all([
      queues.listings.getWaitingCount(),
      queues.listings.getActiveCount(),
      queues.listings.getCompletedCount(),
      queues.listings.getFailedCount(),
    ]);

    return NextResponse.json({
      waiting,
      active,
      completed,
      failed,
    });
  } catch (error) {
    console.error("Failed to fetch queue stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue stats" },
      { status: 500 }
    );
  }
} 