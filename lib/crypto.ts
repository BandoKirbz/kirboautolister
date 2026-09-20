import crypto from "crypto";

/**
 * AES-256-GCM encryption for secrets we must store at rest (eBay OAuth
 * access/refresh tokens). A DB leak should not hand over live eBay seller
 * account access - so these are encrypted with a key that only lives in
 * server env vars, never in the database.
 *
 * Format written to the DB: "v1:<ivHex>:<authTagHex>:<ciphertextHex>"
 * The "v1:" prefix lets us change algorithms later without breaking
 * decryption of old rows, and lets decrypt() detect legacy *unencrypted*
 * plaintext rows (pre-encryption rollout) and pass them through as-is
 * instead of crashing - they get re-encrypted the next time they're
 * written (e.g. on the next token refresh).
 */

const ALGORITHM = "aes-256-gcm";
const PREFIX = "v1:";

function getKey(): Buffer {
  const raw = process.env.EBAY_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "EBAY_TOKEN_ENCRYPTION_KEY must be set to store eBay tokens securely. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "EBAY_TOKEN_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypt a value written by {@link encrypt}. If the value doesn't look
 * like our encrypted format (e.g. a pre-encryption-rollout plaintext
 * token still in the DB), it's returned unchanged rather than throwing -
 * callers should re-save (re-encrypt) it on next write.
 */
export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value;

  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return value;

  try {
    const key = getKey();
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (err) {
    throw new Error(
      "Failed to decrypt stored eBay token. This usually means " +
        "EBAY_TOKEN_ENCRYPTION_KEY changed since it was encrypted - the " +
        `affected account will need to reconnect eBay. (${
          err instanceof Error ? err.message : "unknown error"
        })`
    );
  }
}
