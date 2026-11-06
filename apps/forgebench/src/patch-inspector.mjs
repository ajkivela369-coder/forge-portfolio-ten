/** Conservative, metadata-only inspection of author-supplied Git unified diffs.
 * Does not apply a patch, execute code, prove semantic correctness, or sandbox anything.
 */
import { createHash } from "node:crypto";

const safePath = path =>
  typeof path === "string" &&
  /^(src|lib|internal|tests)\/[A-Za-z0-9_.\/-]{1,180}$/.test(path) &&
  !path.split("/").some(part => part === "." || part === ".." || !part || part === ".git") &&
  !path.includes("//");

function fail(reason) { throw new TypeError("Unsafe or malformed local patch: " + reason); }

/** This deliberately narrow subset only accepts modifications to existing text files.
 * It rejects new/deleted files, renames, mode changes, binary patches and symlinks.
 */
export function inspectLocalPatch(patch, { maxBytes = 200_000, maxFiles = 20, maxChangedLines = 4000 } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 ||
      !Number.isInteger(maxFiles) || maxFiles < 1 ||
      !Number.isInteger(maxChangedLines) || maxChangedLines < 1) fail("invalid limits");
  if (typeof patch !== "string" || !patch.trim()) fail("empty patch");
  if (Buffer.byteLength(patch, "utf8") > maxBytes) fail("oversized input");
  if (patch.includes("\0") || /\r(?!\n)/.test(patch)) fail("unsafe characters");
  const normalized = patch.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  let i = 0;
  let changed = 0;
  const files = [];
  const seen = new Set();

  while (i < lines.length) {
    const header = /^diff --git a\/(\S+) b\/(\S+)$/.exec(lines[i]);
    if (!header) fail("expected diff --git file header");
    const [, oldPath, newPath] = header;
    if (oldPath !== newPath || !safePath(oldPath) || seen.has(oldPath)) fail("unsupported or duplicate path");
    files.push(oldPath); seen.add(oldPath);
    if (files.length > maxFiles) fail("too many files");
    i++;
    // Git's index line is metadata, not authorization; only allow known format.
    if (lines[i]?.startsWith("index ")) {
      if (!/^index [0-9a-f]{4,64}\.\.[0-9a-f]{4,64}(?: 100644)?$/.test(lines[i])) fail("invalid index");
      i++;
    }
    if (lines[i] !== "--- a/" + oldPath || lines[i+1] !== "+++ b/" + oldPath)
      fail("unexpected file modification/mode headers");
    i += 2;
    let hunks = 0;
    while (i < lines.length && !lines[i].startsWith("diff --git ")) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/.exec(lines[i]);
      if (!match) fail("expected hunk");
      const oldCount = match[2] === undefined ? 1 : Number(match[2]);
      const newCount = match[4] === undefined ? 1 : Number(match[4]);
      if (oldCount > maxChangedLines || newCount > maxChangedLines) fail("hunk too large");
      i++; hunks++;
      let oldSeen = 0, newSeen = 0, additions = 0, removals = 0;
      while (i < lines.length && !lines[i].startsWith("@@ ") && !lines[i].startsWith("diff --git ")) {
        const line = lines[i];
        if (line.startsWith(" ")) { oldSeen++; newSeen++; }
        else if (line.startsWith("+")) { newSeen++; additions++; }
        else if (line.startsWith("-")) { oldSeen++; removals++; }
        else if (line === "\\ No newline at end of file") { /* informational marker */ }
        else fail("invalid hunk line");
        i++;
      }
      if (oldSeen !== oldCount || newSeen !== newCount) fail("hunk range/count mismatch");
      changed += additions + removals;
      if (changed > maxChangedLines) fail("change budget exceeded");
    }
    if (!hunks) fail("file without hunks");
  }
  return {
    schema: "forge-local-patch-inspection-v1",
    files: files.sort(), file_count: files.length,
    changed_lines: changed,
    patch_sha256: createHash("sha256").update(normalized).digest("hex"),
    status: "STRUCTURALLY_VALID_NARROW_SUBSET",
    applied: false, executed: false,
    warning: "Structural review only; not an official SWE-bench validation, semantic proof, or sandbox."
  };
}
