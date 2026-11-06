import test from "node:test";
import assert from "node:assert/strict";
import { inspectLocalPatch } from "../src/patch-inspector.mjs";

const good = [
  "diff --git a/src/engine.mjs b/src/engine.mjs",
  "index abcde..bcdef 100644",
  "--- a/src/engine.mjs",
  "+++ b/src/engine.mjs",
  "@@ -1,2 +1,3 @@",
  " const quota = 2;",
  "-const retry = now - timestamp;",
  "+const elapsed = now - timestamp;",
  "+const retry = Math.max(0, window - elapsed);",
].join("\n") + "\n";

test("valid narrow text patch reports canonical paths and hash", () => {
  const record = inspectLocalPatch(good);
  assert.deepEqual(record.files, ["src/engine.mjs"]);
  assert.equal(record.changed_lines, 3);
  assert.equal(record.file_count, 1);
  assert.equal(record.patch_sha256.length, 64);
  assert.equal(record.applied, false);
  assert.equal(record.executed, false);
});

test("CRLF patch produces same canonical evidence digest", () => {
  assert.deepEqual(inspectLocalPatch(good), inspectLocalPatch(good.replaceAll("\n","\r\n")));
});

test("rejects path traversal and absolute path attempts", () => {
  for (const candidate of ["../secret", "src/../../private", "/etc/passwd", "src//file", "src/.git/config"]) {
    const bad = good.replaceAll("src/engine.mjs", candidate);
    assert.throws(() => inspectLocalPatch(bad), /Unsafe/);
  }
});

test("rejects binary patch and a symlink mode change", () => {
  assert.throws(() => inspectLocalPatch(good.replace("index abcde..bcdef 100644","new file mode 120000")), /Unsafe/);
  assert.throws(() => inspectLocalPatch(good + "GIT binary patch\n"), /Unsafe/);
});

test("rejects renamed/deleted destination and unexpected file headers", () => {
  assert.throws(() => inspectLocalPatch(good.replace("+++ b/src/engine.mjs", "+++ /dev/null")), /Unsafe/);
  assert.throws(() => inspectLocalPatch(good.replace("a/src/engine.mjs b/src/engine.mjs", "a/src/a.mjs b/src/b.mjs")), /Unsafe/);
});

test("rejects incorrect hunk counts", () => {
  assert.throws(() => inspectLocalPatch(good.replace("@@ -1,2 +1,3 @@", "@@ -1,3 +1,3 @@")), /Unsafe/);
});

test("rejects duplicate modified paths", () => {
  assert.throws(() => inspectLocalPatch(good + good), /Unsafe/);
});

test("rejects oversized or nul-containing input", () => {
  assert.throws(() => inspectLocalPatch(good, { maxBytes: 20 }), /Unsafe/);
  assert.throws(() => inspectLocalPatch(good + "\0"), /Unsafe/);
});

test("rejects unsupported unprefixed content and metadata injection", () => {
  assert.throws(() => inspectLocalPatch("fake git diff text"), /Unsafe/);
  assert.throws(() => inspectLocalPatch(good.replace("index abcde..bcdef 100644", "rename from src/file.mjs")), /Unsafe/);
});

test("never claims actual patch execution or official benchmark grading", () => {
  const record = inspectLocalPatch(good);
  assert.equal(record.status, "STRUCTURALLY_VALID_NARROW_SUBSET");
  assert.equal(record.applied, false);
  assert.equal(record.executed, false);
  assert.match(record.warning, /not an official SWE-bench/);
});
