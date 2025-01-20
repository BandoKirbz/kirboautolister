import { authHandler } from "@/app/auth";

export const runtime = "nodejs";

export const { GET, POST } = authHandler; 