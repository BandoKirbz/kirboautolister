import { etsyApiKeyHeader, getEtsyEnv } from "./env";

const API_BASE = "https://api.etsy.com/v3";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const CONNECT_URL = "https://www.etsy.com/oauth/connect";

export class EtsyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = "EtsyApiError";
  }
}

export type EtsyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export type EtsyMeResponse = {
  user_id: number;
  shop_id: number | null;
};

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 800);
}

export function buildEtsyConnectUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(CONNECT_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeEtsyAuthCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<EtsyTokenResponse> {
  const env = getEtsyEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.keystring,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new EtsyApiError(
      `Etsy token exchange failed (${response.status})`,
      response.status,
      await readError(response)
    );
  }
  return (await response.json()) as EtsyTokenResponse;
}

export async function refreshEtsyAccessToken(refreshToken: string): Promise<EtsyTokenResponse> {
  const env = getEtsyEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.keystring,
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new EtsyApiError(
      `Etsy token refresh failed (${response.status})`,
      response.status,
      await readError(response)
    );
  }
  return (await response.json()) as EtsyTokenResponse;
}

async function etsyFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const env = getEtsyEnv();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": etsyApiKeyHeader(env),
      Accept: "application/json",
      ...init?.headers,
    },
  });
}

export async function getEtsyMe(accessToken: string): Promise<EtsyMeResponse> {
  const response = await etsyFetch(accessToken, "/application/users/me");
  if (!response.ok) {
    const body = await readError(response);
    if (
      response.status === 404 &&
      /could not find a shop/i.test(body)
    ) {
      throw new EtsyApiError(
        "This Etsy account has no seller shop. Open a shop at etsy.com/sell, then reconnect Kirbo.",
        response.status,
        body
      );
    }
    throw new EtsyApiError(
      `Etsy getMe failed (${response.status})`,
      response.status,
      body
    );
  }
  const json = (await response.json()) as {
    user_id?: number;
    shop_id?: number | null;
    // some responses nest under `user_id`/`shop_id` at top level; others under results
  };
  if (typeof json.user_id !== "number") {
    throw new EtsyApiError("Etsy getMe returned no user_id", 502, JSON.stringify(json).slice(0, 400));
  }
  return {
    user_id: json.user_id,
    shop_id: typeof json.shop_id === "number" ? json.shop_id : null,
  };
}

export async function createEtsyDraftListing(
  accessToken: string,
  shopId: number,
  fields: Record<string, string | number | boolean>
): Promise<{ listing_id: number }> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, String(value));
  }

  const response = await etsyFetch(accessToken, `/application/shops/${shopId}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new EtsyApiError(
      `Etsy createDraftListing failed (${response.status})`,
      response.status,
      await readError(response)
    );
  }
  const json = (await response.json()) as { listing_id?: number };
  if (typeof json.listing_id !== "number") {
    throw new EtsyApiError("Etsy createDraftListing returned no listing_id", 502);
  }
  return { listing_id: json.listing_id };
}

export async function uploadEtsyListingImage(
  accessToken: string,
  shopId: number,
  listingId: number,
  imageBytes: Buffer,
  filename: string,
  contentType: string,
  rank: number
): Promise<void> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBytes)], { type: contentType });
  form.append("image", blob, filename);
  form.append("rank", String(rank));
  form.append("overwrite", "true");

  const response = await etsyFetch(
    accessToken,
    `/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: "POST",
      body: form,
      // Let fetch set multipart boundary — do not set Content-Type manually.
      headers: {},
    }
  );
  if (!response.ok) {
    throw new EtsyApiError(
      `Etsy uploadListingImage failed (${response.status})`,
      response.status,
      await readError(response)
    );
  }
}

export async function activateEtsyListing(
  accessToken: string,
  shopId: number,
  listingId: number
): Promise<void> {
  const body = new URLSearchParams({ state: "active" });
  const response = await etsyFetch(
    accessToken,
    `/application/shops/${shopId}/listings/${listingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  if (!response.ok) {
    throw new EtsyApiError(
      `Etsy activate listing failed (${response.status})`,
      response.status,
      await readError(response)
    );
  }
}

/** App-key-only smoke test (no user token). */
export async function fetchEtsySellerTaxonomyRoot(): Promise<{ nodeCount: number }> {
  const env = getEtsyEnv();
  const response = await fetch(`${API_BASE}/application/seller-taxonomy/nodes`, {
    headers: {
      "x-api-key": etsyApiKeyHeader(env),
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new EtsyApiError(
      `Etsy taxonomy failed (${response.status})`,
      response.status,
      await readError(response)
    );
  }
  const json = (await response.json()) as { count?: number; results?: unknown[] };
  return { nodeCount: json.count ?? json.results?.length ?? 0 };
}
