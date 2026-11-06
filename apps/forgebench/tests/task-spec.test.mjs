import test from "node:test";
import assert from "node:assert/strict";
import { sortTasks } from "../src/task-spec.ts";

const task = (id, depends_on = []) => ({ id, title: id, brief: "Fix a genuine bug", depends_on, acceptance: ["Tests must pass"], suite: "tests/engine.test.mjs" });

test("TypeScript task graph produces deterministic dependency order", () => {
  const result = sortTasks([task("task-02-next", ["task-01-base"]), task("task-01-base")]);
  assert.deepEqual(result.map(x => x.id), ["task-01-base", "task-02-next"]);
});

test("TypeScript task graph rejects cycles", () => {
  assert.throws(() => sortTasks([task("task-01-loop", ["task-02-loop"]), task("task-02-loop", ["task-01-loop"])]), /cycle/);
});

test("TypeScript task graph rejects missing dependencies and duplicate IDs", () => {
  assert.throws(() => sortTasks([task("task-01-base", ["task-99-missing"])]), /unknown dependency/);
  assert.throws(() => sortTasks([task("task-01-base"), task("task-01-base")]), /duplicate task/);
});
