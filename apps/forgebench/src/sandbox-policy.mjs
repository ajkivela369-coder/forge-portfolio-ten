/** Fail-closed policy for future container evaluation. NO execution capability here.
 * Never treat this module as a sandbox or run untrusted submissions on the host.
 */
import { createHash } from "node:crypto";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute, sep } from "node:path";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const taskIdPattern = /^task-[0-9]{2}-[a-z0-9-]{2,90}$/;
const imagePattern = /^[a-z0-9][a-z0-9._/-]*(?::[0-9]+)?(?:\/[a-z0-9._/-]+)*@sha256:[0-9a-f]{64}$/;

/** Verify an exact immutable file under authored fixtures. Does not grant execution rights. */
export function verifyTrustedFixture({ file, fixturesRoot, expectedSha256 } = {}) {
  if (typeof fixturesRoot !== "string" || typeof file !== "string" ||
      typeof expectedSha256 !== "string" || !/^[0-9a-f]{64}$/.test(expectedSha256))
    throw new TypeError("Need root, file and pinned SHA-256");
  const root = realpathSync(resolve(fixturesRoot));
  const candidate = resolve(root, file);
  const rel = relative(root, candidate);
  if (!rel || rel.startsWith(".."+sep) || rel === ".." || isAbsolute(rel))
    throw new Error("Fixture escapes approved root or refers to root itself");
  const parts = rel.split(sep);
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error("Symlink not accepted");
  }
  if (!lstatSync(current).isFile()) throw new Error("Expected regular file");
  const hash = sha256(readFileSync(current));
  if (hash !== expectedSha256) throw new Error("Fixture SHA-256 mismatch");
  return { status: "HASH_VERIFIED_NO_EXECUTION", relative_path: rel.split(sep).join("/"), sha256: hash };
}

/** Creates inspectable argv, never executes a container. Caller must verify runtime independently.
 * A pinned image must already contain the fixed evaluator entrypoint and all inputs.
 * No filesystem mounts, SSH, API tokens, or host networking are permitted.
 */
export function prepareContainerExecution({
  taskId, imageDigest, runtimeDetected = false, candidateMetadata = {},
} = {}) {
  if (typeof taskId !== "string" || !taskIdPattern.test(taskId))
    throw new TypeError("Invalid task ID");
  if (typeof imageDigest !== "string" || !imagePattern.test(imageDigest))
    throw new TypeError("An immutable OCI image@sha256 digest is mandatory");
  if (typeof runtimeDetected !== "boolean") throw new TypeError("runtimeDetected must be boolean");
  if (!candidateMetadata || typeof candidateMetadata !== "object" || Array.isArray(candidateMetadata) ||
      Object.keys(candidateMetadata).some(key => !["trusted_artifact_hash"].includes(key)))
    throw new TypeError("Only reviewed metadata fields are accepted");
  if ("trusted_artifact_hash" in candidateMetadata &&
    (typeof candidateMetadata.trusted_artifact_hash !== "string" ||
     !/^[0-9a-f]{64}$/.test(candidateMetadata.trusted_artifact_hash)))
    throw new TypeError("Malformed artifact hash");

  const argv = [
    "run", "--rm", "--pull=never", "--network=none", "--read-only",
    "--cap-drop=ALL", "--security-opt=no-new-privileges",
    "--pids-limit=64", "--memory=256m", "--cpus=0.5",
    "--user=65534:65534", "--ipc=none",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=16m", "--workdir=/tmp",
    imageDigest, "/opt/forgebench/evaluate", taskId,
  ];
  return {
    schema: "forge-future-container-policy-v1",
    task_id: taskId, argv,
    runtime_detected_reported: runtimeDetected,
    execution_performed: false,
    sandbox_security_verified: false,
    external_submission_allowed: false,
    status: runtimeDetected ? "REVIEW_REQUIRED_NOT_EXECUTED" : "BLOCKED_NO_CONTAINER_RUNTIME",
    rationale: "Only an execution plan. Requires installed and audited runtime, immutable image supply-chain proof, OS-level policy review, and independent resource/security tests.",
  };
}
