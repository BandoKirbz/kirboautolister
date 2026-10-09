import { fromIni } from "@aws-sdk/credential-provider-ini";
import { Signer } from "@aws-sdk/rds-signer";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { getDatabaseTarget } from "@/lib/database-url";

const prismaClientSingleton = () => {
  const target = getDatabaseTarget();

  if (!target.iamAuth) {
    return new PrismaClient();
  }

  // Aurora Express accepts only IAM tokens (15 min). node-pg can resolve
  // `password` as an async function per new connection, so the long-lived
  // Next.js process never stores a stale token in DATABASE_URL.
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const profile = process.env.AWS_DATABASE_PROFILE?.trim();
  const signer = new Signer({
    hostname: target.host,
    port: target.port,
    username: target.user,
    region,
    credentials: profile ? fromIni({ profile }) : undefined,
  });

  const pool = new Pool({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    ssl: { rejectUnauthorized: true },
    password: async () => signer.getAuthToken(),
    max: 5,
    connectionTimeoutMillis: 20_000,
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
