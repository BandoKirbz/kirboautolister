# Integration catalog

Only these are live or in-progress. Do not treat Stripe columns, unused webhooks, or `coming_soon` platforms as working integrations.

| Integration | Status | Code | Verify coverage | Official docs |
|---|---|---|---|---|
| PostgreSQL / Prisma | Live | `lib/prisma.ts`, `prisma/schema.prisma` | `integrations:verify` → Postgres | Prisma via `DATABASE_URL` (local) or `DATABASE_HOST` + IAM (Aurora) |
| NextAuth secrets | Live | `app/auth.ts` | `NEXTAUTH_URL` / `NEXTAUTH_SECRET` present | Auth.js |
| eBay token encryption | Live | `lib/crypto.ts` | AES-256-GCM round-trip | — |
| eBay OAuth + Sell APIs | Live | `lib/ebay/*`, `app/api/platforms/ebay/*`, `app/api/ebay/callback` | `ebay:verify` / eBay section of `integrations:verify` | `docs/ebay-api-reference.md` |
| AWS S3 image uploads | Live (needs AWS_* / IAM) | `lib/s3.ts`, `app/api/upload/route.ts`, add-product form | S3 config + HeadBucket + presign | AWS S3 presigned PUT |
| Image byte fallback | Live for stored `data:` URLs | `app/api/images/[id]/route.ts` | Not a vendor API | eBay requires public HTTPS image URLs |
| Grailed | Blocked — no public seller API | `lib/grailed/listing.ts`, `app/api/platforms/grailed/route.ts` | Catalog honesty + condition map; publish is skipped | Grailed does not publish a seller API |
| Depop | Built — waiting on partner API key | `lib/depop/*`, `app/api/platforms/depop/*`, Depop connection card | Condition map + optional `DEPOP_VERIFY_API_KEY` GET /products | https://partnerapi.depop.com/api-docs/ · `docs/depop-api-reference.md` |
| Etsy | Built — OAuth proven; Connect persist blocked until test account finishes seller shop (payments) | `lib/etsy/*`, `app/api/platforms/etsy/*`, `app/api/etsy/callback` | when_made map + taxonomy with app key; full Connect needs `shop_id` | https://developer.etsy.com · `docs/etsy-api-reference.md` |
| OfferUp | Blocked — no public seller API | `app/api/platforms/offerup/route.ts` | Catalog honesty | Business Portal CSV only |
| eBay order webhook | Dead code (wrong envelope, no subscription) | `app/api/webhooks/ebay/route.ts` | Not probed | Notification API |
| eBay account deletion | Challenge GET implemented; POST does not verify `x-ebay-signature` | `app/api/webhooks/ebay/account-deletion/route.ts` | Env only if set | https://developer.ebay.com/marketplace-account-deletion |

## eBay endpoints the app actually calls

See the table in `docs/ebay-api-reference.md`. Verify script extras (not used in the listing happy-path yet):

- Application token (`client_credentials`) — proves App ID / Cert ID without a seller login
- `GET /commerce/taxonomy/v1/get_default_category_tree_id` — app-token smoke test
- `GET /sell/metadata/v1/marketplace/{id}/get_item_condition_policies` — default category still displays Condition

## Known customer-impacting states

- **Disconnected seller + ACTIVE `ebaylisting` rows**: local listings stay "live" but cannot be revised. Reconnect at `/dashboard/platforms`.
- **Category `50979`**: wholesale fallback; eBay drops Condition. Default is now `175687`. `mapConditionToEbay` collapses used grades to `USED_EXCELLENT` for that category.
- **S3 env missing**: add-product uploads call `/api/upload` and will 500 until AWS_* is set.
- **`redirect_uri` is the RuName**, not the HTTPS callback URL.
- **Refresh token grant requires `scopes`**.

## When adding a new third party

1. Add a row here and a live, read-only check in `scripts/verify-integrations.ts`.
2. Keep `PLATFORM_CATALOG.availability` as `coming_soon` until the check can pass.
3. Add an official-docs URL and a "Last verified" cell to a reference doc (follow `docs/ebay-api-reference.md`).
