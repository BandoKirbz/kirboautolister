/**
 * eBay integration health check.
 *
 * Run with: npm run ebay:verify
 * (also invoked by npm run integrations:verify)
 *
 * Mix of app-token (no seller login required) and user-token checks.
 * User-token checks are skipped — not crashed — when nobody is connected,
 * so App ID / Cert ID drift can still be caught. Read-only: creates nothing.
 */
import { loadEnvConfig } from "@next/env";

import { exitFromResults, printResults } from "./lib/health-check";
import { runEbayHealthChecks } from "./lib/verify-ebay";

loadEnvConfig(process.cwd());

async function main() {
  const results = await runEbayHealthChecks();
  printResults("eBay integration health check", results);
  exitFromResults(results);
}

main().catch((err) => {
  console.error("Health check crashed:", err);
  process.exit(1);
});
