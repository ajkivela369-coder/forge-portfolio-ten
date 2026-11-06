# Forge Studio — Skills and executable evidence, Phase 6

**Seven of ten projects have tested vertical slices**. Evidence statements below are grouped by actual execution environment and must not be presented as GitHub production CI or external benchmark results.

| Skill | Working code | Verification / boundary |
| --- | --- | --- |
| C++20 algorithms and resource scheduling | `apps/forgecore/include/forgecore.hpp`, `src/forgecore.cpp`, `src/main.cpp` | **19/19** unit tests with GCC 14.2 and Clang 17, GCC ASan/UBSan, 150-task stress and deterministic output. Separate Linux testing environment; Windows C++ compiler absent. |
| Dependency-graph planning | `apps/forgecore/src/forgecore.cpp` | Cycle, missing dependency, invalid/duplicate records, memory/parallel budgets, stable lexicographic scheduling, 19 tests. **Simulates** task waves; never executes jobs. |
| Go HTTP and concurrency | `apps/forgemesh/internal/mesh/service.go` | 7 top-level Go tests + 5 nested subtests, Go race detector/vet and smoke. Historical Phase 4 separate Linux environment, not Windows Go. |
| Node.js HTTP and resilience | `apps/forgemesh/reference/service.mjs`, `tests/fault-matrix.test.mjs` | 17 Windows tests, including fault/concurrency matrix. No distributed broker or authentication. |
| PHP inventory and transactions | `apps/forgecommerce/src/Store.php`, `public/router.php` | 17 PHP tests plus 12 HTTP and 1 multiprocess stock check, separate Linux PHP 8.4.24. Windows source checksum verified; executable still requires approval. Uses JSON files with flock, not SQLite. |
| Python model baseline | `apps/forgeml/src/pairwise_baseline.py` | 9 Windows unit tests, synthetic data, train/dev/test split separation. No PyTorch evaluation or model promotion. |
| Python offline release planning | `apps/forgecloud/src/release_planner.py` | 12 Windows unit tests, synthetic release/rollback plan; no actual cloud deployment or .NET. |
| Python + SQLite telemetry | `apps/forgedatalab/src/pipeline.py` | 7 Windows unit tests; synthetic CSV and SQL analytics. |
| Node.js + SQLite + TypeScript data tasks | `apps/forgebench/src/engine.mjs`, `task-spec.ts` | 50 Windows tests passed, 1 Windows symlink test skipped; no official SWE-bench run or security sandbox. |
| SWE-bench, HumanEval, MBPP metadata | `apps/forgebench/src/frameworks.mjs` | Synthetic schema adapters only, no official dataset execution or scores. |
| Coding-diff inspection | `apps/forgebench/src/patch-inspector.mjs` | 10 tests within ForgeBench; narrow structural inspection, not patch execution or full diff validation. |
| REST APIs, idempotency and lock safety | ForgeBench, ForgeMesh, ForgeCommerce | Local demos with synthetic data; no production authentication or public exposure. |
| Rust, C, WebAssembly, Java, Spring, Kotlin, Swift, Dart, Ruby, Rails, Angular, Flutter, C# | Future architecture | **Not verified**; do not claim from planned project names. |

## Test accounting

**138 passing top-level tests; 0 failures; 1 skipped** in combined verified project evidence:

- Windows workstation (Node 24 and Python 3.12): ForgeBench 50, ForgeMesh Node 17, ForgeML 9, ForgeCloud 12, ForgeDataLab 7 = **95 passed**, 1 skipped.
- Separate Linux environments: ForgeMesh Go 7 top-level (historical Phase 4), ForgeCommerce PHP 17 (Phase 5), ForgeCore C++ 19 (Phase 6) = **43 passed**.
- Additional non-counted checks: Go five nested subtests; PHP HTTP 12 and one multi-process race; ForgeMesh Node and Go eight shared HTTP smoke checks each; ForgeCore 150-task stress, reversed-input determinism, GCC sanitizer and Clang duplicate run.

The independent environments do not establish those compilers are installed on the user's Windows laptop. The CI workflow was authored but **not run on GitHub**. The workspace remains uncommitted and unpublished.
