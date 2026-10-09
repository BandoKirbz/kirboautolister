# Etsy Open API v3 reference

Kirbo’s third marketplace target (after eBay live, Depop pending partner access).

Official docs:

- Auth: <https://developer.etsy.com/documentation/essentials/authentication>
- Listings: <https://developer.etsy.com/documentation/tutorials/listings>
- Apps console: <https://www.etsy.com/developers/your-apps>

## App setup (you do this once)

1. Create an app at Etsy Developers → Your Apps.
2. Copy **keystring** + **shared secret** into `.env.local`:
   - `ETSY_API_KEYSTRING`
   - `ETSY_SHARED_SECRET`
3. Register a **Callback URL** that is HTTPS and matches `ETSY_REDIRECT_URI`  
   (local: Cloudflare tunnel → `https://<tunnel>/api/etsy/callback`).
4. Request scopes at least: `listings_r listings_w shops_r`.

## Auth model

Every API call needs:

```http
x-api-key: <keystring>:<shared_secret>
Authorization: Bearer <oauth_access_token>   # for private/write endpoints
```

OAuth is Authorization Code + PKCE:

1. Browser → `https://www.etsy.com/oauth/connect?...`
2. Callback → `/api/etsy/callback?code=...&state=...`
3. Server → `POST https://api.etsy.com/v3/public/oauth/token`

Access token ≈ 1 hour. Refresh token ≈ 90 days (`grant_type=refresh_token`).

## Endpoints Kirbo uses

| Purpose | Method + path |
|---|---|
| Exchange / refresh token | `POST /v3/public/oauth/token` |
| Whoami + shop | `GET /v3/application/users/me` |
| Create draft listing | `POST /v3/application/shops/{shop_id}/listings` |
| Upload listing image | `POST /v3/application/shops/{shop_id}/listings/{listing_id}/images` |
| Activate listing | `PATCH /v3/application/shops/{shop_id}/listings/{listing_id}` (`state=active`) |
| Seller taxonomy (verify) | `GET /v3/application/seller-taxonomy/nodes` |

## Draft listing required fields

- `quantity`, `title`, `description`, `price`
- `who_made` (`i_did` \| `someone_else` \| `collective`)
- `when_made` (era enum, e.g. `2010_2019`)
- `taxonomy_id` (leaf from seller taxonomy)
- `is_supply` (boolean)

Shipping profile / readiness state are **not** required to create a draft (Etsy 2026 change). They are still needed before a physical listing can go fully active in many shops — set via env when you have them:

- `ETSY_SHIPPING_PROFILE_ID`
- `ETSY_READINESS_STATE_ID`
- `ETSY_DEFAULT_TAXONOMY_ID`

## Condition / resale defaults

Kirbo products are typically resale, so drafts default to:

| Field | Default |
|---|---|
| `who_made` | `someone_else` |
| `when_made` | from condition / `ETSY_DEFAULT_WHEN_MADE` (fallback `2010_2019`) |
| `is_supply` | `false` |
| `type` | `physical` |

## Last verified

| Check | Date |
|---|---|
| Docs + OAuth/listing shape | 2026-10-09 |
| App keystring + shared secret | 2026-10-09 — Personal Access app approved |
| OAuth authorize + token exchange (PKCE) | 2026-10-09 — works via tunnel callback |
| `GET /users/me` + Connect persist | Blocked — test account has no seller `shop_id` yet |
| Draft listing publish | Not yet — needs shop + Connect |

## Next steps (parked)

Etsy’s `getMe` returns **404 “could not find a shop”** until the OAuth user finishes **seller shop onboarding** (shop name, payments, etc.). Socials/payments cannot be skipped for a full Connect proof — listing endpoints all need `shop_id`.

When ready:

1. Finish shop open for the test seller (`vlhasnerm@yahoo.com` / user_id `478928103`) at [Shop Manager onboarding](https://www.etsy.com/your/shops/me/onboarding/).
2. Re-run Platforms → **Connect Etsy** (tunnel + `ETSY_REDIRECT_URI` must match).
3. Smoke-publish one draft via add-product or `POST /api/platforms/etsy/listings`.

Until then, treat Etsy code as built and OAuth-proven; live Connect + publish is the remaining gate.
