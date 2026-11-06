# Forge Studio 10-project portfolio — verified checkpoint (2026-11-05 local date)

## Objective
Ten original, substantive GitHub-ready engineering projects spanning mainstream languages, with special priority on software engineering benchmark development for Terac-like roles.

## Recovered work / preservation
- GFC health returned healthy v4.1.2-remote.1004 on Windows 11.
- Existing `forge-ai-showcase` on main was clean at inspection.
- Existing `aj-forge-portfolio-evaluation-20261009` had pre-existing changes to App.tsx and an untracked EliasCopilot.tsx; untouched.
- Existing `forgemind-model02-evidencechoice-v1-20261102` has many untracked neural/preference-ranking artifacts; untouched.
- Existing ForgeMind ForgeBench v0.11 is a *model evaluation acceptance cohort*, not this SWE benchmark project, and has spent/sealed prior cohorts. No existing benchmark evidence was reused or relabeled.

## Created in isolated workspace
`C:\Users\user\ForgeRepo\forge-portfolio-ten-20261105`

1. `apps/forgebench` — Node.js + SQLite HTTP job service with per-client rate limiting, durable idempotency, real HTTP tests, TypeScript task-graph validator, two dependent backlog tasks and benchmark CLI.
2. `apps/forgedatalab` — deterministic CSV-to-SQLite analytics with validation, group reports, p95 durations, file input SHA256, synthetic input and unit tests.
3. Root manifest, README, local CI workflow and gitignore.

## Actually executed on laptop
- Node v24.19.0: `node --test` — **15 passed / 0 failed**.
- Node v24.19.0: `node src/cli.mjs score` — PASS, 15 tests. Tests are public/local, **not** hidden/sealed.
- Python 3.12.10: `python -m unittest discover -s tests -v` — **7 passed / 0 failed**.
- Python 3.12.10: pipeline processed 6 synthetic rows and generated report with input hash.
- Git available v2.55.0.windows.3. No remote push, production deploy or external GitHub repositories created.

## Toolchain gaps / caution
- Go, Rust, Cargo, C/C++, JDK, .NET, Docker, Ruby, Swift, Kotlin, Dart/Flutter, R not detected in PATH.
- PyTorch not installed in this Python environment.
- PHP binary found in WinGet package, but running it via GFC requires a one-time executable approval; no bypass attempted.
- Software benchmark runner is **trusted local only**. Untrusted submissions need container/process isolation, quotas and network restrictions before use.
- ForgeBench uses demo x-client-id, **not authentication**, and must not be Internet-exposed.
- GitHub Actions workflow created but not run on GitHub (no push).

## Next safe step
1. Build ForgeBench baseline/starter state plus paired red/green tests for sequential API tasks; add an isolated test runner suitable for untrusted candidate code.
2. Add TypeScript/React task authoring UI and Playwright tests **after** a reviewed local design exists; do not buy hosted design credits.
3. Decide which ForgeML baseline can be implemented with installed tooling before installing PyTorch.
4. Install missing toolchains only after checking workstation storage and explicit choices; keep each project as an independently extractable repo.
5. Inspect git diff/status and perform a separate publication/security review before any remote push.

## Final local verification (2026-11-05 / 2026-11-06 UTC)
- Expanded ForgeBench from 12 to **15 passing Node tests** after adding native TypeScript task graph validation, cycle and missing-dependency checks.
- ForgeDataLab: **7 passing Python tests**, synthetic pipeline produced six-row summary.
- ForgeBench loopback server successfully started and logged `127.0.0.1:4731`, then was stopped; no public deployment.
- Initialized a fresh local Git repository in this isolated workspace on `main`, with **zero commits**. No remotes, pushes, or GitHub repositories were created.
- Current totals: **22/22 local tests passing**, 2 of 10 prototype projects implemented; 8 planned.
