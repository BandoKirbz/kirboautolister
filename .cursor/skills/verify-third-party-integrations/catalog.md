# Integration catalog

Only these are live or in-progress. Do not treat Stripe columns, unused webhooks, or `coming_soon` platforms as working integrations.

| Integration | Status | Code | Verify coverage | Official docs |
|---|---|---|---|---|
| PostgreSQL / Prisma | Live | `lib/prisma.ts`, `prisma/schema.prisma` | `integrations:verify` → Postgres | Prisma + local `DATABASE_URL` |
| NextAuth secrets | Live | `app/auth.ts` | `NEXTAUTH_URL` / `NEXTAUTH_SECRET` present | Auth.js |
| eBay token encryption | Live | `lib/crypto.ts` | AES-256-GCM round-trip | — |
| eBay OAuth + Sell APIs | Live | `lib/ebay/*`, `app/api/platforms/ebay/*`, `app/api/ebay/callback` | `ebay:verify` / eBay section of `integrations:verify` | `docs/ebay-api-reference.md` |
| AWS S3 image uploads | In progress (needs AWS_* env) | `lib/s3.ts`, `app/api/upload/route.ts`, add-product form | S3 config + HeadBucket + presign | AWS S3 presigned PUT |
| Image byte fallback | Live for stored `data:` URLs | `app/api/images/[id]/route.ts` | Not a vendor API | eBay requires public HTTPS image URLs |
| Grailed | Stub | `app/api/platforms/grailed/route.ts` | Catalog honesty | — |
| Depop | Stub | `app/api/platforms/depop/route.ts` | Catalog honesty | — |
| OfferUp | Stub | `app/api/platforms/offerup/route.ts` | Catalog honesty | — |
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
