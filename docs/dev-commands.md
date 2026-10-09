# Dev commands cheat sheet

Quick reference for local app, AWS, S3, Aurora, and pgAdmin.
Do not put access keys or IAM tokens in this file.

## App

```bash
npm run dev                 # Next.js → http://localhost:3000
npm run tunnel              # Cloudflare quick tunnel for eBay OAuth HTTPS callback
npm run typecheck
npm run lint
```

After changing `.env.local`, restart `npm run dev`.

eBay RuName Accept URL must match the current tunnel:

`https://<current-tunnel-host>/api/ebay/callback`

Quick tunnels change hostname every start.

## Integration checks

```bash
npm run ebay:verify
npm run integrations:verify
npm run smoke:login           # prove testuser session works (creds in test-credentials.local.json)
```

Agent browser QA after UI/auth changes: `.cursor/skills/browser-smoke-test/SKILL.md`

## Depop

Partner API is private — request access at `business@depop.com`.
Docs: `docs/depop-api-reference.md` · UI: `/dashboard/platforms`

```bash
# After Depop issues a staging key, optional verify smoke test:
# DEPOP_VERIFY_API_KEY=... DEPOP_VERIFY_ENVIRONMENT=staging npm run integrations:verify
```

Connect in the app: Platforms → Depop → paste API key (staging or production).
Publish: `POST /api/platforms/depop/listings` with `{ "productId": "..." }`.

## Etsy

Public Open API — create an app at https://www.etsy.com/developers/your-apps  
Docs: `docs/etsy-api-reference.md` · UI: `/dashboard/platforms`

```bash
# In .env.local:
# ETSY_API_KEYSTRING=...
# ETSY_SHARED_SECRET=...
# ETSY_REDIRECT_URI=https://<tunnel>/api/etsy/callback
# ETSY_DEFAULT_TAXONOMY_ID=<leaf id from seller taxonomy>
npm run integrations:verify   # taxonomy check runs when keys are set
```

Connect: Platforms → Etsy → OAuth.  
Publish: `POST /api/platforms/etsy/listings` with `{ "productId": "..." }`.

**Parked:** Connect needs a real seller shop (`getMe` → `shop_id`). Finish payments/onboarding for the test account, then reconnect — see Next steps in `docs/etsy-api-reference.md`.

## AWS CLI profiles

Two local identities:

| Profile | Purpose |
|---|---|
| `default` | S3 uploads (`kirbo-autolister-uploads` long-term key in `~/.aws/credentials`) |
| `kirbo-console` | Console/root session via `aws login` — Aurora IAM, RDS admin |

```bash
aws --version
aws sts get-caller-identity                          # default / S3 user
aws sts get-caller-identity --profile kirbo-console  # console session

# Browser login for Aurora / admin (≈12h session)
aws login --profile kirbo-console --region us-east-1
```

S3 does **not** need `aws login` while the default profile key still works.
Aurora IAM tokens need a valid `kirbo-console` session.

## S3

Bucket: `kirboawsbucket` · Region: `us-east-1`  
Prefix: `product-images/{userId}/{random}.{ext}`

```bash
# Who am I / can I see the bucket?
aws sts get-caller-identity
aws s3api head-bucket --bucket kirboawsbucket --region us-east-1

# List uploaded product images
aws s3 ls s3://kirboawsbucket/product-images/ --recursive --region us-east-1
```

App config in `.env.local`:

- Required: `AWS_REGION`, `AWS_BUCKET_NAME`
- Optional local keys: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`  
  If both are omitted, the SDK uses `~/.aws` (default profile) or an IAM role in production.

## Aurora (dev database)

Cluster endpoint:

`database-1.cluster-c2f6o6a6u8a8.us-east-1.rds.amazonaws.com`

| Field | Value |
|---|---|
| Port | `5432` |
| Database | `kirbo_autolister` |
| User | `postgres` |
| Schema | `kirbo407` |
| Auth | IAM only (Express) — no static password |
| SSL | Require |

App today uses **local** Postgres via `DATABASE_URL` unless `DATABASE_HOST` is set.
Aurora host for tools is in `.env.local` as `AURORA_HOST` / `AURORA_DB` / `AURORA_USER`.

### pgAdmin (kinit-style)

```bash
npm run db:token            # mint ~15 min IAM token → clipboard
```

Then in pgAdmin:

1. Host = `AURORA_HOST` value above  
2. Port `5432`  
3. Maintenance DB `kirbo_autolister`  
4. Username `postgres`  
5. Password = paste the **entire** token (it starts with the hostname — that is normal)  
6. SSL mode **Require**  
7. Browse schema **kirbo407**

Token TTL ≈ 15 minutes. When it expires, run `npm run db:token` again and paste.
If token minting fails with auth/PAM errors:

```bash
aws login --profile kirbo-console --region us-east-1
npm run db:token
```

Equivalent raw command (same as `db:token`):

```bash
aws rds generate-db-auth-token \
  --profile kirbo-console \
  --hostname database-1.cluster-c2f6o6a6u8a8.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --username postgres \
  --region us-east-1 | pbcopy
```

### Prisma against Aurora

```bash
npm run db:push             # prisma db push with a fresh IAM token
npm run db:studio           # Prisma Studio with IAM token
```

These use `DATABASE_HOST` when set; otherwise they follow `DATABASE_URL` (local).

### Local Postgres (fallback)

```bash
# still on this Mac
psql "postgresql://bandokirbz@localhost:5432/kirbo_autolister"
```

pgAdmin local: host `localhost`, port `5432`, db `kirbo_autolister`, user `bandokirbz`, empty password, schema `kirbo407`.

## Point the app at Aurora instead of localhost

In `.env.local` set:

```bash
DATABASE_HOST=database-1.cluster-c2f6o6a6u8a8.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=kirbo_autolister
DATABASE_USER=postgres
AWS_DATABASE_PROFILE=kirbo-console
AWS_REGION=us-east-1
```

When `DATABASE_HOST` is set, the app ignores `DATABASE_URL` and mints IAM tokens per connection.
Restart `npm run dev` after changing this.
Unset / comment `DATABASE_HOST` to go back to local Postgres.

## Useful paths

| What | Where |
|---|---|
| Env template | `.env.example` |
| Local secrets | `.env.local` (gitignored) |
| Prisma schema | `prisma/schema.prisma` |
| S3 helpers | `lib/s3.ts` |
| DB URL / IAM | `lib/database-url.ts`, `lib/prisma.ts` |
| Token helper | `scripts/db-token.ts` |
| eBay setup notes | `EBAY_SETUP.md`, `docs/ebay-api-reference.md` |
