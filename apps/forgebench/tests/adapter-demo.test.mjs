import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSyntheticAdapters } from "../src/adapter-demo.mjs";

test("official-like schemas normalize synthetic data without running official scoring", () => {
  const result = evaluateSyntheticAdapters();
  assert.equal(result.swe_bench.prediction_count, 1);
  assert.equal(result.swe_bench.official_run, false);
  assert.equal(result.official_benchmark_score, null);
  assert.equal(result.humaneval.official_score, null);
  assert.equal(result.mbpp.official_score, null);
  assert.equal(result.input_sha256.length, 64);
});

test("synthetic adapter output omits reference patches and raw executable tests", () => {
  const json = JSON.stringify(evaluateSyntheticAdapters());
  assert.ok(!json.includes("FICTIONAL_GOLD"));
  assert.ok(!json.includes("FICTIONAL_TEST_PATCH"));
  assert.ok(!json.includes("assert twice"));
  assert.ok(!json.includes("assert fn"));
});

test("synthetic adapter output is byte-for-byte reproducible", () => {
  assert.deepEqual(evaluateSyntheticAdapters(), evaluateSyntheticAdapters());
});
