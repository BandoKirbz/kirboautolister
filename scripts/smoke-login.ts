/**
 * Preflight: prove local test credentials can obtain a NextAuth session.
 * Does not print the password. Exit 0 on success.
 *
 *   npm run smoke:login
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASE = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

type Creds = { identifier: string; password: string };

function loadCreds(): Creds {
  const jsonPath = resolve(process.cwd(), "test-credentials.local.json");
  if (existsSync(jsonPath)) {
    const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      kirbo?: { identifier?: string; email?: string; password?: string };
    };
    const identifier = raw.kirbo?.identifier || raw.kirbo?.email;
    const password = raw.kirbo?.password;
    if (identifier && password) return { identifier, password };
  }

  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, "utf8");
    const get = (k: string) => {
      const m = text.match(new RegExp(`^${k}=["']?([^"'\\n]*)`, "m"));
      return m?.[1]?.trim() || "";
    };
    const identifier = get("TEST_USER_IDENTIFIER");
    const password = get("TEST_USER_PASSWORD");
    if (identifier && password) return { identifier, password };
  }

  throw new Error(
    "Missing test creds. Set test-credentials.local.json (kirbo.identifier + kirbo.password) or TEST_USER_* in .env.local."
  );
}

function cookieHeader(jar: string[]): string {
  return jar.join("; ");
}

function storeSetCookie(jar: string[], res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean) as string[];
  for (const raw of list) {
    const first = raw.split(";")[0];
    if (!first.includes("=")) continue;
    const name = first.split("=")[0];
    jar = jar.filter((c) => !c.startsWith(name + "="));
    jar.push(first);
  }
  return jar;
}

async function main() {
  const creds = loadCreds();
  let jar: string[] = [];

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: jar.length ? { cookie: cookieHeader(jar) } : undefined,
  });
  if (!csrfRes.ok) throw new Error(`csrf failed: ${csrfRes.status}`);
  jar = storeSetCookie(jar, csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) throw new Error("csrf response missing csrfToken");

  const body = new URLSearchParams({
    identifier: creds.identifier,
    password: creds.password,
    csrfToken,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body,
    redirect: "manual",
  });
  jar = storeSetCookie(jar, loginRes);

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader(jar) },
  });
  if (!sessionRes.ok) throw new Error(`session failed: ${sessionRes.status}`);
  const session = (await sessionRes.json()) as {
    user?: { id?: string; username?: string; email?: string };
  };

  if (!session.user?.id) {
    throw new Error(
      `Login did not establish a session (HTTP ${loginRes.status}). Check password hash / NEXTAUTH_SECRET.`
    );
  }

  console.log(
    `smoke:login OK — base=${BASE} user=${session.user.username || session.user.email || session.user.id}`
  );
}

main().catch((err) => {
  console.error(`smoke:login FAIL — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
