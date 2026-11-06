# Forge Studio — 10-Project Engineering Portfolio

**Current verified state: 10 tested prototype cores of 10; all remain pre-production. Source remains local until GitHub publication is verified.**

This is an isolated engineering portfolio. It does not replace the existing ForgeMind, Forge AI Showcase or private repositories. The goal is substantive, tested software—not ten empty repositories or unsupported language claims.

| # | Project | Verified implementation | Status |
| --- | --- | --- | --- |
| 1 | [ForgeBench SWE](apps/forgebench/README.md) | TypeScript + Node/SQLite API, adapters, 5 task specs, red/green, patch inspector, 50 Node tests passed, 1 Windows symlink test skipped | Tested |
| 2 | [ForgeML](apps/forgeml/README.md) | Pure-Python deterministic preference-ranker baseline, 9 tests; no PyTorch | Tested |
| 3 | [ForgeMesh](apps/forgemesh/README.md) | Go net/http microservice, Node reference, 17 Node tests and 7 Go top-level tests; no gRPC/Redis/Kafka | Tested |
| 4 | [ForgeCore](apps/forgecore/README.md) | C++20 resource-aware DAG scheduler; 19/19 tests GCC and Clang on separate Linux runner, ASan/UBSan checks and 150-task stress | Tested |
| 5 | [ForgeEnterprise](apps/forgeenterprise/README.md) | Java workflow core, role transitions, audits; 19 separate Linux checks; no Spring/Angular | Tested |
| 6 | [ForgeCloud](apps/forgecloud/README.md) | Python-only release/rollback planner, 12 tests; no C#/.NET or deployment | Tested |
| 7 | [ForgeMobile](apps/forgemobile/README.md) | Kotlin offline-sync core, conflict detection; 19 separate Linux checks; not native Android/iOS | Tested |
| 8 | [ForgeCommerce](apps/forgecommerce/README.md) | Real PHP stock/order-reservation engine, file-backed persistence, 17 PHP tests and 12 HTTP checks in independent PHP environment | Tested |
| 9 | [ForgeConnect](apps/forgeconnect/README.md) | Ruby signed-event routing and retries; 12 Minitest methods/34 assertions; no Rails | Tested |
| 10 | [ForgeDataLab](apps/forgedatalab/README.md) | Python/SQLite telemetry analytics, 7 tests; no DuckDB/R/C++ | Tested |

## Test evidence

**188 top-level automated checks passed across verified environments, 0 failed, 1 skipped**, across the project's last verified environments:

- **Windows laptop:** ForgeBench 50, ForgeML 9, ForgeMesh Node 17, ForgeCloud 12, ForgeDataLab 7 = **95 passing**; 1 Windows symlink test skipped.
- **Separate Linux testing environment:** ForgeMesh Go **7 top-level** tests (plus 5 nested subtests); ForgeCommerce PHP **17** business-logic tests; ForgeCore C++20 **19** unit tests compiled with GCC 14.2 and Clang 17, plus passing address/undefined-behavior sanitizer runs.
- **New Phase 7 Linux tests:** Java 19, Kotlin 19, Ruby 12 top-level cases (34 assertions). All passed; exact source archive SHA-256 verified after transferring to Windows. These runtimes are absent on the Windows workstation.
- **Additional verified integration checks, not included in the 188:** ForgeCommerce 12/12 live HTTP checks and one multi-process stock race test. Prior ForgeMesh Go and Node server smoke checks each 8/8.

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
- At the Phase 7 checkpoint, no GitHub push or deployment has been performed yet. GitHub Actions verification remains pending.
- Preserve original ForgeMind sealed-cohort provenance, unrelated worktrees, and source history.

See [Phase 6 checkpoint](docs/IMPLEMENTATION_CHECKPOINT_2026-11-06_PHASE6.md), [Phase 6 skills/evidence](docs/SKILLS_TO_EVIDENCE_PHASE6.md), [Phase 5 checkpoint](docs/IMPLEMENTATION_CHECKPOINT_2026-11-05_PHASE5.md), [skills-to-evidence matrix](docs/SKILLS_TO_EVIDENCE_PHASE5.md), [Phase 4 checkpoint](docs/IMPLEMENTATION_CHECKPOINT_2026-11-05_PHASE4.md), [framework evidence](docs/FRAMEWORKS_EVIDENCE.md), and [manifest](portfolio-manifest.json).

## Ten individually themed project pages

Run python tools/build_showcase.py to generate site/index.html and ten project detail pages with ten custom SVG icons, responsive layouts and distinct colors. Run python -m unittest discover -s tools -p test_*.py -v to check. These are source-and-evidence pages, not connected production frontends.

See Phase 7 checkpoint in docs/IMPLEMENTATION_CHECKPOINT_2026-11-06_PHASE7.md and archived Phase 6 snapshots in docs/.

## Public source release

The GitHub release publishes the ten tested prototype cores, static themed showcase and documentation. CI workflow source is preserved at docs/checks.workflow-pending-permission.yml because the current GitHub OAuth token lacks the workflow scope. No GitHub Actions passes are claimed until it is installed and executed. This release does not deploy live software services.
