/** Read-only compatibility adapters. They NEVER execute submitted code or grade official datasets. */
import { createHash } from "node:crypto";

const digest = data => createHash("sha256").update(data).digest("hex");
const assertText = (value, name, max = 200_000) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new TypeError(`${name} must be a nonempty string <= ${max} chars`);
  return value;
};
const assertObject = value => {
  if (!value || Array.isArray(value) || typeof value !== "object") throw new TypeError("Expected object");
  return value;
};
const assertId = (value, label) => {
  assertText(value, label, 256);
  if (!/^[a-zA-Z0-9_./#-]+$/.test(value) || value.includes(".."))
    throw new TypeError("Unsafe " + label);
  return value;
};

/** SWE-bench dataset items: metadata only, without gold patches and hidden tests. */
export function normalizeSWEInstance(raw) {
  const item = assertObject(raw);
  return {
    framework: "swe-bench",
    instance_id: assertId(item.instance_id, "instance_id"),
    repo: assertText(item.repo, "repo", 512),
    base_commit: assertText(item.base_commit, "base_commit", 128),
    problem_statement: assertText(item.problem_statement, "problem_statement"),
    dataset_origin: "external_unverified_record",
    official_evaluation_run: false,
  };
}

/** Official predictions contract; generates input artifacts for external evaluation only. */
export function normalizeSWEPrediction(raw) {
  const item = assertObject(raw);
  const model_patch = assertText(item.model_patch, "model_patch", 1_000_000);
  if (!/^diff --git |^--- /m.test(model_patch))
    throw new TypeError("model_patch must resemble a unified diff");
  return {
    instance_id: assertId(item.instance_id, "instance_id"),
    model_name_or_path: assertText(item.model_name_or_path, "model_name_or_path", 256),
    model_patch,
  };
}
export function serializeSWEPredictions(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100_000)
    throw new TypeError("Must provide 1-100000 predictions");
  const seen = new Set();
  return items.map(raw => {
    const data = normalizeSWEPrediction(raw);
    if (seen.has(data.instance_id)) throw new Error("Duplicate SWE-bench instance_id");
    seen.add(data.instance_id);
    return JSON.stringify(data);
  }).join("\n") + "\n";
}

export function normalizeHumanEval(raw) {
  const item = assertObject(raw);
  const tests = assertText(item.test, "test");
  return {
    framework: "HumanEval",
    id: assertId(item.task_id, "task_id"),
    language: "Python",
    prompt: assertText(item.prompt, "prompt"),
    entry_point: assertText(item.entry_point, "entry_point", 128),
    test_source_sha256: digest(tests),
    test_count: null, // Test body is Python code: cannot infer test count by line count.
    official_score: null,
    note: "Metadata adapter only; reference solution and executable test source omitted",
  };
}

export function normalizeMBPP(raw) {
  const item = assertObject(raw);
  const tests = item.test_list;
  if (!Array.isArray(tests) || !tests.length || tests.length > 1000 ||
      tests.some(t => typeof t !== "string" || !t.trim() || t.length > 100_000))
    throw new TypeError("MBPP test_list must contain nonempty Python tests");
  const id = item.task_id;
  if (!(typeof id === "number" && Number.isSafeInteger(id) && id >= 0) &&
      !(typeof id === "string" && /^\d+$/.test(id)))
    throw new TypeError("Invalid MBPP task_id");
  return {
    framework: "MBPP", id: String(id), language: "Python",
    prompt: assertText(item.text, "text"), test_count: tests.length,
    test_source_sha256: digest(JSON.stringify(tests)),
    official_score: null,
    note: "Metadata adapter only; reference code and executable test source omitted",
  };
}

/** Locally generated trajectory record for offline inspection; NOT an RL rollout from Harbor. */
export function makeTrajectory({ taskId, events, evaluation }) {
  assertId(taskId, "taskId");
  if (!Array.isArray(events) || !events.length || events.length > 5000)
    throw new TypeError("Expected 1-5000 events");
  const allowed = new Set(["observation", "action", "failed_attempt", "test_result", "decision", "final"]);
  const normalized = events.map((event, i) => {
    assertObject(event);
    if (!allowed.has(event.kind)) throw new TypeError("Invalid trajectory event kind");
    return { step: i + 1, kind: event.kind, summary: assertText(event.summary, "summary", 2000) };
  });
  if (!evaluation || !["PASS", "FAIL", "NOT_RUN"].includes(evaluation.verdict))
    throw new TypeError("Missing evaluation verdict");
  const record = {
    schema: "forge-agent-trajectory-v1", task_id: taskId,
    events: normalized,
    evaluation: { verdict: evaluation.verdict, source: assertText(evaluation.source, "evaluation.source", 1000) },
    externally_verified: false,
  };
  return { ...record, content_sha256: digest(JSON.stringify(record)) };
}
