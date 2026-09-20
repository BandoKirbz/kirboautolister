# eBay API reference & drift-tracking

eBay's APIs, category rules, and required fields change over time, and their
documentation lives entirely on eBay's site (there's no package/SDK we can
`npm update` to pick up changes). This doc is the bridge: it maps every eBay
endpoint we actually call to (a) the file/function that calls it, (b) the
official doc page, and (c) real behavior we've had to discover by testing
against Sandbox, since the docs alone were sometimes wrong or incomplete.

**When something eBay-related breaks unexpectedly:** run `npm run
ebay:verify` first (see bottom of this doc) - it re-checks most of the
things listed below live against Sandbox/Production and will usually tell
you exactly which layer broke. Then check this doc for known quirks before
re-deriving them from scratch.

**When eBay changes something:** update the relevant row's "Last verified"
date and behavior notes after you re-test, so the next person (or agent)
knows this section is current.

## How to check for upstream changes

eBay doesn't expose a machine-readable "diff" of API changes, but two
things help:

1. **Release notes**: <https://developer.ebay.com/api-docs/static/versioning.html>
   and the per-API "What's New" sections on each API's landing page (e.g.
   <https://developer.ebay.com/api-docs/sell/inventory/overview.html>).
2. **Downloadable OAS 3.0 specs**: most Sell APIs have a "Resources" page
   with a direct OpenAPI YAML download (e.g. Inventory API:
   <https://developer.ebay.com/api-docs/sell/inventory/resources/overview.html>).
   These can be diffed programmatically (e.g. `openapi-diff`) against a
   copy saved in this repo, if this integration grows enough to justify it.

## Endpoints we call

| API | Endpoint | Our code | Official docs | Last verified |
|---|---|---|---|---|
| OAuth | `POST /identity/v1/oauth2/token` (auth code + refresh grants) | `EbayClient.exchangeCodeForToken`, `EbayClient.refreshToken` (`lib/ebay/client.ts`) | <https://developer.ebay.com/api-docs/static/oauth-tokens.html> | 2026-09-20 |
| Identity | `GET /commerce/identity/v1/user/` | `EbayService.getUserInfo` (`lib/ebay/service.ts`) | <https://developer.ebay.com/api-docs/commerce/identity/resources/methods> | 2026-09-20 |
| Inventory | `PUT /sell/inventory/v1/inventory_item/{sku}` | `EbayClient.createInventoryItem` / `updateInventoryItem` | <https://developer.ebay.com/api-docs/sell/inventory/resources/inventory_item/methods/createOrReplaceInventoryItem> | 2026-09-20 |
| Inventory | `DELETE /sell/inventory/v1/inventory_item/{sku}` | `EbayClient.deleteInventoryItem` | <https://developer.ebay.com/api-docs/sell/inventory/resources/inventory_item/methods/deleteInventoryItem> | 2026-09-20 |
| Inventory | `POST /sell/inventory/v1/offer` | `EbayClient.createOffer` | <https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/createOffer> | 2026-09-20 |
| Inventory | `PUT /sell/inventory/v1/offer/{offerId}` | `EbayClient.updateOffer` | <https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/updateOffer> | 2026-09-20 |
| Inventory | `GET /sell/inventory/v1/offer?sku=` | `EbayClient.getOffersForSku` | <https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/getOffers> | 2026-09-20 |
| Inventory | `POST /sell/inventory/v1/offer/{offerId}/publish` | `EbayClient.publishOffer` | <https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/publishOffer> | 2026-09-20 |
| Inventory | `POST /sell/inventory/v1/offer/{offerId}/withdraw` | `EbayClient.withdrawOffer` | <https://developer.ebay.com/api-docs/sell/inventory/resources/offer/methods/withdrawOffer> | 2026-09-20 |
| Inventory | `GET/POST /sell/inventory/v1/location[/{key}]` | `EbayClient.ensureMerchantLocation` | <https://developer.ebay.com/api-docs/sell/inventory/resources/location/methods/createInventoryLocation> | 2026-09-20 |
| Account | `POST /sell/account/v1/program/opt_in` | `EbayClient.optInToBusinessPolicies` | <https://developer.ebay.com/api-docs/sell/account/resources/program/methods/optInToProgram> | 2026-09-20 |
| Account | `GET/POST /sell/account/v1/{fulfillment,payment,return}_policy` | `EbayClient.getDefaultBusinessPolicies` | <https://developer.ebay.com/api-docs/sell/account/resources/methods> | 2026-09-20 |
| Metadata | `GET /sell/metadata/v1/marketplace/{id}/get_item_condition_policies` | `scripts/verify-ebay-integration.ts` only (not yet used in the live listing flow - see gaps below) | <https://developer.ebay.com/api-docs/sell/metadata/resources/marketplace/methods/getItemConditionPolicies> | 2026-09-20 |
| Taxonomy | *(not yet integrated)* | — | <https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html> | — |
| Notification | *(not yet integrated - see gaps below)* | `app/api/webhooks/ebay/route.ts` (unverified shape) | <https://developer.ebay.com/api-docs/commerce/notification/overview.html> | — |
| Marketplace Account Deletion | `GET`/`POST` to our own endpoint | `app/api/webhooks/ebay/account-deletion/route.ts` | <https://developer.ebay.com/marketplace-account-deletion> | 2026-09-20 |

## Hard-won behavior notes (not obvious from the docs alone)

These were each discovered by hitting a real error against Sandbox and
digging in - re-check them if eBay-related errors return after a period of
things working:

- **`redirect_uri` for OAuth means the RuName string, not the HTTPS callback
  URL.** Both the authorize URL and the token exchange must use the RuName
  (e.g. `YourApp-SBX-abc123`), configured to point at your real HTTPS
  callback URL *in the Developer Portal*, not in the API call itself.
- **The RuName's Accept URL must be HTTPS**, even in Sandbox - a local
  tunnel (cloudflared/ngrok) is required for local development.
- **`createOrReplaceInventoryItem` requires `PUT`, not `POST`** - `POST`
  returns a generic, unhelpful "Invalid request (2004)".
- **`Content-Language` header is required** on Inventory API calls (we
  default to `en-US`) - omitting it returns error 25709.
- **Business Policies must be opted into** (`SELLING_POLICY_MANAGEMENT`)
  before fulfillment/payment/return policies can be created or listed, and
  before an offer can be created. Returns error 20403 otherwise.
- **`ensureInventoryLocation` needs `addressLine1`** even though eBay's docs
  list it as optional - omitting it returns a generic "System error (25001)".
- **`getOffers?sku=` returns HTTP 400 with errorId 25713** ("This Offer is
  not available") for a SKU that has never had an offer created, instead of
  an empty list or 404. Treat 25713 the same as "no offers found" (see
  `EbayClient.getOffersForSku`).
- **eBay's sandbox connection is genuinely flaky** - transient `ECONNRESET`s
  and occasional 5xx/429 responses on otherwise-valid requests happen in
  normal use, not just under load. `EbayClient`'s axios response
  interceptor auto-retries (up to 2x, ~400/800ms backoff) on
  `ECONNRESET`/`ECONNABORTED`/`ETIMEDOUT`/`ENOTFOUND` and
  429/500/502/503/504, so a single blip doesn't surface as a failed
  listing update. Real eBay API errors (anything with a response body
  containing `errors[]`) are never retried - only connection-level/
  transient-status failures are.
- **The refresh_token grant requires `scopes` as a third argument** to
  `ebay-oauth-nodejs-client`'s `getAccessToken()` - omitting it throws
  `"scopes is required"` and silently breaks token refresh ~2 hours after
  connecting, until the user fully reconnects. Fixed in
  `EbayClient.refreshToken`; caught by `npm run ebay:verify`.
- **The refresh_token grant response usually doesn't include a new
  `refresh_token`** (they're long-lived/reused) - always fall back to the
  token you refreshed with, or you'll persist `undefined`.
- **Not every category supports/displays `condition`.** Some categories
  (especially wholesale/lot categories - the *previous* fallback
  `EBAY_DEFAULT_CATEGORY_ID=50979`, "Wholesale Vintage Clothing", was one)
  have `itemConditionRequired: false` and `itemConditions: []` from the
  Metadata API's `get_item_condition_policies` - eBay silently drops
  whatever `condition` you send and the item page shows "Condition: --
  (not specified)". This is not a bug in our code; check the category's
  condition policy (`GET get_item_condition_policies?filter=categoryIds:
  {id}`) before assuming a condition value isn't being sent. Fixed by
  switching `EBAY_DEFAULT_CATEGORY_ID` to `175687` ("Cell Phone
  Accessories > Cases, Covers & Skins"), a leaf category with a real
  `itemConditions` list (`New`/`Open box`/`Used`/`For parts or not
  working`) that all 5 of our `CONDITION_MAP` enum values
  (`NEW`/`NEW_OTHER`/`USED_VERY_GOOD`/`USED_GOOD`/`USED_ACCEPTABLE`) were
  verified (via live sandbox offer creation) to be accepted for - see
  `git log` for the probe script used, or re-derive with `npm run
  ebay:verify`. This category also only requires two aspects (`Brand`,
  `MPN`), both auto-filled by `buildEbayAspects()` - see the "Known gaps"
  aspects note below for why this still isn't a full fix for arbitrary
  real inventory.
- **Images must be publicly-fetchable HTTPS URLs**, not `data:`/base64 -
  eBay's servers fetch image URLs themselves. See `app/api/images/[id]` and
  `toPublicImageUrl()` in `lib/ebay/utils.ts`.
- **`handleApiError` (the axios response interceptor in `lib/ebay/client.ts`)
  converts every failed request's `AxiosError` into a plain `Error` before
  it reaches any calling method's `catch` block** - if you need to inspect
  the original HTTP status/response body in a catch block (e.g. to special-
  case a specific errorId), you're catching a plain `Error` by that point,
  not an `AxiosError`. Match on the formatted message text (which includes
  `(${errorId})`) instead - see `getOffersForSku`'s 25713 handling for the
  pattern.

## Known gaps (see `EBAY_SETUP.md` §7 "Going to production" for detail)

- No per-product category selection - every listing uses the single
  hardcoded `EBAY_DEFAULT_CATEGORY_ID`. `aspects` are auto-filled with just
  `Brand` (from the product form, default `"Unbranded"`) and `MPN`
  (always `"Does Not Apply"`) via `buildEbayAspects()` in
  `lib/ebay/utils.ts` - enough for the current default category, but most
  *other* real categories require several more category-specific aspects
  (Size, Color, Style, ...) that aren't collected yet.
- The order/sale webhook (`app/api/webhooks/ebay/route.ts`) doesn't match
  eBay's real Notification API envelope and nothing subscribes this app to
  any topic - it's currently unreachable dead code.
- Marketplace Account Deletion's POST handler doesn't verify eBay's
  `x-ebay-signature` yet (see comment in that route).

## Automated verification

```bash
npm run ebay:verify
```

Runs `scripts/verify-ebay-integration.ts` against whichever environment
`EBAY_SANDBOX` points at, using a real connected user's stored credentials.
Read-only - creates nothing. Checks: env config sanity, token refresh,
Identity API, business policies exist, inventory location exists, the
configured default category's condition-support policy, and a summary of
local listing statuses. Extend this script (rather than re-deriving checks
by hand) whenever a new "hard-won" behavior above is discovered.
