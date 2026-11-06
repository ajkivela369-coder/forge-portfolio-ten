# Forge Studio — 10-Project Engineering Portfolio

**Current verified state: 7 working/tested prototypes of 10 destinations; 3 remain planned. All source local and unpublished.**

This is an isolated engineering portfolio. It does not replace the existing ForgeMind, Forge AI Showcase or private repositories. The goal is substantive, tested software—not ten empty repositories or unsupported language claims.

| # | Project | Verified implementation | Status |
| --- | --- | --- | --- |
| 1 | [ForgeBench SWE](apps/forgebench/README.md) | TypeScript + Node/SQLite API, adapters, 5 task specs, red/green, patch inspector, 50 Node tests passed, 1 Windows symlink test skipped | Tested |
| 2 | [ForgeML](apps/forgeml/README.md) | Pure-Python deterministic preference-ranker baseline, 9 tests; no PyTorch | Tested |
| 3 | [ForgeMesh](apps/forgemesh/README.md) | Go net/http microservice, Node reference, 17 Node tests and 7 Go top-level tests; no gRPC/Redis/Kafka | Tested |
| 4 | [ForgeCore](apps/forgecore/README.md) | C++20 resource-aware DAG scheduler; 19/19 tests GCC and Clang on separate Linux runner, ASan/UBSan checks and 150-task stress | Tested |
| 5 | ForgeEnterprise | Java/Spring/Angular planned; no verified local build | Planned |
| 6 | [ForgeCloud](apps/forgecloud/README.md) | Python-only release/rollback planner, 12 tests; no C#/.NET or deployment | Tested |
| 7 | ForgeMobile | Kotlin/Swift/Dart/Flutter planned; no verified local build | Planned |
| 8 | [ForgeCommerce](apps/forgecommerce/README.md) | Real PHP stock/order-reservation engine, file-backed persistence, 17 PHP tests and 12 HTTP checks in independent PHP environment | Tested |
| 9 | ForgeConnect | Ruby/Rails/GraphQL/WebSockets planned; no verified local build | Planned |
| 10 | [ForgeDataLab](apps/forgedatalab/README.md) | Python/SQLite telemetry analytics, 7 tests; no DuckDB/R/C++ | Tested |

## Test evidence

**138 top-level automated checks passed, 0 failed, 1 skipped**, across the project's last verified environments:

- **Windows laptop:** ForgeBench 50, ForgeML 9, ForgeMesh Node 17, ForgeCloud 12, ForgeDataLab 7 = **95 passing**; 1 Windows symlink test skipped.
- **Separate Linux testing environment:** ForgeMesh Go **7 top-level** tests (plus 5 nested subtests); ForgeCommerce PHP **17** business-logic tests; ForgeCore C++20 **19** unit tests compiled with GCC 14.2 and Clang 17, plus passing address/undefined-behavior sanitizer runs.
- **Additional verified integration checks, not included in the 138:** ForgeCommerce 12/12 live HTTP checks and one multi-process stock race test. Prior ForgeMesh Go and Node server smoke checks each 8/8.

ForgeCore's seven source, fixture and documentation files on Windows were also verified by SHA-256 against the Linux-tested sources. A 150-task stress fixture and reversed-input determinism checks passed in the separate Linux environment. The PHP source files saved on Windows were checked against the independently tested source using nine SHA-256 digests. **The Windows PHP executable is outside GFC's approved executable roots and was not run.** The Python and Node results were obtained on the workstation.

These results are **not** GitHub Actions executions, independent customer benchmarks, sealed agent evaluations or production certifications.

## Verify from the workspace

```powershell
cd C:\Users\user\ForgeRepo\forge-portfolio-ten-20261105\apps\forgebench
node --test
node src/cli.mjs score

cd ..\forgemesh
node --test

cd ..\forgeml
python -m unittest discover -s tests -v

cd ..\forgecloud
python -m unittest discover -s tests -v

cd ..\forgedatalab
python -m unittest discover -s tests -v
```

ForgeCommerce is saved under `apps/forgecommerce` with its PHP/HTTP/concurrency test instructions. Do **not** bypass owner approval to run the Windows PHP executable. The Go and C++ compilers are likewise not installed on the paired Windows laptop. ForgeCore was compiled in a separate Linux environment; it has **not** been natively tested on Windows.

## Scope, provenance and security

- No official SWE-bench, HumanEval, MBPP or Harbor evaluation was run. Benchmark adapters and patch metadata checks are not grading or safe code execution.
- Untrusted code execution is disabled; no audited Docker/VM sandbox is installed.
- ForgeMesh and ForgeCommerce use unauthenticated demo client identifiers and must stay on loopback. Neither supports production authentication, payments or durable multi-node transactions.
- Tests and fixtures are synthetic; no customer, medical, military or other private data used.
- No paid API, design platform or cloud subscription was used.
- No code was committed, pushed, made public or deployed. The GitHub Actions workflow is authored but has never executed remotely.
- Preserve original ForgeMind sealed-cohort provenance, unrelated worktrees, and source history.

See [Phase 6 checkpoint](docs/IMPLEMENTATION_CHECKPOINT_2026-11-06_PHASE6.md), [Phase 6 skills/evidence](docs/SKILLS_TO_EVIDENCE_PHASE6.md), [Phase 5 checkpoint](docs/IMPLEMENTATION_CHECKPOINT_2026-11-05_PHASE5.md), [skills-to-evidence matrix](docs/SKILLS_TO_EVIDENCE_PHASE5.md), [Phase 4 checkpoint](docs/IMPLEMENTATION_CHECKPOINT_2026-11-05_PHASE4.md), [framework evidence](docs/FRAMEWORKS_EVIDENCE.md), and [manifest](portfolio-manifest.json).
