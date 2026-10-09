---
name: verify-third-party-integrations
description: >-
  Verifies KirboAutoLister third-party integrations (eBay, AWS S3, Postgres,
  NextAuth secrets, platform catalog) still work after vendor API changes,
  diagnoses failures, and implements a working fix. Use when the user asks
  to verify integrations, check eBay/S3 drift, run ebay:verify or
  integrations:verify, something listing-related breaks unexpectedly, after
  upgrading ebay-oauth-nodejs-client or @aws-sdk/client-s3, or before a
  production/sandbox cutover.
---

# Verify third-party integrations

## Quick start

Copy this checklist:

```
Integration verify:
- [ ] Run npm run integrations:verify
- [ ] Read official vendor notes for any failure
- [ ] Implement the smallest working fix
- [ ] Re-run verify until new failures are gone or explicitly skipped
- [ ] Update docs last-verified dates + behavior notes
- [ ] Report using the template in report-template.md
```

1. Run `npm run integrations:verify` from the repo root (loads `.env` / `.env.local`).
2. For eBay-only, `npm run ebay:verify` is enough.
3. Read [catalog.md](catalog.md) so you do not invent platforms that are not live.
4. On failure: treat the script's `→ Fix:` line as the first working path. Confirm against code + official docs, then implement it.
5. Re-run the same command. Do not declare done while a check you changed still fails.
6. Write the report from [report-template.md](report-template.md).

Do not print secrets, tokens, or raw `.env` values.

## What "efficiently handle vendor changes" means here

eBay (and similar seller APIs) do not ship as an npm SDK we can bump. Drift is caught by:

- **Live probes** against the same endpoints the app calls (`scripts/lib/verify-ebay.ts`, `scripts/verify-integrations.ts`).
- **Hard-won notes** in `docs/ebay-api-reference.md` — read these before re-deriving a quirk.
- **Retries** in `EbayClient` for transient `ECONNRESET` / 429 / 5xx only, never for `errors[]` bodies.
- **This skill** when something breaks or when we want a scheduled/manual audit.

If a check fails, the customer-facing risk is "listings stop publishing / images fail / tokens die ~2h after connect". Prefer a fix that restores that path over a docs-only note.

## Decision tree

**Verify command failed?**

- `eBay application token` → keys or `EBAY_SANDBOX` mismatch. Compare Developer Portal keys; do not rotate unless the user asked.
- `Connected eBay seller` / `Orphaned live listings` → user must reconnect at `/dashboard/platforms`. You cannot mint a user token. Ask them to connect, then re-run.
- `Token refresh` / `scopes is required` → `EbayClient.refreshToken` must pass `scopes` as the third argument to `getAccessToken`.
- `Business policies` / `Inventory location` → follow `EBAY_SETUP.md` §4; `EbayClient` already opt-in + ensure-location on publish.
- `Condition support` empty `itemConditions` → change `EBAY_DEFAULT_CATEGORY_ID` (50979 is the known-bad wholesale fallback).
- `S3 configuration` / `HeadBucket` → AWS env missing or IAM/bucket wrong. Add-product uploads use presigned PUT (`lib/s3.ts`). Do not invent AWS keys.
- `Postgres` → `DATABASE_URL` for local, or `DATABASE_HOST` + `AWS_DATABASE_PROFILE` for Aurora IAM (see `.env.example`).
- `Platform catalog honesty` → keep grailed/depop/offerup `coming_soon` until a real client exists.

**Vendor changed an endpoint or required field?**

1. Open the official doc URL in the matching `docs/ebay-api-reference.md` row (eBay HTML docs often 403 automated fetchers — use a browser or curl with a normal User-Agent).
2. Also check release notes: https://developer.ebay.com/api-docs/static/versioning.html and the API's "What's New".
3. Patch the smallest call site (`lib/ebay/client.ts`, `lib/ebay/utils.ts`, `lib/ebay/config.ts`, `lib/s3.ts`).
4. Add a check to `scripts/lib/verify-ebay.ts` or `scripts/verify-integrations.ts` so the next run catches a regression.
5. Update the reference row's "Last verified" date and behavior notes.

## Guardrails

- Read-only against vendor APIs unless the user asked to publish/withdraw a listing.
- Do not mark grailed/depop/offerup as connected or available.
- Do not implement the unused order webhook (`app/api/webhooks/ebay/route.ts`) as part of a verify unless the user asked — it is known dead code.
- Do not commit `.env`, keys, or tokens.
- After a code fix that changes listing/upload UI, verify the affected dashboard flow in the browser.

## Additional resources

- Integration inventory: [catalog.md](catalog.md)
- Report template: [report-template.md](report-template.md)
- Endpoint map + quirks: `docs/ebay-api-reference.md`
- Sandbox setup: `EBAY_SETUP.md`
