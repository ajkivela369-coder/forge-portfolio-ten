# ForgeBench SWE — Engineering Benchmark Prototype

**Status: Tested local prototype.** Separate from the historical ForgeMind model-evaluation ForgeBench cohorts; no sealed or spent evaluations are reused.

## Implemented

- Node.js HTTP service backed by SQLite, with per-client sliding-window quota handling and durable idempotency keys.
- TypeScript-typed dependency graph validation (cycles, invalid dependencies, duplicates).
- Five sequential task specifications: throttling, durable idempotency, Retry-After boundary regression, fail-closed sandbox admission policy, and structural candidate-diff review.
- A **trusted local red/green fixture** with three implementations and six public acceptance cases:
  - Broken starter: **3 passed, 3 failed** (correctly rejected).
  - Reviewed reference: **6 passed, 0 failed**.
  - Boundary regression: **5 passed, 1 failed** (correctly rejected).
- SWE-bench data/prediction structural adapters and a **fictional prediction JSONL export**.
- HumanEval and MBPP read-only metadata adapters (test-body hashes; no external scoring).
- Framework registry with explicit levels of verification, including Harbor, E2B and Modal references.
- Agent-style local trajectory report documenting real fixture outcomes, failed attempts and reference comparison.
- New `src/patch-inspector.mjs`: conservative text-only unified-diff structural review with hunk count, path, mode and input-size checks; **does not apply or execute candidate changes**.
- **50 passing Node tests, 1 Windows symlink test skipped** in the latest verified run.

## Commands

Requires Node.js 24+; no package installation necessary.

```powershell
cd apps/forgebench
npm test
npm run tasks
npm run bench
npm run redgreen
npm run adapters
npm run trajectory
npm run serve
```

Generated reports:
- `reports/latest.json` — local suite result, counts and test-suite SHA256.
- `reports/red-green.json` — starter/fix/regression comparison with code hashes.
- `reports/adapter-demo.json` — synthetic structural-adapter report.
- `reports/synthetic-swe-predictions.jsonl` — fictitious prediction artifact **not for submission**.
- `reports/trajectory-local.json` — original local trajectory schema, not an RL rollout.

The local API can be queried through PowerShell:

```powershell
$headers = @{ 'x-client-id'='demo_01'; 'idempotency-key'='request-000001' }
Invoke-RestMethod http://127.0.0.1:4731/v1/jobs -Method Post -Headers $headers -ContentType 'application/json' -Body '{"task":"Fix connection retries"}'
```

## Strict boundaries

- **Do not deploy this API publicly:** `x-client-id` is a demonstrative identifier and not authentication.
- The new `src/sandbox-policy.mjs` checks policy constraints and prepares a pinned-image command plan but **does not execute it**; Docker/Podman are unavailable. It validates hashes of locally authored test fixtures but is not an operating-system sandbox.
- **Never evaluate untrusted candidate code using the local red/green runner.** It starts subprocesses and has no OS-level sandbox, network isolation or resource quota beyond timeout/output length. This is not Docker/Harbor/E2B.
- The patch inspector accepts only a narrow class of existing-text-file modifications. It is not a complete Git patch parser, security sandbox, or proof a patch is safe.
- No official SWE-bench, HumanEval, MBPP, or Harbor evaluation was executed. Test metadata adapters are not scoring compatibility.
- No hidden grading suites. Included fixtures are intentionally public and synthetic.
- The reference implementation is intentionally in the public demo; do not use the same folder as a held-out challenge.
- CI workflow is written but cannot be called passing until GitHub actually executes it.

**Next engineering steps:** validated Harbor task import, container-based untrusted runner with filesystem/network limits, fresh real-world repository task and red/green patch workflow, React authoring interface, Playwright browser tests, and negative mutation coverage beyond this one case.

Official source documentation: [SWE-bench predictions](https://www.swebench.com/SWE-bench/guides/evaluation/), [HumanEval dataset](https://huggingface.co/datasets/openai/openai_humaneval), [Harbor docs](https://github.com/harbor-framework/docs/blob/main/guides/running-evaluations.mdx).
