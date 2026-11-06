# ForgeML — Pairwise Preference Baseline (Public Synthetic Fixture)

A **working pure-Python** pairwise logistic ranking baseline and evaluation protocol. It uses three candidate features (test pass rate, latency and security findings) to learn relative preferences. It validates training/dev/test split integrity and stores SHA-256 hashes of the training records and input dataset.

This small baseline deliberately does **not** use PyTorch, train a frontier model, establish production readiness, or touch the unrelated ForgeMind preference-ranker experiments.

```powershell
cd apps/forgeml
python -m unittest discover -s tests -v
python src/pairwise_baseline.py fixtures/synthetic_preferences.json reports/baseline.json
```

The example dataset contains 10 synthetic pairwise comparisons (six training, two development, two public test). Demonstration results must not be described as sealed or real-world generalization.

**Next:** Optional PyTorch CPU backend after checking dependencies and disk budget; more realistic datasets; calibration tests; regularization study; confidence intervals; sealed evaluation protocol in a separate evidence workspace.
