/**
 * Run a Prisma CLI command with a fresh Aurora IAM token in DATABASE_URL.
 *
 * Example: npx tsx scripts/prisma-iam.ts db push
 */
import { spawnSync } from "child_process";

import { loadEnvConfig } from "@next/env";

import { buildDatabaseUrl, getDatabaseTarget } from "../lib/database-url";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/prisma-iam.ts <prisma args…>");
    console.error("Example: npx tsx scripts/prisma-iam.ts db push");
    process.exit(1);
  }

  const target = getDatabaseTarget();
  if (target.iamAuth) {
    process.env.DATABASE_URL = await buildDatabaseUrl();
    console.log(
      `Using IAM auth → ${target.user}@${target.host}/${target.database}`
    );
  } else {
    console.log(`Using DATABASE_URL → ${target.host}/${target.database}`);
  }

  const result = spawnSync("npx", ["prisma", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
