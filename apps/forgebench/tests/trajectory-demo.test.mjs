import test from "node:test";
import assert from "node:assert/strict";
import { generateLocalTrajectory } from "../src/trajectory-demo.mjs";

test("generated agent-like trajectory includes observed failures and success with evidence hashes", () => {
  const trajectory = generateLocalTrajectory();
  assert.equal(trajectory.evaluation.verdict, "PASS");
  assert.equal(trajectory.externally_verified, false);
  assert.equal(trajectory.content_sha256.length, 64);
  assert.ok(trajectory.events.some(event => event.kind === "failed_attempt"));
  assert.ok(trajectory.events.some(event => event.kind === "test_result"));
  assert.ok(trajectory.events.some(event => event.summary.includes("No official benchmark")));
});
