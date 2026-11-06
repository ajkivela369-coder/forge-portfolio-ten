# Forge Studio portfolio — skills-to-verified-evidence matrix (Phase 5)

This matrix intentionally separates **source present**, **test executed**, and **framework only planned**. All ten destinations are local/private and unpublished.

| Skill or technology | Source implementation | Verified evidence | Qualification |
| --- | --- | --- | --- |
| JavaScript + Node.js HTTP | `apps/forgebench/src/engine.mjs`, `apps/forgemesh/reference/service.mjs` | Windows Node suites; real HTTP tests | Working local prototypes, no public authentication |
| TypeScript | `apps/forgebench/src/task-spec.ts` | task-graph tests under Node 24 | Native TypeScript strip support, not full React application |
| SQL + SQLite | `apps/forgebench/src/engine.mjs`, `apps/forgedatalab/src/pipeline.py` | local persistence/analytics tests on Windows | Working local SQLite; no MySQL/PostgreSQL |
| Python model fitting | `apps/forgeml/src/pairwise_baseline.py` | 9 synthetic unit tests on Windows | Pure Python logistic pairwise baseline; not PyTorch or a deployed model |
| Python release engineering | `apps/forgecloud/src/release_planner.py` | 12 unit tests and local synthetic plan | Not a C#/.NET, Kubernetes or Terraform deployment |
| Go HTTP + concurrency | `apps/forgemesh/internal/mesh/service.go` | Go 1.23.2 Linux compile/test/race/vet (7 top-level tests + 5 nested) | Separate test environment; not installed on Windows |
| HTTP concurrency/fault checks | `apps/forgemesh/tests/fault-matrix.test.mjs` | 6 new passing Windows tests; Node suite 17/17 | Stress of single-process reference, not a distributed load benchmark |
| PHP inventory / orders | `apps/forgecommerce/src/Store.php`, `public/router.php` | Independent PHP 8.4.24: 17/17 unit tests, 12/12 live HTTP checks, one multi-process stock race | Exact files transferred and nine SHA-256 checks on Windows; Windows PHP run still requires owner approval |
| File locking / idempotency | `apps/forgecommerce/src/Store.php` | successful persistent replay, no partial reservation, and multi-process stock test | JSON-file persistence; no SQLite, crash durability or real payment |
| SWE-bench structural data formats | `apps/forgebench/src/frameworks.mjs`, `src/adapter-demo.mjs` | synthetic adapter tests | Not an official SWE-bench benchmark run or scoring |
| HumanEval / MBPP metadata | `apps/forgebench/src/frameworks.mjs` | synthetic adapter tests | No named dataset evaluated |
| Coding patch inspection | `apps/forgebench/src/patch-inspector.mjs` | 10 Node tests for narrow text diff subset | Does not apply/execute or certify patches |
| Coding agent red/green | `apps/forgebench/src/local-redgreen.mjs` | trusted fixtures: starter 3/6; fix 6/6; regression 5/6 | Author-controlled public fixture, not sealed or independent evaluation |
| Safe untrusted execution | `apps/forgebench/src/sandbox-policy.mjs` | fail-closed policy tests only | **Not implemented**: no actual container/VM sandbox |
| Harbor / RL trajectories | `apps/forgebench/src/trajectory-demo.mjs`, `src/registry.mjs` | local structured trajectory tests | Not a Harbor CLI rollout; uncertain named products remain unverified |
| Rust, C++, Java, C#, Kotlin, Swift, Dart, Ruby | Future projects | No tested source recorded in this campaign | **Planned only** |
| React, Angular, Spring Boot, Rails, Flutter, Vue, Laravel, gRPC, Kafka, Redis, Docker | Future frameworks | No verified framework integration recorded in this campaign | **Planned only** |

## Test-count methodology

Phase 5 campaign total: **119 passing top-level tests, 1 skipped, 0 failures**.

- Workstation Windows: ForgeBench Node **50 passed, 1 skipped**, ForgeMesh Node **17 passed**, ForgeML Python **9**, ForgeCloud Python **12**, ForgeDataLab Python **7** = **95 passing tests**.
- Separate Linux environments: ForgeMesh Go **7 top-level tests** (plus five nested), ForgeCommerce PHP **17** tests = **24 passing tests**.
- Additional integration checks **not double-counted**: ForgeCommerce PHP live HTTP **12**, PHP multi-process stock **1**, prior ForgeMesh Go smoke **8**, ForgeMesh Node smoke **8**.
- GitHub Actions workflow was written but **not run**. No production test certification, public repository, customer traffic or external benchmark is claimed.

All fixtures use synthetic examples. Prior model evaluations, unreleased ForgeMind data and other private repositories remain independent.
