import {
  activateEtsyListing,
  buildEtsyConnectUrl,
  createEtsyDraftListing,
  exchangeEtsyAuthCode,
  getEtsyMe,
  refreshEtsyAccessToken,
  uploadEtsyListingImage,
} from "./client";
import { etsyDb } from "./db";
import { getEtsyEnv } from "./env";
import { buildEtsyDraftFields } from "./listing";
import {
  createCodeChallenge,
  createCodeVerifier,
  createEtsyOAuthState,
} from "./oauth-state";

const REFRESH_SKEW_MS = 60_000;

export const etsyService = {
  async getAuthUrl(userId: string): Promise<string> {
    const env = getEtsyEnv();
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);
    const state = createEtsyOAuthState(userId, codeVerifier);
    return buildEtsyConnectUrl({
      clientId: env.keystring,
      redirectUri: env.redirectUri,
      scopes: env.scopes,
      state,
      codeChallenge,
    });
  },

  async handleCallback(userId: string, code: string, codeVerifier: string) {
    const env = getEtsyEnv();
    const tokens = await exchangeEtsyAuthCode({
      code,
      codeVerifier,
      redirectUri: env.redirectUri,
    });
    const me = await getEtsyMe(tokens.access_token);
    if (!me.shop_id) {
      throw new Error(
        "This Etsy account has no shop_id. Open an Etsy seller shop, then reconnect."
      );
    }

    await etsyDb.upsertCredentials(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: env.scopes,
      etsyUserId: me.user_id,
      shopId: me.shop_id,
    });

    return { shopId: me.shop_id, userId: me.user_id };
  },

  async disconnect(userId: string) {
    await etsyDb.deleteCredentials(userId);
  },

  async getValidAccessToken(userId: string): Promise<{
    accessToken: string;
    shopId: number;
  }> {
    const creds = await etsyDb.getCredentials(userId);
    if (!creds || !creds.shopId) {
      throw new Error("Connect Etsy before publishing.");
    }

    if (creds.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
      return { accessToken: creds.accessToken, shopId: creds.shopId };
    }

    const refreshed = await refreshEtsyAccessToken(creds.refreshToken);
    await etsyDb.upsertCredentials(userId, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || creds.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scope: creds.scope,
      etsyUserId: creds.etsyUserId,
      shopId: creds.shopId,
      shopName: creds.shopName,
    });
    return { accessToken: refreshed.access_token, shopId: creds.shopId };
  },

  async publishProduct(
    userId: string,
    product: {
      id: string;
      name: string;
      description: string;
      price: number;
      condition: string;
      quantity?: number | null;
      images: Array<{ url: string }>;
    }
  ) {
    const { accessToken, shopId } = await this.getValidAccessToken(userId);
    const env = getEtsyEnv();
    const fields = buildEtsyDraftFields(product);

    const draft = await createEtsyDraftListing(accessToken, shopId, fields);

    const httpsImages = product.images.filter((img) => img.url.startsWith("https://"));
    if (httpsImages.length === 0) {
      await etsyDb.upsertListing(product.id, {
        etsyListingId: String(draft.listing_id),
        shopId,
        status: "DRAFT",
        taxonomyId: String(env.defaultTaxonomyId),
        errors: { message: "Draft created but no HTTPS images to upload (need S3 URLs)." },
      });
      return {
        listingId: draft.listing_id,
        status: "DRAFT" as const,
        activated: false,
        warning: "Draft created without images — upload public HTTPS images via S3.",
      };
    }

    let rank = 1;
    for (const image of httpsImages.slice(0, 10)) {
      const fetched = await fetch(image.url);
      if (!fetched.ok) continue;
      const contentType = fetched.headers.get("content-type") || "image/jpeg";
      const bytes = Buffer.from(await fetched.arrayBuffer());
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      await uploadEtsyListingImage(
        accessToken,
        shopId,
        draft.listing_id,
        bytes,
        `kirbo-${product.id}-${rank}.${ext}`,
        contentType,
        rank
      );
      rank += 1;
    }

    let activated = false;
    let status: "DRAFT" | "ACTIVE" = "DRAFT";
    let warning: string | undefined;

    // Only attempt activation when the shop has shipping + readiness configured.
    if (env.shippingProfileId && env.readinessStateId && rank > 1) {
      try {
        await activateEtsyListing(accessToken, shopId, draft.listing_id);
        activated = true;
        status = "ACTIVE";
      } catch (error) {
        warning =
          error instanceof Error
            ? `Draft + images saved; activate failed: ${error.message}`
            : "Draft + images saved; activate failed.";
      }
    } else {
      warning =
        "Draft listing created with images. Set ETSY_SHIPPING_PROFILE_ID and ETSY_READINESS_STATE_ID to auto-activate physical listings.";
    }

    await etsyDb.upsertListing(product.id, {
      etsyListingId: String(draft.listing_id),
      shopId,
      status,
      taxonomyId: String(fields.taxonomy_id),
      errors: warning ? { message: warning } : null,
    });

    return { listingId: draft.listing_id, status, activated, warning };
  },
};
