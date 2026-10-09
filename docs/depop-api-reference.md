# Depop Selling API reference

Kirbo’s second marketplace target after eBay.

Official docs: <https://partnerapi.depop.com/api-docs/>

## Access (blocked until Depop approves you)

The Selling API is **private**. Self-serve signup is not available.

1. Email `business@depop.com` and ask for partner / Selling API access for a cross-listing app.
2. Prefer **OAuth 2.0** long-term (multi-seller). **API keys** work for a single shop and are enough to finish the first integration.
3. Staging and production use different hosts and different keys.

| Environment | Base URL |
|---|---|
| Staging | `https://partnerapi-staging.depop.com` |
| Production | `https://partnerapi.depop.com` |

Auth header on every call:

```http
Authorization: Bearer <api-key-or-access-token>
```

## Endpoints Kirbo uses

| Purpose | Method + path | When |
|---|---|---|
| Smoke / list inventory | `GET /api/v1/products/` | Connect + `integrations:verify` |
| Get one listing | `GET /api/v1/products/by-sku/{sku}/` | Sync / debug |
| Create or update listing | `PUT /api/v1/products/by-sku/{sku}/` | Publish from a Kirbo product |

OpenAPI (for Postman): <https://partnerapi.depop.com/api-docs/openapi.yaml>

## Condition map (Kirbo → Depop)

| Kirbo `product.condition` | Depop `condition` |
|---|---|
| `new-with-tags` | `brand_new` |
| `new-without-tags` | `used_like_new` |
| `very-good` | `used_excellent` |
| `good` | `used_good` |
| `fair` | `used_fair` |

## Listing payload notes

Required-ish fields from Depop’s “first listing” guide:

- `description`, `price_amount`, `price_currency`
- `quantity`, `pictures[].url` (public HTTPS — our S3 URLs)
- `department`, `product_type`, `size_set_id`, `size_id`
- `condition`, `brand`
- `address.country_code` (+ `state` when required for the country)
- Optional shipping: `national_shipping_cost`, `international_shipping_cost`
- Optional offers: `auto_send_offer_price`, `auto_negotiate_offer_price`

Taxonomy (`department` / `product_type` / sizes) is Depop-specific. Until the UI collects it per product, connection settings / env defaults are used (see `.env.example`).

## What is not done yet

- Live staging/production call (awaiting Depop partner API key)
- OAuth PKCE connect for multi-seller (needs Depop-issued `client_id` / `client_secret`)
- Per-product Depop taxonomy picker
- Order webhooks
- Un-selecting Depop on a product does not delete the Depop listing yet (create, edit, and `POST /api/platforms/depop/listings` all re-push via PUT by SKU)

## Last verified

| Check | Date |
|---|---|
| Docs + OpenAPI existence | 2026-10-04 |
| Live staging call with a partner key | Not yet — awaiting Depop access |
