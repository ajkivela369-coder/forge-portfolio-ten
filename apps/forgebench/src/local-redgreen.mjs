/** Proof that authored public tests fail before a fix and pass afterward.
 * WARNING: subprocesses here are deliberately trusted local fixtures, NOT a sandbox.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(root, "fixtures", "retry-after");
const sha = filename => createHash("sha256").update(readFileSync(filename)).digest("hex");
const expected = { baseline: "FAIL", reference: "PASS", regression: "FAIL" };

export function evaluateTrustedFixtures({ persist = false } = {}) {
  const suite = join(fixtureRoot, "acceptance.cases.mjs");
  const evaluations = [];
  // Node test workers set NODE_TEST_CONTEXT. Do not leak it to nested test-runner processes.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  for (const variant of Object.keys(expected)) {
    const candidate = join(fixtureRoot, variant + ".mjs");
    const child = spawnSync(process.execPath, ["--test", "--test-reporter=tap", suite], {
      cwd: root, timeout: 10_000, maxBuffer: 500_000, encoding: "utf8",
      windowsHide: true, env: { ...childEnv, FORGEBENCH_TRUSTED_VARIANT: variant },
    });
    const output = child.stdout || "";
    const count = name => Number(output.match(new RegExp("^# " + name + " (\\d+)$", "m"))?.[1] ?? 0);
    const tests = count("tests"), passed = count("pass"), failed = count("fail");
    const verdict = !child.error && child.status === 0 && tests > 0 && failed === 0 ? "PASS" : "FAIL";
    evaluations.push({
      variant, expected: expected[variant], verdict, expected_outcome_met: verdict === expected[variant],
      tests, passed, failed, exit_code: child.status, timed_out: child.error?.code === "ETIMEDOUT",
      candidate_sha256: sha(candidate),
    });
  }
  const result = {
    schema: "forge-local-red-green-v1", fixture: "retry-after-sliding-window",
    source: "authored_trusted_fixture_only", official_external_benchmark: false,
    safely_sandboxed_untrusted_code: false,
    acceptance_suite_sha256: sha(suite), node: process.version, evaluations,
    verdict: evaluations.every(x => x.expected_outcome_met && x.tests === 6) ? "PASS" : "FAIL",
  };
  if (persist) {
    mkdirSync(join(root, "reports"), { recursive: true });
    writeFileSync(join(root, "reports", "red-green.json"), JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  const result = evaluateTrustedFixtures({ persist: true });
  console.log(JSON.stringify(result, null, 2));
  if (result.verdict !== "PASS") process.exitCode = 1;
}
