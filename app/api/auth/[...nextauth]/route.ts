import { authHandlers } from "@/app/auth";

// app/api/auth/[...nextauth]/route.ts

// Specify Node.js runtime for bcrypt compatibility
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = authHandlers; 