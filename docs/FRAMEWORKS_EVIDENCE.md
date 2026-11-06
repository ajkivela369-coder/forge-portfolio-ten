# Evaluation framework compatibility and evidence classification

This page distinguishes **working read-only adapters**, **original local evaluation**, and **unverified products**. No official benchmark scores have been obtained.

| External tool/framework | What was implemented here | Evidence classification |
| --- | --- | --- |
| SWE-bench / SWE-bench Lite | Metadata and predictions contract, JSONL export, duplicate and field checks, fictional sample | **Adapter tested locally**; no official SWE-bench harness or GitHub issues run |
| HumanEval | Normalize fields; hash and omit test body and canonical reference from projected metadata | **Adapter tested locally**; no HumanEval dataset evaluation |
| MBPP | Normalize task text, test count and hash, omit raw reference code from projection | **Adapter tested locally**; no MBPP dataset evaluation |
| Harbor | Source documentation and registry reference; original trajectory schema for ForgeBench | **Researched only**; no Harbor CLI, task import or external rollout |
| RL-EvalBench v2 | Name cataloged, exact product identity unresolved | **Not verified** |
| AgentDocker-Harness | Name cataloged, exact product identity unresolved | **Not verified** |
| PromptGrade Agent Harness | Name cataloged, exact product identity unresolved | **Not verified** |
| Modal | Optional cloud execution provider studied, no cloud setup | **Reference only** |
| E2B | Optional execution provider studied, no cloud setup | **Reference only** |
| Custom ForgeBench SWE | Trusted local red/green fixture, three sequential tasks, public tests, hashes, trajectory | **Directly implemented and tested locally** |

## Original evidence

- `apps/forgebench/tests/frameworks.test.mjs`
- `apps/forgebench/tests/adapter-demo.test.mjs`
- `apps/forgebench/tests/red-green.test.mjs`
- `apps/forgebench/reports/red-green.json` (generated, gitignored)
- `apps/forgebench/reports/trajectory-local.json` (generated, gitignored)

## Reference specifications

- SWE-bench prediction JSONL fields: https://www.swebench.com/SWE-bench/guides/evaluation/
- HumanEval dataset fields: https://huggingface.co/datasets/openai/openai_humaneval
- Harbor reference: https://github.com/harbor-framework/docs/blob/main/guides/running-evaluations.mdx

No official dataset downloads, Docker images, external credentials or paid cloud resources are needed to reproduce the current local tests.
