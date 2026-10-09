/**
 * Resolve the Postgres connection string.
 *
 * Local: DATABASE_URL (password or trust auth).
 * Aurora Express / IAM: set DATABASE_HOST (+ name/user) and leave the
 * password out — we mint a 15-minute RDS IAM token with the SDK default
 * credential chain, or AWS_DATABASE_PROFILE when set (so S3 can keep using
 * a different local profile/keys).
 */
import { fromIni } from "@aws-sdk/credential-providers";
import { Signer } from "@aws-sdk/rds-signer";

export type DatabaseTarget = {
  host: string;
  port: number;
  database: string;
  user: string;
  /** true when DATABASE_HOST is set and we should use IAM tokens */
  iamAuth: boolean;
};

export function getDatabaseTarget(): DatabaseTarget {
  const host = process.env.DATABASE_HOST?.trim();
  if (host) {
    return {
      host,
      port: Number(process.env.DATABASE_PORT || "5432"),
      database: process.env.DATABASE_NAME?.trim() || "kirbo_autolister",
      user: process.env.DATABASE_USER?.trim() || "postgres",
      iamAuth: true,
    };
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL for local Postgres, or " +
        "DATABASE_HOST (+ DATABASE_NAME / DATABASE_USER) for Aurora IAM auth."
    );
  }

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || "5432"),
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(parsed.username || "postgres"),
    iamAuth: false,
  };
}

function signerCredentials() {
  const profile = process.env.AWS_DATABASE_PROFILE?.trim();
  return profile ? fromIni({ profile }) : undefined;
}

export async function buildDatabaseUrl(): Promise<string> {
  const target = getDatabaseTarget();
  if (!target.iamAuth) {
    return process.env.DATABASE_URL!;
  }

  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const signer = new Signer({
    hostname: target.host,
    port: target.port,
    username: target.user,
    region,
    credentials: signerCredentials(),
  });
  const token = await signer.getAuthToken();

  // Build manually — `URL.password` can over-encode IAM tokens in a way
  // Prisma's URL parser rejects, while encodeURIComponent once is correct.
  return (
    `postgresql://${encodeURIComponent(target.user)}:` +
    `${encodeURIComponent(token)}@${target.host}:${target.port}/` +
    `${encodeURIComponent(target.database)}?sslmode=require`
  );
}
