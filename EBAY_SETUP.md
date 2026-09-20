# eBay Integration Setup

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

# eBay Sandbox OAuth
EBAY_CLIENT_ID="<your sandbox App ID>"
EBAY_CLIENT_SECRET="<your sandbox Cert ID>"
EBAY_RUNAME="<your sandbox RuName>"
EBAY_SANDBOX="true"
EBAY_API_URL="https://api.sandbox.ebay.com"
EBAY_REDIRECT_URI="http://localhost:3000/api/ebay/callback"
EBAY_MARKETPLACE_ID="EBAY_US"

# Used as a fallback eBay category id for listings created without one
# picked in the UI yet. Replace with a real leaf category id.
EBAY_DEFAULT_CATEGORY_ID="171485"
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
