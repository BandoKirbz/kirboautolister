# eBay Integration Setup

> See also: [`docs/ebay-api-reference.md`](docs/ebay-api-reference.md) - a
> living map of every eBay endpoint this app calls to its official docs
> page, plus every non-obvious behavior we've had to discover by testing
> (wrong HTTP method, missing required header, silently-dropped fields,
> etc.). Check there first when something eBay-related breaks, and run
> `npm run ebay:verify` for a live health check against Sandbox/Production.

## 1. Rotate your eBay sandbox credentials

Older versions of this repo accidentally committed real sandbox credentials
(App ID, Cert ID, RuName) and other secrets to git history. That history has
been scrubbed, but **you must still rotate these credentials** in your eBay
Developer Account, since they were exposed on a public repo:

1. Go to <https://developer.ebay.com/my/keys>
2. Regenerate/replace the Sandbox Cert ID (client secret) for your app.
3. If you're not sure whether the old RuName is still safe to use, create a
   new RuName under **Sandbox > Application Keys > RuName** and update your
   redirect URI (see below).
4. Also rotate the local Postgres password and `NEXTAUTH_SECRET` if you had
   reused either of those values anywhere else.

## 2. Required environment variables

Create a `.env.local` file in the project root (never commit this file):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kirbo_autolister"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

# Encrypts eBay OAuth tokens at rest - generate with: openssl rand -base64 32
EBAY_TOKEN_ENCRYPTION_KEY="<generate with: openssl rand -base64 32>"

# eBay Sandbox OAuth
EBAY_CLIENT_ID="<your sandbox App ID>"
EBAY_CLIENT_SECRET="<your sandbox Cert ID>"
EBAY_RUNAME="<your sandbox RuName>"
EBAY_SANDBOX="true"
EBAY_API_URL="https://api.sandbox.ebay.com"
EBAY_REDIRECT_URI="http://localhost:3000/api/ebay/callback"
EBAY_MARKETPLACE_ID="EBAY_US"

# TEMPORARY fallback eBay category for listings that don't have their own
# category picked in the UI yet - see section 7 (going to production).
# 175687 = "Cell Phone Accessories > Cases, Covers & Skins" - a real leaf
# category that supports/displays `condition` and only requires Brand +
# MPN as item specifics ("aspects"), both auto-filled by
# lib/ebay/utils.ts's buildEbayAspects(). Most other real categories
# require several more category-specific aspects.
EBAY_DEFAULT_CATEGORY_ID="175687"
```

`prisma/schema.prisma` also reads `DATABASE_URL` from a plain `.env` file
(the Prisma CLI does not read `.env.local`) - keep a copy of just that one
line in `.env` too.

## 3. eBay Developer Account setup

1. In your eBay Developer Account, open your Sandbox application keys.
2. Under **RuName (Redirect URL Name)** settings, set the redirect URI to
   exactly: `http://localhost:3000/api/ebay/callback`
   (must match `EBAY_REDIRECT_URI` above).
3. This app requests the following scopes (see `lib/ebay/config.ts`):
   - `https://api.ebay.com/oauth/api_scope`
   - `https://api.ebay.com/oauth/api_scope/sell.inventory`
   - `https://api.ebay.com/oauth/api_scope/sell.account`
   - `https://api.ebay.com/oauth/api_scope/sell.fulfillment`
   - `https://api.ebay.com/oauth/api_scope/sell.marketing`
   - `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`

## 4. One-time sandbox seller account setup (required to publish listings)

eBay's Sell APIs require a seller to have **Business Policies** and at
least one **inventory location** before any offer can be published. These
can't be created purely from this app - they're one-time setup steps on
your (sandbox) seller account:

1. Log into your sandbox seller account and opt in to Business Policies
   (Account Settings > Business Policies, or via the Account API).
2. Create at least one Payment Policy, Fulfillment (shipping) Policy, and
   Return Policy for the `EBAY_US` marketplace.
3. This app will auto-create a default inventory location on first publish
   if none exists (see `EbayClient.ensureMerchantLocation`), using a
   generic US address. Override it with these optional env vars if needed:
   `EBAY_MERCHANT_LOCATION_KEY`, `EBAY_MERCHANT_LOCATION_COUNTRY`,
   `EBAY_MERCHANT_LOCATION_POSTAL_CODE`, `EBAY_MERCHANT_LOCATION_STATE`,
   `EBAY_MERCHANT_LOCATION_CITY`.

If you skip step 1/2, publishing will fail with a clear error message
telling you to set up business policies, rather than a cryptic API error.

## 5. How the OAuth flow works

1. User clicks "Connect to eBay" -> frontend calls
   `GET /api/platforms/ebay/auth`, which returns an eBay authorization URL.
   The current user's id is signed into the URL's `state` parameter
   (`createEbayOAuthState` in `lib/ebay/utils.ts`).
2. User is redirected to eBay, logs in, and authorizes the app.
3. eBay redirects back to `GET /api/ebay/callback` with a `code` and the
   same `state`.
4. The callback verifies the signature on `state` to recover the user id
   (`verifyEbayOAuthState`) - it does **not** rely on the browser's session
   cookie surviving the round trip, and it does **not** fall back to
   guessing a user. If `state` is missing, expired, or tampered with, the
   flow is rejected.
5. The callback exchanges the code for tokens and stores them, then
   redirects to `/dashboard?platform=ebay&status=connected`.

## 6. Testing

1. Set all environment variables above.
2. `npm install --legacy-peer-deps`
3. `npx prisma db push` (creates tables in your local Postgres database)
4. `npm run dev`
5. Register/log in, go to **Dashboard > Platforms**, click **Connect to
   eBay**, and complete the OAuth flow on eBay's sandbox login page.
6. Once connected, creating a product with "eBay" selected (not saved as a
   draft) will publish it live to your eBay sandbox automatically.

## 7. Going to production (eBay production, not sandbox)

Sandbox and production are **completely separate eBay apps** with their own
App ID / Cert ID / RuName - you cannot "promote" sandbox credentials.

1. **Get production keys.** In your eBay Developer Account, request/create
   a Production keyset. Note that some OAuth scopes (e.g.
   `sell.finances`, most `commerce.identity.*` sub-scopes) require an
   additional signed agreement with eBay before they work in production,
   even if they work in sandbox - check the scopes your production
   keyset is actually approved for and update `EBAY_SCOPES` to match, or
   OAuth will fail with a scope error.
2. **Flip the environment flags** in your production `.env`:
   `EBAY_SANDBOX="false"`, `EBAY_API_URL="https://api.ebay.com"`,
   `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`/`EBAY_RUNAME` set to the
   production keyset's values, `EBAY_REDIRECT_URI` set to your real
   production HTTPS domain + `/api/ebay/callback` (must match the
   production RuName's Accept URL exactly).
3. **Set `EBAY_TOKEN_ENCRYPTION_KEY`** (see section 2) - required in every
   environment now, not just production, but double check it's set
   before go-live since it's what keeps stored OAuth tokens encrypted at
   rest.
4. **Implement the Marketplace Account Deletion notification endpoint.**
   eBay will not approve production API access without this. It's
   already implemented at `app/api/webhooks/ebay/account-deletion` - you
   just need to configure it:
   - Generate a verification token (32-80 chars) and set
     `EBAY_VERIFICATION_TOKEN`.
   - Set `EBAY_NOTIFICATION_ENDPOINT_URL` to the exact HTTPS URL this
     route is deployed at (no query string).
   - In the Developer Portal's "Alerts and Notifications" tab, enter that
     same URL and token - eBay immediately sends a verification GET
     request; this route already handles it.
   - Before fully relying on it, add signature verification of eBay's
     `x-ebay-signature` header (fetch their public key by `kid`) - see the
     comment at the top of that route for details. Without it, the POST
     handler still works, it just trusts the payload's shape rather than
     cryptographically verifying it came from eBay.
5. **Per-product eBay category + item specifics ("aspects").** This is
   still the biggest functional gap for production. Today every listing
   uses a single hardcoded `EBAY_DEFAULT_CATEGORY_ID` (`175687`, "Cell
   Phone Accessories > Cases, Covers & Skins") and only sends the two
   aspects that category requires - `Brand` (from the product form) and
   `MPN` (always `"Does Not Apply"`), via `buildEbayAspects()` in
   `lib/ebay/utils.ts`. That's enough to get a real, condition-displaying
   listing live for *any* product in sandbox, but it's the wrong category
   for real inventory, and almost every other real category (electronics,
   clothing brands/sizes, etc.) requires its own different set of aspects
   (Size, Color, Style, ...) and will reject the listing without them -
   e.g. the "invalid condition id" error we hit while testing category
   `171485` ("Tablets & eBook Readers"). To fix properly: let users pick
   (or auto-suggest via eBay's Taxonomy API `getCategorySuggestions`) a
   real category per product, fetch that category's required aspects via
   `getItemAspectsForCategory`, collect them in the product form, and pass
   them through as `product.aspects` in
   `EbayService.createListing`/`updateListing` instead of the current
   fixed `buildEbayAspects()` call.
6. **Business policies & merchant location are auto-created with
   placeholder values.** `EbayClient.getDefaultBusinessPolicies` creates a
   default $5 flat-rate USPS Priority shipping policy and 30-day
   money-back returns if none exist, and `ensureMerchantLocation` defaults
   to a fake San Jose, CA address if `EBAY_MERCHANT_LOCATION_*` env vars
   aren't set. This is convenient for sandbox testing but means a real
   seller's first production listing could go live with policies/address
   they never actually reviewed. Before production, either have real
   sellers set these up themselves on eBay first (recommended), or surface
   them as editable settings in the app instead of silent auto-creation.
7. **The order/sale webhook (`app/api/webhooks/ebay/route.ts`) is not
   wired up to real eBay traffic** - see the comment at the top of that
   file. Nothing currently syncs order/sale status back from eBay; that
   needs to be built (either via the Notification API or by polling the
   Fulfillment API) before "eBay is the source of truth" for sold items.

## Troubleshooting

- **"Your eBay authorization link expired or was invalid"**: the `state`
  parameter didn't verify. Links expire after 10 minutes - restart the
  connect flow from the Platforms page rather than reusing an old link.
- **"No eBay business policies found for this account"**: see step 4 above.
- **"Input request parameters are invalid" from eBay**: double check
  `EBAY_RUNAME` matches exactly what's configured in your Developer Account,
  and that the RuName's redirect URI matches `EBAY_REDIRECT_URI`.
- **401 on token exchange**: `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` don't
  match a live sandbox app, or the Cert ID was rotated and the old one is
  still in your `.env.local`.
