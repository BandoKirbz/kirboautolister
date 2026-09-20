/**
 * eBay integration health check.
 *
 * Run with: npm run ebay:verify
 *
 * Exercises the actual eBay Sandbox/Production API (whichever EBAY_SANDBOX
 * points at) using a real connected user's stored credentials, the same
 * way the app itself does - not a mock. Every check here is read-only
 * (no listings/policies/locations are created or modified).
 *
 * Why this exists: eBay's APIs, category rules, and required fields
 * change over time and are easy to silently drift out of sync with (see
 * docs/ebay-api-reference.md for a log of things we've already had to
 * work around). Re-run this whenever something eBay-related breaks
 * unexpectedly, after upgrading `ebay-oauth-nodejs-client`, or
 * periodically in CI against sandbox, to catch drift early instead of
 * discovering it mid-listing-publish in production.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  // Imported after env is loaded, since lib/ebay/env.ts reads process.env
  // at call time but other modules read it at import time in a few spots.
  const { db } = await import("../lib/db");
  const { ebayDb } = await import("../lib/ebay/db");
  const { getEbayClient } = await import("../lib/ebay/client");
  const { getEbayEnv } = await import("../lib/ebay/env");
  const { EBAY_ENDPOINTS, EBAY_MARKETPLACE_ID, getEbayIdentityUrl, getHeaders } = await import(
    "../lib/ebay/config"
  );
  const axios = (await import("axios")).default;

  type CheckResult = { name: string; ok: boolean; detail: string };
  const results: CheckResult[] = [];
  const check = async (name: string, fn: () => Promise<string>) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail });
    } catch (err) {
      results.push({
        name,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  };

  console.log(`\neBay integration health check (${getEbayEnv().sandbox ? "SANDBOX" : "PRODUCTION"})\n`);

  await check("Environment variables", async () => {
    const env = getEbayEnv();
    return `clientId=${env.clientId.slice(0, 6)}..., marketplace=${env.marketplaceId}, defaultCategory=${env.defaultCategoryId ?? "(none)"}`;
  });

  const credentialRow = await db.ebaycredential.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!credentialRow) {
    results.push({
      name: "Connected user",
      ok: false,
      detail: "No user has connected eBay yet - connect one via the app first.",
    });
    printAndExit(results);
    return;
  }
  const userId = credentialRow.userId;
  const client = getEbayClient();

  let accessToken = "";
  await check("Token refresh (decrypt + refresh if expired)", async () => {
    accessToken = await client.getValidAccessToken(userId);
    return `ok for userId=${userId}`;
  });

  if (accessToken) {
    const headers = getHeaders(accessToken);

    await check("Identity API (whoami)", async () => {
      const res = await axios.get(getEbayIdentityUrl(), {
        headers: { Authorization: `Bearer ${accessToken}`, "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID },
      });
      return `username=${res.data?.username}`;
    });

    await check("Business policies exist (fulfillment/payment/return)", async () => {
      const params = { marketplace_id: EBAY_MARKETPLACE_ID };
      const [f, p, r] = await Promise.all([
        axios.get(`${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.fulfillment}`, {
          headers,
          params,
        }),
        axios.get(`${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.payment}`, {
          headers,
          params,
        }),
        axios.get(`${EBAY_ENDPOINTS.account.base}${EBAY_ENDPOINTS.account.policies.return}`, {
          headers,
          params,
        }),
      ]);
      const fulfillmentCount = f.data?.fulfillmentPolicies?.length ?? 0;
      const paymentCount = p.data?.paymentPolicies?.length ?? 0;
      const returnCount = r.data?.returnPolicies?.length ?? 0;
      if (fulfillmentCount === 0 || paymentCount === 0 || returnCount === 0) {
        throw new Error(
          `Missing policies - fulfillment=${fulfillmentCount}, payment=${paymentCount}, return=${returnCount}`
        );
      }
      return `fulfillment=${fulfillmentCount}, payment=${paymentCount}, return=${returnCount}`;
    });

    await check("Inventory location exists", async () => {
      const res = await axios.get(`${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.locations}`, {
        headers,
      });
      const locations = res.data?.locations || [];
      if (locations.length === 0) throw new Error("No inventory locations found");
      return `key=${locations[0].merchantLocationKey}`;
    });

    const defaultCategoryId = getEbayEnv().defaultCategoryId;
    if (defaultCategoryId) {
      await check(`Condition support for EBAY_DEFAULT_CATEGORY_ID=${defaultCategoryId}`, async () => {
        const res = await axios.get(
          `${getEbayEnv().apiUrl}/sell/metadata/v1/marketplace/${EBAY_MARKETPLACE_ID}/get_item_condition_policies`,
          { headers, params: { filter: `categoryIds:{${defaultCategoryId}}` } }
        );
        const policy = res.data?.itemConditionPolicies?.[0];
        if (!policy) throw new Error("No condition policy returned for this category");
        if (policy.itemConditions?.length === 0) {
          return `WARNING: this category does not support/display Condition at all (itemConditionRequired=${policy.itemConditionRequired})`;
        }
        return `required=${policy.itemConditionRequired}, allowed=${policy.itemConditions?.map((c: any) => c.conditionDescription).join(", ")}`;
      });
    }
  }

  await check("Local listing status summary", async () => {
    const grouped = await db.ebaylisting.groupBy({ by: ["status"], _count: true });
    return grouped.map((g) => `${g.status}=${g._count}`).join(", ") || "(no listings yet)";
  });

  printAndExit(results);
}

function printAndExit(results: { name: string; ok: boolean; detail: string }[]) {
  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"} ${r.name}\n   ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Health check crashed:", err);
  process.exit(1);
});
