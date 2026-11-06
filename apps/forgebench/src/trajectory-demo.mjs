/** Auditable local trajectory derived from actual trusted fixture test output. */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { evaluateTrustedFixtures } from "./local-redgreen.mjs";
import { makeTrajectory } from "./frameworks.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function generateLocalTrajectory({ persist = false } = {}) {
  const report = evaluateTrustedFixtures();
  if (report.verdict !== "PASS") throw new Error("Fixture verification failed; refuse to report completion");
  const [starter, fixed, regression] = report.evaluations;
  const record = makeTrajectory({
    taskId: "task-03-retry-after-regression",
    events: [
      { kind: "observation", summary: `Starter: ${starter.passed}/${starter.tests} tests passed; ${starter.failed} failed (fixture ${starter.candidate_sha256})` },
      { kind: "failed_attempt", summary: "Starting implementation does not handle retry-after correctly" },
      { kind: "action", summary: `Selected reviewed reference fixture ${fixed.candidate_sha256} for comparison; did not patch an external repository` },
      { kind: "test_result", summary: `Reference: ${fixed.passed}/${fixed.tests} passed, suite ${report.acceptance_suite_sha256}` },
      { kind: "failed_attempt", summary: `Introduced boundary-regression fixture: ${regression.failed} test(s) failed` },
      { kind: "final", summary: "Local fixture proof passes red/green/regression gate. No official benchmark execution, no untrusted code sandbox." },
    ],
    evaluation: { verdict: "PASS", source: "authored trusted local Node fixtures; public acceptance tests" },
  });
  if (persist) {
    const directory = join(root, "reports");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "trajectory-local.json"), JSON.stringify(record, null, 2) + "\n");
  }
  return record;
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  console.log(JSON.stringify(generateLocalTrajectory({ persist: true }), null, 2));
}
