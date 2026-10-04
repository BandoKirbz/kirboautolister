import {
  CheckFailure,
  CheckResult,
  runCheck,
  skipCheck,
} from "./health-check";

const STALE_CATEGORY_ID = "50979";
const APP_TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";

export async function runEbayHealthChecks(): Promise<CheckResult[]> {
  const { db } = await import("../../lib/db");
  const { getEbayClient } = await import("../../lib/ebay/client");
  const { getEbayEnv } = await import("../../lib/ebay/env");
  const { EBAY_ENDPOINTS, EBAY_MARKETPLACE_ID, getEbayIdentityUrl, getHeaders } = await import(
    "../../lib/ebay/config"
  );
  const EbayAuthToken = (await import("ebay-oauth-nodejs-client")).default;
  const axios = (await import("axios")).default;

  const results: CheckResult[] = [];
  const env = getEbayEnv();

  console.log(`eBay environment: ${env.sandbox ? "SANDBOX" : "PRODUCTION"}`);

  await runCheck(results, "eBay environment variables", async () => {
    return `clientId=${env.clientId.slice(0, 6)}..., marketplace=${env.marketplaceId}, defaultCategory=${env.defaultCategoryId ?? "(none)"}`;
  });

  let appToken = "";
  await runCheck(results, "eBay application token (App ID + Cert ID)", async () => {
    const auth = new EbayAuthToken({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      redirectUri: env.ruName,
      env: env.sandbox ? "SANDBOX" : "PRODUCTION",
    });
    const raw = await auth.getApplicationToken(
      env.sandbox ? "SANDBOX" : "PRODUCTION",
      APP_TOKEN_SCOPE
    );
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data?.access_token) {
      throw new CheckFailure(
        "eBay returned no application access token",
        "Confirm EBAY_CLIENT_ID / EBAY_CLIENT_SECRET match the current Sandbox or Production keys at https://developer.ebay.com/my/keys and that EBAY_SANDBOX matches the key set."
      );
    }
    appToken = data.access_token;
    return `tokenType=${data.token_type || "Application Access Token"}, expiresIn=${data.expires_in}`;
  });

  if (appToken) {
    await runCheck(results, "Taxonomy API (app token)", async () => {
      const res = await axios.get(`${env.apiUrl}/commerce/taxonomy/v1/get_default_category_tree_id`, {
        headers: { Authorization: `Bearer ${appToken}` },
        params: { marketplace_id: env.marketplaceId },
      });
      const treeId = res.data?.categoryTreeId;
      if (!treeId) {
        throw new CheckFailure(
          "Taxonomy API responded without a categoryTreeId",
          "Check eBay Taxonomy release notes — get_default_category_tree_id may have changed shape."
        );
      }
      return `marketplace=${env.marketplaceId}, categoryTreeId=${treeId}`;
    });
  } else {
    skipCheck(
      results,
      "Taxonomy API (app token)",
      "Skipped because the application token check failed.",
      "Fix the application token check first."
    );
  }

  const credentialRow = await db.ebaycredential.findFirst({ orderBy: { updatedAt: "desc" } });
  const activeListings = await db.ebaylisting.findMany({
    where: { status: "ACTIVE" },
    select: { ebayItemId: true, categoryId: true },
  });
  const ebayConnection = await db.platformconnection.findFirst({
    where: { platformId: "ebay" },
    orderBy: { updatedAt: "desc" },
    select: { isEnabled: true, userId: true },
  });

  if (!credentialRow) {
    await runCheck(results, "Connected eBay seller", async () => {
      throw new CheckFailure(
        `No stored OAuth credentials. ${activeListings.length} ACTIVE listing(s) cannot be refreshed, revised, or withdrawn until a seller reconnects.`,
        "Sign in to the app and reconnect eBay at /dashboard/platforms. The OAuth flow writes ebaycredential; platformconnection.isEnabled alone is not enough."
      );
    });
  } else {
    await runCheck(results, "Connected eBay seller", async () => {
      const enabled = ebayConnection?.isEnabled ?? true;
      return `userId=${credentialRow.userId}, connectionEnabled=${enabled}`;
    });
  }

  if (!credentialRow && activeListings.length > 0) {
    await runCheck(results, "Orphaned live listings", async () => {
      const ids = activeListings
        .map((listing) => listing.ebayItemId)
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
      throw new CheckFailure(
        `${activeListings.length} ACTIVE eBay listing(s) exist without a connected seller (e.g. ${ids || "no item ids stored"}).`,
        "Reconnect eBay, then run this check again so token refresh / Inventory / Account APIs can be exercised against those listings."
      );
    });
  }

  const staleCategoryListings = activeListings.filter(
    (listing) => listing.categoryId === STALE_CATEGORY_ID
  );
  if (staleCategoryListings.length > 0) {
    await runCheck(results, `Listings still on stale category ${STALE_CATEGORY_ID}`, async () => {
      throw new CheckFailure(
        `${staleCategoryListings.length} ACTIVE listing(s) still use category ${STALE_CATEGORY_ID}, which silently drops Condition.`,
        `After reconnecting eBay, update or relist those items onto EBAY_DEFAULT_CATEGORY_ID=${env.defaultCategoryId ?? "175687"} (or a real per-product category). See docs/ebay-api-reference.md.`
      );
    });
  } else {
    await runCheck(results, `Listings still on stale category ${STALE_CATEGORY_ID}`, async () => {
      return "none";
    });
  }

  const userScoped = [
    "Token refresh (decrypt + refresh if expired)",
    "Identity API (whoami)",
    "Business policies exist (fulfillment/payment/return)",
    "Inventory location exists",
    `Condition support for EBAY_DEFAULT_CATEGORY_ID=${env.defaultCategoryId ?? "(none)"}`,
  ];

  if (!credentialRow) {
    for (const name of userScoped) {
      skipCheck(
        results,
        name,
        "Needs a connected seller (user access token).",
        "Reconnect eBay at /dashboard/platforms, then re-run."
      );
    }
  } else {
    const client = getEbayClient();
    let accessToken = "";

    await runCheck(results, "Token refresh (decrypt + refresh if expired)", async () => {
      accessToken = await client.getValidAccessToken(credentialRow.userId);
      return `ok for userId=${credentialRow.userId}`;
    });

    if (accessToken) {
      const headers = getHeaders(accessToken);

      await runCheck(results, "Identity API (whoami)", async () => {
        const res = await axios.get(getEbayIdentityUrl(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID,
          },
        });
        return `username=${res.data?.username}`;
      });

      await runCheck(results, "Business policies exist (fulfillment/payment/return)", async () => {
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
          throw new CheckFailure(
            `Missing policies - fulfillment=${fulfillmentCount}, payment=${paymentCount}, return=${returnCount}`,
            "Opt in to SELLING_POLICY_MANAGEMENT and create default fulfillment/payment/return policies (see EBAY_SETUP.md §4)."
          );
        }
        return `fulfillment=${fulfillmentCount}, payment=${paymentCount}, return=${returnCount}`;
      });

      await runCheck(results, "Inventory location exists", async () => {
        const res = await axios.get(`${EBAY_ENDPOINTS.inventory.base}${EBAY_ENDPOINTS.inventory.locations}`, {
          headers,
        });
        const locations = res.data?.locations || [];
        if (locations.length === 0) {
          throw new CheckFailure(
            "No inventory locations found",
            "Publishing an offer calls EbayClient.ensureMerchantLocation — reconnect and list once, or create a location in Seller Hub."
          );
        }
        return `key=${locations[0].merchantLocationKey}`;
      });

      const defaultCategoryId = env.defaultCategoryId;
      if (defaultCategoryId) {
        await runCheck(results, `Condition support for EBAY_DEFAULT_CATEGORY_ID=${defaultCategoryId}`, async () => {
          const res = await axios.get(
            `${env.apiUrl}/sell/metadata/v1/marketplace/${EBAY_MARKETPLACE_ID}/get_item_condition_policies`,
            { headers, params: { filter: `categoryIds:{${defaultCategoryId}}` } }
          );
          const policy = res.data?.itemConditionPolicies?.[0];
          if (!policy) {
            throw new CheckFailure(
              "No condition policy returned for this category",
              "Confirm EBAY_DEFAULT_CATEGORY_ID is still a valid leaf category, or pick a new one after checking get_item_condition_policies."
            );
          }
          if (policy.itemConditions?.length === 0) {
            throw new CheckFailure(
              `This category does not support/display Condition (itemConditionRequired=${policy.itemConditionRequired})`,
              "Switch EBAY_DEFAULT_CATEGORY_ID to a leaf category that returns a non-empty itemConditions list. See docs/ebay-api-reference.md."
            );
          }
          return `required=${policy.itemConditionRequired}, allowed=${policy.itemConditions
            ?.map((c: { conditionDescription?: string }) => c.conditionDescription)
            .join(", ")}`;
        });
      } else {
        skipCheck(
          results,
          "Condition support for EBAY_DEFAULT_CATEGORY_ID=(none)",
          "EBAY_DEFAULT_CATEGORY_ID is not set."
        );
      }
    } else {
      for (const name of userScoped.slice(1)) {
        skipCheck(results, name, "Skipped because token refresh failed.", "Fix token refresh first.");
      }
    }
  }

  await runCheck(results, "Local listing status summary", async () => {
    const grouped = await db.ebaylisting.groupBy({ by: ["status"], _count: true });
    return grouped.map((g) => `${g.status}=${g._count}`).join(", ") || "(no listings yet)";
  });

  return results;
}
