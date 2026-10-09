import type { DepopEnvironment } from "./status";
import { depopBaseUrl } from "./status";

export class DepopApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = "DepopApiError";
  }
}

export type DepopClientOptions = {
  apiKey: string;
  environment: DepopEnvironment;
};

async function depopFetch(
  options: DepopClientOptions,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${depopBaseUrl(options.environment)}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return response;
}

/** Smoke test used on connect and by integrations:verify. */
export async function listDepopProducts(
  options: DepopClientOptions,
  limit = 1
): Promise<{ ok: true; status: number; itemCount: number }> {
  const response = await depopFetch(options, `/api/v1/products/?limit=${limit}`);
  const text = await response.text();
  if (!response.ok) {
    throw new DepopApiError(
      `Depop GET /products failed (${response.status})`,
      response.status,
      text.slice(0, 500)
    );
  }
  let itemCount = 0;
  try {
    const json = JSON.parse(text) as { results?: unknown[]; data?: unknown[]; items?: unknown[] };
    const list = json.results ?? json.data ?? json.items;
    itemCount = Array.isArray(list) ? list.length : 0;
  } catch {
    itemCount = 0;
  }
  return { ok: true, status: response.status, itemCount };
}

export async function upsertDepopProduct(
  options: DepopClientOptions,
  sku: string,
  body: Record<string, unknown>
): Promise<{ product_id?: number; sku: string }> {
  const encoded = encodeURIComponent(sku);
  const response = await depopFetch(options, `/api/v1/products/by-sku/${encoded}/`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new DepopApiError(
      `Depop PUT by-sku failed (${response.status})`,
      response.status,
      text.slice(0, 800)
    );
  }
  try {
    return JSON.parse(text) as { product_id?: number; sku: string };
  } catch {
    return { sku };
  }
}
