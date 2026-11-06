import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSWEInstance, normalizeSWEPrediction, serializeSWEPredictions,
  normalizeHumanEval, normalizeMBPP, makeTrajectory,
} from "../src/frameworks.mjs";

const patch = "diff --git a/server.js b/server.js\n--- a/server.js\n+++ b/server.js\n@@ -1 +1 @@\n-old\n+new";
const prediction = { instance_id: "example__repo-123", model_name_or_path: "forge-local-demo", model_patch: patch };

test("SWE-bench instance adapter projects only issue metadata, not gold patch", () => {
  const result = normalizeSWEInstance({
    instance_id: "example__repo-123", repo: "example/repo", base_commit: "abc123",
    problem_statement: "Request idempotency is broken", patch: "SECRET_REFERENCE_SOLUTION",
    test_patch: "SECRET_HELDOUT_TEST",
  });
  assert.equal(result.official_evaluation_run, false);
  assert.equal(result.instance_id, "example__repo-123");
  assert.ok(!JSON.stringify(result).includes("SECRET_"));
});

test("SWE-bench predictions export current harness keys as JSONL", () => {
  const lines = serializeSWEPredictions([prediction, { ...prediction, instance_id: "example__repo-124" }])
    .trim().split("\n").map(JSON.parse);
  assert.deepEqual(Object.keys(lines[0]), ["instance_id", "model_name_or_path", "model_patch"]);
  assert.equal(lines[1].instance_id, "example__repo-124");
  assert.equal(normalizeSWEPrediction(prediction).model_patch, patch);
});

test("SWE-bench adapter rejects duplicate predictions", () => {
  assert.throws(() => serializeSWEPredictions([prediction, prediction]), /Duplicate/);
});

test("SWE-bench adapter rejects unsafe identifiers and missing fields", () => {
  assert.throws(() => normalizeSWEInstance({
    instance_id: "../outside", repo: "example/repo", base_commit: "abc", problem_statement: "Bug",
  }), /Unsafe/);
  assert.throws(() => normalizeSWEPrediction({ ...prediction, model_patch: "not a diff" }), /unified diff/);
  assert.throws(() => normalizeSWEPrediction({ ...prediction, model_name_or_path: "" }), /nonempty/);
  assert.throws(() => serializeSWEPredictions([]), /1-100000/);
});

test("HumanEval adapter keeps tests hashed, removes executable and reference code", () => {
  const result = normalizeHumanEval({
    task_id: "HumanEval/0", prompt: "def add(a,b):", entry_point: "add",
    canonical_solution: "SECRET_REFERENCE_SOLUTION", test: "def check(fn): assert fn(1,2)==3",
  });
  assert.equal(result.framework, "HumanEval");
  assert.equal(result.test_source_sha256.length, 64);
  assert.equal(result.official_score, null);
  assert.ok(!JSON.stringify(result).includes("SECRET_"));
  assert.ok(!JSON.stringify(result).includes("assert fn"));
});

test("HumanEval adapter rejects missing tests", () => {
  assert.throws(() => normalizeHumanEval({ task_id: "HumanEval/0", prompt: "x", entry_point: "x" }), /test/);
});

test("MBPP metadata reports count and hash without test source or reference code", () => {
  const result = normalizeMBPP({
    task_id: 12, text: "Return the square of a number", code: "SECRET_REFERENCE_SOLUTION",
    test_list: ["assert square(2)==4", "assert square(-3)==9"],
  });
  assert.equal(result.test_count, 2);
  assert.equal(result.test_source_sha256.length, 64);
  assert.equal(result.official_score, null);
  assert.ok(!JSON.stringify(result).includes("SECRET_"));
  assert.ok(!JSON.stringify(result).includes("assert square"));
});

test("MBPP adapter rejects malformed test list and invalid ids", () => {
  assert.throws(() => normalizeMBPP({ task_id: 3, text: "x", test_list: [] }), /test_list/);
  assert.throws(() => normalizeMBPP({ task_id: -1, text: "x", test_list: ["pass"] }), /task_id/);
});

test("local trajectory captures failed attempts with content integrity digest", () => {
  const make = () => makeTrajectory({
    taskId: "task-03-rate-limit-fix",
    events: [
      { kind: "observation", summary: "Rate limit test failed" },
      { kind: "failed_attempt", summary: "First patch got boundary condition wrong" },
      { kind: "test_result", summary: "Red/green tests rerun" },
      { kind: "final", summary: "Fixed elapsed-time expression" },
    ],
    evaluation: { verdict: "PASS", source: "local node:test fixture, not official benchmark" },
  });
  const result = make();
  assert.equal(result.content_sha256, make().content_sha256);
  assert.equal(result.events[1].kind, "failed_attempt");
  assert.equal(result.externally_verified, false);
});

test("trajectory rejects invalid event kinds or verdict", () => {
  const settings = { taskId: "task-03-rate-limit-fix", events: [{ kind: "teleport", summary: "x" }],
    evaluation: { verdict: "PASS", source: "selftest" } };
  assert.throws(() => makeTrajectory(settings), /event kind/);
  assert.throws(() => makeTrajectory({ ...settings, events: [{ kind: "final", summary: "done" }],
    evaluation: { verdict: "GREAT", source: "selftest" } }), /verdict/);
});
