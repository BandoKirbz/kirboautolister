---
name: browser-smoke-test
description: >-
  Signs into KirboAutoLister with local test credentials and verifies UI/API
  changes in the Cursor browser (Playwright). Use after auth, dashboard,
  platforms, listing, or login/middleware changes; when the user asks to test
  in the browser; or instead of asking the user to click through Chrome.
---

# Browser smoke test (agent-driven)

Do **not** ask the user to manually exercise flows you can open yourself.
After you change app behavior, smoke-test it in the Cursor browser before declaring done.

## Credentials (never print secrets)

Load from (first that exists):

1. `test-credentials.local.json` → `kirbo.identifier` + `kirbo.password`
2. `.env.local` → `TEST_USER_IDENTIFIER` + `TEST_USER_PASSWORD`

Do not echo passwords, session cookies, or tokens into chat. Say “signed in as testuser” only.

Preflight (optional, no browser):

```bash
npm run smoke:login
```

## Ensure the app is up

- App: `http://localhost:3000` (`npm run dev` / `npx next dev --turbopack`)
- If login returns 500 or blank pages, check the Next terminal (common past issues: middleware cookie name, Turbopack + `pg` via auth import)

HTTPS tunnel (`npm run tunnel`) only when testing **eBay/Etsy OAuth callbacks**. Quick tunnels die often; on DNS failure, restart tunnel, update `PUBLIC_APP_URL` + `ETSY_REDIRECT_URI` (and portal callback), restart Next.

## Browser login recipe

Use `cursor-ide-browser`: navigate → lock → interact → unlock when finished.

1. `browser_navigate` → `http://localhost:3000/login`
2. Fill identifier + password from the credentials file
3. Submit Sign in
4. Confirm you land on `/dashboard` (not bounced back to `/login`)

If login “succeeds” then returns to `/login`, middleware is not reading the session cookie. Auth sets `next-auth.session-token`; `getToken` in `middleware.ts` **must** pass `cookieName: "next-auth.session-token"`.

## What to verify (pick what you changed)

| Change area | Smoke path |
|---|---|
| Auth / middleware / login | Login → dashboard; refresh still authenticated |
| Platforms UI | `/dashboard/platforms` — connection cards render; Connect starts OAuth (stop before external approve unless user is present) |
| Product / listing forms | Open add-product or edit; submit if safe; check network/UI errors |
| API-only | Prefer `curl` + session from `smoke:login`, or hit the page that calls the API |

Prefer **localhost** for day-to-day UI. Use the tunnel URL only for callback hops.

## Guardrails

- Do not complete third-party OAuth (eBay/Etsy) without the user unless they asked and are available to approve in-browser.
- Do not publish live/production listings unless asked; sandbox/draft is fine when that was the change.
- Do not commit `test-credentials.local.json`, `.env.local`, or cookies.
- Keep the user in the loop only for secrets, paid actions, or external portal clicks you cannot do.

## Done criteria

Report briefly:

- Signed in: yes/no
- Paths checked
- Pass / fail + one-line cause if fail
- Fix applied (if any) and re-tested
