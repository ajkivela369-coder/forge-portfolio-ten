import test from "node:test";
import assert from "node:assert/strict";

// An allowlist restricts execution to three authored, trusted local fixture implementations.
// This is not an execution sandbox: never insert arbitrary code into these fixtures.
const variant = process.env.FORGEBENCH_TRUSTED_VARIANT;
if (!["baseline", "reference", "regression"].includes(variant))
  throw new Error("Only named, trusted local fixtures may be evaluated");
const { retryAfterMs } = await import("./" + variant + ".mjs");

test("empty and below-quota windows do not block", () => {
  assert.equal(retryAfterMs([], 1000, 60000, 2), 0);
  assert.equal(retryAfterMs([900], 1000, 60000, 2), 0);
});

test("blocked requests calculate retry-after using elapsed time", () => {
  assert.equal(retryAfterMs([900, 950], 1000, 200, 2), 100);
});

test("unsorted events select correct request expiration", () => {
  assert.equal(retryAfterMs([980, 900, 950], 1000, 200, 2), 150);
});

test("request at the precise window boundary has expired", () => {
  assert.equal(retryAfterMs([800, 950], 1000, 200, 2), 0);
});

test("future timestamps are ignored", () => {
  assert.equal(retryAfterMs([2000, 900], 1000, 200, 2), 0);
});

test("invalid parameters fail closed", () => {
  assert.throws(() => retryAfterMs([900], 1000, 0, 1), TypeError);
  assert.throws(() => retryAfterMs([NaN], 1000, 200, 1), TypeError);
});
