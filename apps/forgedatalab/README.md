# ForgeDataLab — Reproducible Telemetry Analysis

A working, no-dependency Python + SQLite analytics pipeline. It validates every CSV record before creating its report, detects duplicate observations, enforces sensible ranges, calculates language-level test pass rates and nearest-rank p95 durations, and writes a SHA-256 input digest for reproducibility.

```powershell
cd apps/forgedatalab
python -m unittest discover -s tests -v
python src/pipeline.py fixtures/synthetic_benchmark_telemetry.csv report.json
```

The included data is **synthetic** and not evidence that the listed language toolchains, projects or tests have actually been run. No R, Bash or C++ integration is implemented yet.

Next: schema-version migrations, property tests, DuckDB support, R statistical scripts, real benchmark ingestion, and CI integration.
