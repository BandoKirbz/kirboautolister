import crypto from "crypto";

/**
 * Verify the signature of an eBay webhook notification
 * @param signature The signature from the X-EBAY-SIGNATURE header
 * @param payload The raw request body
 * @returns boolean indicating if the signature is valid
 */
export function verifyEbaySignature(signature: string, payload: string): boolean {
  try {
    // Get webhook signing key from environment variable
    const signingKey = process.env.EBAY_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      console.error("Missing EBAY_WEBHOOK_SIGNING_KEY environment variable");
      return false;
    }

    // Create HMAC using SHA256
    const hmac = crypto.createHmac("sha256", signingKey);
    hmac.update(payload);
    const calculatedSignature = hmac.digest("hex");

    // Compare signatures using constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  } catch (error) {
    console.error("Error verifying eBay signature:", error);
    return false;
  }
} 