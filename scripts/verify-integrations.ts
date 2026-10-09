/**
 * All third-party integrations health check.
 *
 * Run with: npm run integrations:verify
 *
 * Covers every live dependency this app talks to today (Postgres, auth
 * secrets, AWS S3, eBay) plus honesty checks for platforms that are
 * catalogued but not implemented. Read-only except for a no-op S3
 * HeadBucket / presign when AWS is configured.
 */
import { loadEnvConfig } from "@next/env";

import { mapConditionToGrailed } from "../lib/grailed/listing";
import { GRAILED_UNAVAILABLE_REASON } from "../lib/grailed/status";
import { mapConditionToDepop } from "../lib/depop/listing";
import { DEPOP_ACCESS_REASON } from "../lib/depop/status";
import { listDepopProducts } from "../lib/depop/client";
import { mapWhenMadeFromCondition } from "../lib/etsy/listing";
import { isEtsyConfigured } from "../lib/etsy/env";
import { fetchEtsySellerTaxonomyRoot } from "../lib/etsy/client";
import {
  CheckFailure,
  CheckResult,
  exitFromResults,
  failedChecks,
  printResults,
  runCheck,
  skipCheck,
} from "./lib/health-check";
import { runEbayHealthChecks } from "./lib/verify-ebay";

loadEnvConfig(process.cwd());

const LIVE_PLATFORM_IDS = new Set(["ebay", "etsy", "depop"]);

async function runPostgresChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { db } = await import("../lib/db");

  await runCheck(results, "Postgres connectivity", async () => {
    const { getDatabaseTarget } = await import("../lib/database-url");
    const target = getDatabaseTarget();
    const rows = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    if (!rows?.[0] || Number(rows[0].ok) !== 1) {
      throw new CheckFailure(
        "Database did not return 1 from SELECT 1",
        "Confirm DATABASE_URL (local) or DATABASE_HOST (Aurora IAM) in .env.local, then `npm run db:push`."
      );
    }
    return `SELECT 1 ok, host=${target.host}, auth=${target.iamAuth ? "iam" : "url"}`;
  });

  await runCheck(results, "Required tables reachable", async () => {
    const [users, products, platforms] = await Promise.all([
      db.user.count(),
      db.product.count(),
      db.platform.count(),
    ]);
    return `users=${users}, products=${products}, platforms=${platforms}`;
  });

  return results;
}

async function runAuthSecretChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  await runCheck(results, "NEXTAUTH_URL + NEXTAUTH_SECRET", async () => {
    const url = process.env.NEXTAUTH_URL;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!url?.trim()) {
      throw new CheckFailure("NEXTAUTH_URL is missing", "Set NEXTAUTH_URL in .env.local (e.g. http://localhost:3000).");
    }
    if (!secret?.trim()) {
      throw new CheckFailure(
        "NEXTAUTH_SECRET is missing",
        "Generate one with `openssl rand -base64 32` and set NEXTAUTH_SECRET in .env.local."
      );
    }
    return `urlHost=${new URL(url).host}, secretSet=true`;
  });

  await runCheck(results, "EBAY_TOKEN_ENCRYPTION_KEY", async () => {
    const { encrypt, decrypt } = await import("../lib/crypto");
    try {
      const probe = `health-check-${Date.now()}`;
      if (decrypt(encrypt(probe)) !== probe) {
        throw new Error("encrypt/decrypt round-trip mismatch");
      }
      return "32-byte key, AES-256-GCM round-trip ok";
    } catch (err) {
      throw new CheckFailure(
        err instanceof Error ? err.message : String(err),
        "Set EBAY_TOKEN_ENCRYPTION_KEY to a 32-byte base64 value (`openssl rand -base64 32`). Changing it invalidates already-encrypted tokens — reconnect eBay after a rotation."
      );
    }
  });

  return results;
}

async function runS3Checks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { getS3Env, isS3Configured, createPresignedUpload } = await import("../lib/s3");

  if (!isS3Configured()) {
    await runCheck(results, "S3 configuration", async () => {
      throw new CheckFailure(
        "AWS_REGION or AWS_BUCKET_NAME is missing. Uploads need a bucket. Locally, also set an access key pair. In production, omit the keys and attach an IAM role.",
        "Set AWS_REGION and AWS_BUCKET_NAME. For local dev, add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local. For a deployed app, attach an IAM role that can put, get, and delete product-images/*."
      );
    });
    skipCheck(results, "S3 HeadBucket", "Skipped because S3 is not configured.");
    skipCheck(results, "S3 presigned PUT URL", "Skipped because S3 is not configured.");
    return results;
  }

  await runCheck(results, "S3 configuration", async () => {
    const env = getS3Env();
    const auth = env.accessKeyId ? "static access key" : "default credential chain (IAM role)";
    return `region=${env.region}, bucket=${env.bucket}, auth=${auth}`;
  });

  await runCheck(results, "S3 HeadBucket", async () => {
    const { HeadBucketCommand, S3Client } = await import("@aws-sdk/client-s3");
    const env = getS3Env();
    const client = new S3Client({
      region: env.region,
      ...(env.accessKeyId && env.secretAccessKey
        ? { credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey } }
        : {}),
    });
    await client.send(new HeadBucketCommand({ Bucket: env.bucket }));
    return `bucket ${env.bucket} reachable`;
  });

  await runCheck(results, "S3 presigned PUT URL", async () => {
    const { uploadUrl, publicUrl } = await createPresignedUpload({
      userId: "integration-verify",
      contentType: "image/jpeg",
      contentLength: 1024,
    });
    if (!uploadUrl.startsWith("https://") || !publicUrl.startsWith("https://")) {
      throw new CheckFailure("Presign returned a non-HTTPS URL", "Inspect lib/s3.ts getPublicUrl / getSignedUrl.");
    }
    return `presign ok, publicHost=${new URL(publicUrl).host}`;
  });

  return results;
}

async function runPlatformCatalogChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { PLATFORM_CATALOG } = await import("../lib/platforms");
  const { db } = await import("../lib/db");

  await runCheck(results, "Platform catalog honesty", async () => {
    const available = PLATFORM_CATALOG.filter((p) => p.availability === "available").map((p) => p.id);
    const comingSoon = PLATFORM_CATALOG.filter((p) => p.availability === "coming_soon").map((p) => p.id);
    if (!available.includes("ebay")) {
      throw new CheckFailure("eBay is not marked available in PLATFORM_CATALOG", "Set ebay.availability to available in lib/platforms.ts.");
    }
    const unexpected = available.filter((id) => !LIVE_PLATFORM_IDS.has(id));
    if (unexpected.length > 0) {
      throw new CheckFailure(
        `Catalog marks unimplemented platforms as available: ${unexpected.join(", ")}`,
        "Keep grailed/offerup as coming_soon until a real client exists, or the UI will offer a connect flow that cannot work."
      );
    }
    if (!available.includes("depop")) {
      throw new CheckFailure(
        "Depop client exists but catalog is not available",
        "Set depop.availability to available in lib/platforms.ts."
      );
    }
    if (!available.includes("etsy")) {
      throw new CheckFailure(
        "Etsy client exists but catalog is not available",
        "Set etsy.availability to available in lib/platforms.ts."
      );
    }
    return `available=${available.join(", ") || "(none)"}; coming_soon=${comingSoon.join(", ") || "(none)"}`;
  });

  await runCheck(results, "Unimplemented platforms are not connected", async () => {
    const comingSoonIds = PLATFORM_CATALOG.filter((p) => p.availability === "coming_soon").map((p) => p.id);
    const stray = await db.platformconnection.findMany({
      where: { platformId: { in: comingSoonIds }, isEnabled: true },
      select: { platformId: true },
    });
    if (stray.length > 0) {
      throw new CheckFailure(
        `Enabled connections exist for unimplemented platforms: ${stray.map((s) => s.platformId).join(", ")}`,
        "Disable or delete those platformconnection rows. GET /api/platforms already refuses to report them as connected."
      );
    }
    return "no enabled grailed/offerup connections";
  });

  skipCheck(
    results,
    "Grailed listing publish",
    GRAILED_UNAVAILABLE_REASON,
    "Keep grailed.availability as coming_soon. Do not store Grailed passwords or scrape the site. Publish only after Grailed ships an official API; lib/grailed/listing.ts already maps our conditions."
  );

  await runCheck(results, "Grailed condition map", async () => {
    const mapped = ["new-with-tags", "new-without-tags", "very-good", "good", "fair"].map(
      (condition) => `${condition}=${mapConditionToGrailed(condition)}`
    );
    return mapped.join(", ");
  });

  await runCheck(results, "Depop condition map", async () => {
    const mapped = ["new-with-tags", "new-without-tags", "very-good", "good", "fair"].map(
      (condition) => `${condition}=${mapConditionToDepop(condition)}`
    );
    return mapped.join(", ");
  });

  await runCheck(results, "Etsy when_made map", async () => {
    const mapped = ["new-with-tags", "new-without-tags", "very-good", "good", "fair"].map(
      (condition) => `${condition}=${mapWhenMadeFromCondition(condition)}`
    );
    return mapped.join(", ");
  });

  if (isEtsyConfigured()) {
    await runCheck(results, "Etsy seller taxonomy (app key)", async () => {
      const result = await fetchEtsySellerTaxonomyRoot();
      return `taxonomyNodes=${result.nodeCount}`;
    });
  } else {
    skipCheck(
      results,
      "Etsy seller taxonomy (app key)",
      "ETSY_API_KEYSTRING / ETSY_SHARED_SECRET not set",
      "Create an app at https://www.etsy.com/developers/your-apps, set both secrets in .env.local, register HTTPS callback /api/etsy/callback, then re-run."
    );
  }

  const depopEnvKey = process.env.DEPOP_VERIFY_API_KEY?.trim();
  const depopEnv = process.env.DEPOP_VERIFY_ENVIRONMENT === "production" ? "production" : "staging";
  if (depopEnvKey) {
    await runCheck(results, "Depop GET /products (env key)", async () => {
      const result = await listDepopProducts(
        { apiKey: depopEnvKey, environment: depopEnv },
        1
      );
      return `status=${result.status}, sampleItems=${result.itemCount}, env=${depopEnv}`;
    });
  } else {
    skipCheck(
      results,
      "Depop GET /products (env key)",
      DEPOP_ACCESS_REASON,
      "When Depop issues a staging key, set DEPOP_VERIFY_API_KEY in .env.local (and optional DEPOP_VERIFY_ENVIRONMENT=staging|production) then re-run."
    );
  }

  return results;
}

async function main() {
  console.log("\nThird-party integration health check\n");

  const sections: Array<{ title: string; results: CheckResult[] }> = [];

  const postgres = await runPostgresChecks();
  printResults("== Postgres ==", postgres);
  sections.push({ title: "Postgres", results: postgres });

  const auth = await runAuthSecretChecks();
  printResults("== Auth / secrets ==", auth);
  sections.push({ title: "Auth / secrets", results: auth });

  const s3 = await runS3Checks();
  printResults("== AWS S3 ==", s3);
  sections.push({ title: "AWS S3", results: s3 });

  const platforms = await runPlatformCatalogChecks();
  printResults("== Selling platforms ==", platforms);
  sections.push({ title: "Selling platforms", results: platforms });

  const ebay = await runEbayHealthChecks();
  printResults("== eBay ==", ebay);
  sections.push({ title: "eBay", results: ebay });

  const all = sections.flatMap((section) => section.results);
  const failures = failedChecks(all);
  const passed = all.filter((r) => r.status === "pass").length;
  const skipped = all.filter((r) => r.status === "skip").length;
  console.log(
    `=== Summary ===\n${passed} passed, ${failures.length} failed, ${skipped} skipped (${all.length} total).\n`
  );

  if (failures.length > 0) {
    console.log("Areas to fix:\n");
    for (const failure of failures) {
      console.log(`- ${failure.name}: ${failure.detail}`);
      if (failure.fix) console.log(`  Working path: ${failure.fix}`);
    }
    console.log("");
  }

  exitFromResults(all);
}

main().catch((err) => {
  console.error("Health check crashed:", err);
  process.exit(1);
});
