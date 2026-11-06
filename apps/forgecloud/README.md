# ForgeCloud — Local Release Planning & Rollback Policy

**Current implementation:** A working Python dry-run release planner. A future stack may include C#, .NET, Terraform, Kubernetes, and a UI, but **none of those have been implemented or tested here**.

The planner reads a small JSON manifest and builds a deterministic dependency-ordered release plan and reverse rollback plan. It fails closed on unpinned artifact digests, public exposure, nonzero external costs, unknown services, dependency cycles, unexpected keys, and excessive resource declarations.

It **does not** deploy, run containers, change cloud resources, call APIs, or claim that artifact hashes represent actual built artifacts. Included digests are synthetic fixtures.

Run with Python 3.12+:
```powershell
cd apps/forgecloud
python -m unittest discover -s tests -v
python src/release_planner.py fixtures/synthetic-preview-manifest.json reports/plan.json
```

The output is a policy/ordering report, not a deployment receipt. No external credits, credentials, or paid cloud accounts are required. Next: independently verified artifact signature checks, dry-run against real ForgeHost release manifests, a reversible deployment adapter with explicit authorization, and .NET/C# implementation if the toolchain is installed.
