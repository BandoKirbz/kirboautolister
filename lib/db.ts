// `lib/db.ts` and `lib/prisma.ts` used to each instantiate their own
// PrismaClient, which meant the app had two separate connection pools /
// global singletons pointed at the same database. This file now just
// re-exports the single canonical client from `lib/prisma.ts` so existing
// `import { db } from "@/lib/db"` call sites keep working.
export { prisma as db } from "./prisma";
