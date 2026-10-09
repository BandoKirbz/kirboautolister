/**
 * kinit-style helper for Aurora IAM auth in GUI tools (pgAdmin, etc.).
 *
 * Mints a ~15-minute RDS auth token and copies it to the clipboard.
 * Run: npm run db:token
 *
 * Reads DATABASE_HOST (app-on-Aurora) or AURORA_HOST (pgAdmin-only) from
 * .env.local. Does not change how the Next.js app connects.
 */
import { spawnSync } from "child_process";

import { loadEnvConfig } from "@next/env";
import { fromIni } from "@aws-sdk/credential-providers";
import { Signer } from "@aws-sdk/rds-signer";

loadEnvConfig(process.cwd());

type Target = {
  host: string;
  port: number;
  database: string;
  user: string;
};

function resolveTarget(): Target {
  const host =
    process.env.DATABASE_HOST?.trim() || process.env.AURORA_HOST?.trim();
  if (!host) {
    throw new Error(
      "Set AURORA_HOST (or DATABASE_HOST) in .env.local to your cluster endpoint."
    );
  }
  return {
    host,
    port: Number(
      process.env.DATABASE_PORT || process.env.AURORA_PORT || "5432"
    ),
    database:
      process.env.DATABASE_NAME?.trim() ||
      process.env.AURORA_DB?.trim() ||
      "kirbo_autolister",
    user:
      process.env.DATABASE_USER?.trim() ||
      process.env.AURORA_USER?.trim() ||
      "postgres",
  };
}

function copyToClipboard(text: string): boolean {
  if (process.platform === "darwin") {
    return spawnSync("pbcopy", [], { input: text }).status === 0;
  }
  if (process.platform === "linux") {
    return (
      spawnSync("xclip", ["-selection", "clipboard"], { input: text }).status ===
      0
    );
  }
  return false;
}

async function main() {
  const target = resolveTarget();
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const profile = process.env.AWS_DATABASE_PROFILE?.trim();
  const signer = new Signer({
    hostname: target.host,
    port: target.port,
    username: target.user,
    region,
    credentials: profile ? fromIni({ profile }) : undefined,
  });

  const token = await signer.getAuthToken();
  const copied = copyToClipboard(token);

  console.log(`Host:     ${target.host}`);
  console.log(`Database: ${target.database}`);
  console.log(`User:     ${target.user}`);
  console.log(`SSL:      Require`);
  console.log(
    copied
      ? "Password: copied to clipboard (paste into pgAdmin; ~15 min TTL)."
      : "Password: could not copy — token follows:\n" + token
  );
  if (profile) {
    console.log(
      `If PAM/auth fails, refresh AWS login: aws login --profile ${profile}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
