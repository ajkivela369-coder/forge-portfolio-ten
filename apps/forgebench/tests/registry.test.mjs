import test from "node:test";
import assert from "node:assert/strict";
import { FRAMEWORKS, findFramework } from "../src/registry.mjs";

test("registry does not claim official evaluations were performed", () => {
  assert.ok(FRAMEWORKS.length >= 9);
  assert.ok(FRAMEWORKS.every(x => x.official_run === false));
  assert.equal(findFramework("harbor").status, "researched_not_integrated");
});

test("uncertain framework names are explicitly unverified", () => {
  for (const id of ["rl-evalbench-v2", "agentdocker-harness", "promptgrade-agent-harness"])
    assert.equal(findFramework(id).status, "unverified_identity");
});

test("registry refuses unknown framework identities", () => {
  assert.throws(() => findFramework("unknown"), RangeError);
});
