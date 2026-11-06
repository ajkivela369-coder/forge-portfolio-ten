import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTrustedFixtures } from "../src/local-redgreen.mjs";

test("trusted local red/green evaluation rejects starter and boundary regression", () => {
  const report = evaluateTrustedFixtures();
  assert.equal(report.verdict, "PASS");
  assert.equal(report.safely_sandboxed_untrusted_code, false);
  assert.equal(report.official_external_benchmark, false);
  assert.deepEqual(report.evaluations.map(x => x.verdict), ["FAIL", "PASS", "FAIL"]);
  assert.ok(report.evaluations[0].failed > 0);
  assert.equal(report.evaluations[1].passed, 6);
  assert.ok(report.evaluations[2].failed > 0);
  assert.equal(report.acceptance_suite_sha256.length, 64);
});
