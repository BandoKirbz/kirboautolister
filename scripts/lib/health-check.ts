export type CheckStatus = "pass" | "fail" | "skip";

export type CheckResult = {
  name: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
};

export async function runCheck(
  results: CheckResult[],
  name: string,
  fn: () => Promise<string>
): Promise<boolean> {
  try {
    const detail = await fn();
    results.push({ name, status: "pass", detail });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fix = err instanceof CheckFailure ? err.fix : undefined;
    results.push({ name, status: "fail", detail: message, fix });
    return false;
  }
}

export function skipCheck(results: CheckResult[], name: string, detail: string, fix?: string) {
  results.push({ name, status: "skip", detail, fix });
}

export class CheckFailure extends Error {
  fix?: string;
  constructor(message: string, fix?: string) {
    super(message);
    this.name = "CheckFailure";
    this.fix = fix;
  }
}

const ICON: Record<CheckStatus, string> = {
  pass: "✅",
  fail: "❌",
  skip: "⏭️",
};

export function printResults(title: string, results: CheckResult[]) {
  console.log(`\n${title}\n`);
  for (const result of results) {
    console.log(`${ICON[result.status]} ${result.name}\n   ${result.detail}`);
    if (result.fix) {
      console.log(`   → Fix: ${result.fix}`);
    }
  }
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (${results.length} total).\n`);
}

export function failedChecks(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => r.status === "fail");
}

export function exitFromResults(results: CheckResult[]) {
  process.exit(failedChecks(results).length > 0 ? 1 : 0);
}
