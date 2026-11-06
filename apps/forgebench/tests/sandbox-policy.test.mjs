import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { prepareContainerExecution, verifyTrustedFixture } from "../src/sandbox-policy.mjs";

const image = "registry.example.org/forge/evaluator@sha256:" + "a".repeat(64);
const taskId = "task-04-sandbox-gate";

test("future container plan is blocked without installed runtime", () => {
  const plan = prepareContainerExecution({ taskId, imageDigest: image });
  assert.equal(plan.status, "BLOCKED_NO_CONTAINER_RUNTIME");
  assert.equal(plan.execution_performed, false);
  assert.equal(plan.external_submission_allowed, false);
  assert.equal(plan.sandbox_security_verified, false);
});

test("reported runtime does not automatically authorize code execution", () => {
  const plan = prepareContainerExecution({ taskId, imageDigest: image, runtimeDetected: true });
  assert.equal(plan.status, "REVIEW_REQUIRED_NOT_EXECUTED");
  assert.equal(plan.execution_performed, false);
  assert.equal(plan.external_submission_allowed, false);
});

test("restrictive container args omit mounts, host network and injected shell", () => {
  const { argv } = prepareContainerExecution({ taskId, imageDigest: image });
  assert.ok(argv.includes("--network=none"));
  assert.ok(argv.includes("--read-only"));
  assert.ok(argv.includes("--cap-drop=ALL"));
  assert.ok(argv.includes("--security-opt=no-new-privileges"));
  assert.ok(argv.includes("--pull=never"));
  assert.ok(!argv.some(a => a.includes("--mount") || a.includes("-v") || a.includes("host")));
  assert.deepEqual(argv.slice(-3), [image, "/opt/forgebench/evaluate", taskId]);
});

test("rejects mutable image tags and unqualified image digests", () => {
  assert.throws(() => prepareContainerExecution({ taskId, imageDigest: "node:24" }), /immutable/);
  assert.throws(() => prepareContainerExecution({ taskId, imageDigest: image.replace(/a/g, "z") }), /immutable/);
});

test("rejects unsafe task names and uncontrolled candidate metadata", () => {
  assert.throws(() => prepareContainerExecution({ taskId: "../etc", imageDigest: image }), /task/);
  assert.throws(() => prepareContainerExecution({ taskId, imageDigest: image, candidateMetadata: { command: "powershell" } }), /metadata/);
});

test("checks trusted fixture bytes against pinned hash", () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-trust-"));
  try {
    mkdirSync(join(dir, "files"));
    const file = join(dir, "files", "reviewed.txt");
    writeFileSync(file, "safe controlled test data");
    const expectedSha256 = createHash("sha256").update("safe controlled test data").digest("hex");
    const result = verifyTrustedFixture({ file: "files/reviewed.txt", fixturesRoot: dir, expectedSha256 });
    assert.equal(result.status, "HASH_VERIFIED_NO_EXECUTION");
    assert.equal(result.relative_path, "files/reviewed.txt");
    writeFileSync(file, "tampered test data");
    assert.throws(() => verifyTrustedFixture({ file: "files/reviewed.txt", fixturesRoot: dir, expectedSha256 }), /mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rejects traversal out of the fixtures directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-root-"));
  try {
    assert.throws(() => verifyTrustedFixture({
      file: "../outside.txt", fixturesRoot: dir, expectedSha256: "a".repeat(64),
    }), /escapes/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rejects symlinks within fixture tree", { skip: process.platform === "win32" && !process.env.CI }, () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-symlink-"));
  try {
    writeFileSync(join(dir, "original.txt"), "reviewed");
    symlinkSync("original.txt", join(dir, "linked.txt"));
    assert.throws(() => verifyTrustedFixture({
      file: "linked.txt", fixturesRoot: dir, expectedSha256: "a".repeat(64),
    }), /Symlink/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
