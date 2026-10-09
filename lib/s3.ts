/**
 * S3-backed product image storage.
 *
 * Product photos are uploaded directly from the browser to S3 via a
 * presigned PUT URL (the file bytes never pass through our server), and
 * stored under a public-read `product-images/{userId}/{key}` prefix - see
 * docs/image-storage-setup.md for the exact bucket policy/CORS/IAM setup
 * this requires. They're meant to be public: they're shown on eBay
 * listings and were already served fully unauthenticated via
 * /api/images/[id] before this existed (see lib/ebay/utils.ts).
 *
 * Local dev can pass static keys via .env.local (gitignored). Production
 * should omit those keys and let the AWS SDK use the IAM role attached to
 * the deployed app. Never commit access keys.
 */
import crypto from "crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB, matches the client-side limit
export const KEY_PREFIX = "product-images";

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isPlaceholder(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  const lower = value.toLowerCase();
  return ["replace-with", "your-", "changeme", "xxx", "todo"].some((m) => lower.includes(m));
}

export type S3Env = {
  region: string;
  bucket: string;
  /** Set only for local dev. Production leaves these empty and uses an IAM role. */
  accessKeyId?: string;
  secretAccessKey?: string;
};

/**
 * Read S3 config from env. Region and bucket are always required.
 * Access keys are optional: when both are absent, the AWS SDK uses its
 * default credential chain (the IAM role on ECS, App Runner, Lambda, or EC2).
 */
export function getS3Env(): S3Env {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_BUCKET_NAME;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  const missing: string[] = [];
  if (isPlaceholder(region)) missing.push("AWS_REGION");
  if (isPlaceholder(bucket)) missing.push("AWS_BUCKET_NAME");

  if (missing.length > 0) {
    throw new Error(
      `Image uploads aren't configured. Set ${missing.join(" and ")} for this environment. ` +
        `Locally those live in .env.local. In production, set them on the host and attach an IAM role ` +
        `instead of an access key.`
    );
  }

  const hasKey = !isPlaceholder(accessKeyId);
  const hasSecret = !isPlaceholder(secretAccessKey);
  if (hasKey !== hasSecret) {
    throw new Error(
      "Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or neither. " +
        "Local dev uses both. Production should set neither and use the app's IAM role."
    );
  }

  return {
    region: region!,
    bucket: bucket!,
    ...(hasKey && hasSecret
      ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! }
      : {}),
  };
}

/** Soft check used by status endpoints - does not throw. */
export function isS3Configured(): boolean {
  try {
    getS3Env();
    return true;
  } catch {
    return false;
  }
}

let cachedClient: { client: S3Client; region: string } | null = null;

function getClient(): { client: S3Client; env: S3Env } {
  const env = getS3Env();
  if (!cachedClient || cachedClient.region !== env.region) {
    cachedClient = {
      client: new S3Client({
        region: env.region,
        // Omit credentials so production uses the instance/task role.
        ...(env.accessKeyId && env.secretAccessKey
          ? {
              credentials: {
                accessKeyId: env.accessKeyId,
                secretAccessKey: env.secretAccessKey,
              },
            }
          : {}),
      }),
      region: env.region,
    };
  }
  return { client: cachedClient.client, env };
}

export function getPublicUrl(key: string): string {
  const { env } = getClient();
  return `https://${env.bucket}.s3.${env.region}.amazonaws.com/${key}`;
}

/**
 * True if `url` looks like it was returned by getPublicUrl() for the
 * currently-configured bucket/region - used to tell "real S3 URL" apart
 * from legacy base64 `data:` URLs when deciding how to clean up an image.
 */
export function isOwnS3Url(url: string): boolean {
  try {
    const env = getS3Env();
    return url.startsWith(`https://${env.bucket}.s3.${env.region}.amazonaws.com/`);
  } catch {
    return false;
  }
}

export function extractKeyFromUrl(url: string): string | null {
  if (!isOwnS3Url(url)) return null;
  const { env } = getClient();
  return url.slice(`https://${env.bucket}.s3.${env.region}.amazonaws.com/`.length) || null;
}

/**
 * Create a presigned PUT URL for a new product image upload.
 *
 * Including `ContentLength` in the signed request means S3 itself
 * rejects any upload whose actual body size doesn't match what the
 * client declared up front - so a tampered/larger file can't sneak past
 * the presigned URL, even though the byte-limit check itself happens
 * before we generate the URL.
 */
export async function createPresignedUpload({
  userId,
  contentType,
  contentLength,
}: {
  userId: string;
  contentType: string;
  contentLength: number;
}): Promise<{ key: string; uploadUrl: string; publicUrl: string }> {
  const extension = ALLOWED_CONTENT_TYPES[contentType];
  if (!extension) {
    throw new Error(`Unsupported image type: ${contentType}. Allowed: JPEG, PNG, WEBP, GIF.`);
  }
  if (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Image must be between 1 byte and ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
  }

  const { client } = getClient();
  const { env } = getClient();
  const key = `${KEY_PREFIX}/${userId}/${crypto.randomBytes(16).toString("hex")}.${extension}`;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 300 } // 5 minutes - just needs to cover the actual upload
  );

  return { key, uploadUrl, publicUrl: getPublicUrl(key) };
}

/** Delete an object by its S3 key. Safe to call even if it's already gone. */
export async function deleteS3Object(key: string): Promise<void> {
  const { client, env } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
}

/** Delete an object by its public URL, if it's one of ours. No-op otherwise. */
export async function deleteS3ObjectByUrl(url: string): Promise<void> {
  const key = extractKeyFromUrl(url);
  if (!key) return;
  try {
    await deleteS3Object(key);
  } catch (error) {
    // Best-effort cleanup - don't fail the calling operation (e.g. product
    // deletion) just because S3 cleanup hiccuped.
    console.error("[S3] Failed to delete object", key, error);
  }
}
