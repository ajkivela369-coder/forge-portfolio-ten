# ForgeCore — deterministic C++20 dependency scheduler

A standard-library-only, **offline dry-run scheduler** for synthetic engineering tasks. Its task parser validates IDs, dependency references, integer duration/memory budgets, and task limits; its planner emits stable resource-constrained waves and a JSON report. It never executes jobs, shell commands, or external code.

The CLI format is `task_id|duration_ms|memory_mib|dependencies` (a comma-separated list or `-`). Task IDs match lowercase letters, digits, hyphens and must begin with a letter. A plan is computed in deterministic lexicographic task order, with dependencies only satisfied by earlier waves.

Compile and test on Linux with a C++20 compiler:

```sh
mkdir -p build
c++ -std=c++20 -O2 -Wall -Wextra -Wpedantic -Werror -Iinclude src/forgecore.cpp src/main.cpp -o build/forgecore
c++ -std=c++20 -O2 -Wall -Wextra -Wpedantic -Werror -Iinclude src/forgecore.cpp tests/test_core.cpp -o build/forgecore-tests
./build/forgecore-tests
./build/forgecore fixtures/production-like-demo.tsv 2 256
```

No external dependencies, Docker, network, database or cloud account. The sample is synthetic. This is scheduling simulation, **not actual task execution or a production distributed scheduler**. No Rust, WebAssembly or C ABI integration exists yet. Validation by a Linux compiler does not mean a Windows native build has been tested.
