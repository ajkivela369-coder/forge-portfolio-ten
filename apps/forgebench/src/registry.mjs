/** Capability claims are conservative and intentionally explicit. */
export const FRAMEWORKS = Object.freeze([
  { id: "swe-bench", label: "SWE-bench / Lite", status: "local_metadata_and_prediction_adapter",
    official_run: false, source: "https://www.swebench.com/SWE-bench/guides/evaluation/",
    note: "Validates metadata and prediction structure; does not run official Docker harness or claim resolved SWE-bench tasks." },
  { id: "humaneval", label: "HumanEval", status: "metadata_adapter_only", official_run: false,
    source: "https://huggingface.co/datasets/openai/openai_humaneval",
    note: "Test body digests and count metadata only; no actual HumanEval execution." },
  { id: "mbpp", label: "MBPP", status: "metadata_adapter_only", official_run: false,
    source: "https://huggingface.co/datasets/google-research-datasets/mbpp",
    note: "Test body digests and count metadata only; no actual MBPP execution." },
  { id: "harbor", label: "Harbor", status: "researched_not_integrated", official_run: false,
    source: "https://harborframework.com/",
    note: "Task organization and trajectory concepts studied; no Harbor CLI execution or validated adapter." },
  { id: "rl-evalbench-v2", label: "RL-EvalBench v2", status: "unverified_identity", official_run: false,
    source: null, note: "Identity remains unverified; not represented as installed or used." },
  { id: "agentdocker-harness", label: "AgentDocker-Harness", status: "unverified_identity", official_run: false,
    source: null, note: "Identity remains unverified; not represented as installed or used." },
  { id: "promptgrade-agent-harness", label: "PromptGrade Agent Harness",
    status: "unverified_identity", official_run: false, source: null,
    note: "Identity remains unverified; no external tool compatibility claim." },
  { id: "modal", label: "Modal", status: "reference_only", official_run: false,
    source: "https://modal.com/", note: "Cloud execution provider; no authentication, deployment or payments configured." },
  { id: "e2b", label: "E2B", status: "reference_only", official_run: false,
    source: "https://e2b.dev/", note: "Cloud sandbox provider; not installed or invoked." },
  { id: "forge-trajectory", label: "ForgeBench local trajectories",
    status: "local_schema_and_tests", official_run: false, source: null,
    note: "Original metadata schema, not a Harbor RL training rollout." }
]);

export function findFramework(id) {
  const item = FRAMEWORKS.find(entry => entry.id === id);
  if (!item) throw new RangeError("Unknown framework: " + String(id));
  return item;
}
