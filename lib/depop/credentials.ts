import { encrypt, decrypt } from "@/lib/crypto";
import type { DepopEnvironment } from "./status";

export type DepopStoredCredentials = {
  /** AES-GCM ciphertext from lib/crypto (reuses EBAY_TOKEN_ENCRYPTION_KEY). */
  apiKey: string;
  environment: DepopEnvironment;
};

export type DepopConnectionSettings = {
  department: string;
  productType: string;
  sizeSetId: number;
  sizeId: number;
  countryCode: string;
  state?: string;
  priceCurrency: string;
  nationalShippingCost?: string;
  internationalShippingCost?: string;
};

const DEFAULT_SETTINGS: DepopConnectionSettings = {
  department: "menswear",
  productType: "tshirts",
  sizeSetId: 52,
  sizeId: 10,
  countryCode: "US",
  priceCurrency: "USD",
};

export function defaultDepopSettings(
  overrides?: Partial<DepopConnectionSettings>
): DepopConnectionSettings {
  return {
    ...DEFAULT_SETTINGS,
    department: process.env.DEPOP_DEFAULT_DEPARTMENT?.trim() || DEFAULT_SETTINGS.department,
    productType: process.env.DEPOP_DEFAULT_PRODUCT_TYPE?.trim() || DEFAULT_SETTINGS.productType,
    sizeSetId: Number(process.env.DEPOP_DEFAULT_SIZE_SET_ID || DEFAULT_SETTINGS.sizeSetId),
    sizeId: Number(process.env.DEPOP_DEFAULT_SIZE_ID || DEFAULT_SETTINGS.sizeId),
    countryCode: process.env.DEPOP_DEFAULT_COUNTRY?.trim() || DEFAULT_SETTINGS.countryCode,
    state: process.env.DEPOP_DEFAULT_STATE?.trim() || undefined,
    priceCurrency: process.env.DEPOP_DEFAULT_CURRENCY?.trim() || DEFAULT_SETTINGS.priceCurrency,
    ...overrides,
  };
}

export function encryptDepopApiKey(apiKey: string): string {
  return encrypt(apiKey);
}

export function decryptDepopApiKey(ciphertext: string): string {
  return decrypt(ciphertext);
}

export function parseStoredCredentials(raw: unknown): DepopStoredCredentials | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const apiKey = typeof obj.apiKey === "string" ? obj.apiKey : null;
  const environment = obj.environment === "production" ? "production" : "staging";
  if (!apiKey) return null;
  return { apiKey, environment };
}

export function parseConnectionSettings(raw: unknown): DepopConnectionSettings {
  if (!raw || typeof raw !== "object") return defaultDepopSettings();
  const obj = raw as Record<string, unknown>;
  return defaultDepopSettings({
    department: typeof obj.department === "string" ? obj.department : undefined,
    productType: typeof obj.productType === "string" ? obj.productType : undefined,
    sizeSetId: typeof obj.sizeSetId === "number" ? obj.sizeSetId : undefined,
    sizeId: typeof obj.sizeId === "number" ? obj.sizeId : undefined,
    countryCode: typeof obj.countryCode === "string" ? obj.countryCode : undefined,
    state: typeof obj.state === "string" ? obj.state : undefined,
    priceCurrency: typeof obj.priceCurrency === "string" ? obj.priceCurrency : undefined,
    nationalShippingCost:
      typeof obj.nationalShippingCost === "string" ? obj.nationalShippingCost : undefined,
    internationalShippingCost:
      typeof obj.internationalShippingCost === "string"
        ? obj.internationalShippingCost
        : undefined,
  });
}
