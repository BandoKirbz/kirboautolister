import { authHandler } from "@/app/auth";

// Specify Node.js runtime and increase timeout for auth operations
export const runtime = "nodejs";
export const maxDuration = 10; // 10 seconds timeout

export const { GET, POST } = authHandler; 