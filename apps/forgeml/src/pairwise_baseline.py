"""Deterministic pure-Python pairwise logistic baseline with split leakage guard.

A small educational research implementation; not the installed ForgeMind model and
not PyTorch training. Test/dev data never influence model fitting.
"""
from __future__ import annotations
from hashlib import sha256
import json
import math
from pathlib import Path

FEATURES = ("tests_pass_rate", "latency_ms", "security_findings")
SCALES = (1.0, 1000.0, 5.0)
SPLITS = ("train", "dev", "test")


class DatasetError(ValueError):
    pass


def _finite_number(value, field):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise DatasetError(f"{field} must be finite numeric")
    return float(value)


def _vector(candidate):
    if not isinstance(candidate, dict) or any(f not in candidate for f in FEATURES):
        raise DatasetError("Candidate missing feature")
    rate = _finite_number(candidate["tests_pass_rate"], "tests_pass_rate")
    latency = _finite_number(candidate["latency_ms"], "latency_ms")
    security = _finite_number(candidate["security_findings"], "security_findings")
    if not 0 <= rate <= 1 or not 0 <= latency <= 1_000_000 or not 0 <= security <= 100:
        raise DatasetError("Out-of-range candidate features")
    return (rate, latency / 1000.0, security / 5.0)


def validate_records(raw):
    if not isinstance(raw, list) or not raw:
        raise DatasetError("Expected nonempty list of preference comparisons")
    seen_pairs = set()
    task_splits = {}
    records = []
    for index, row in enumerate(raw):
        if not isinstance(row, dict):
            raise DatasetError(f"Row {index} is not an object")
        pair_id, task_id, split, winner = (row.get(k) for k in ("pair_id", "task_id", "split", "winner"))
        if not isinstance(pair_id, str) or not pair_id.strip() or len(pair_id) > 120 or pair_id in seen_pairs:
            raise DatasetError(f"Duplicate/invalid pair_id at row {index}")
        if not isinstance(task_id, str) or not task_id.strip() or len(task_id) > 120:
            raise DatasetError(f"Invalid task_id at row {index}")
        if split not in SPLITS or winner not in ("left", "right"):
            raise DatasetError(f"Invalid split/winner at row {index}")
        if task_id in task_splits and task_splits[task_id] != split:
            raise DatasetError(f"Task leakage across splits: {task_id}")
        a, b = _vector(row.get("left")), _vector(row.get("right"))
        if a == b:
            raise DatasetError(f"Identical feature vectors at row {index}")
        task_splits[task_id] = split
        seen_pairs.add(pair_id)
        records.append({"pair_id": pair_id, "task_id": task_id, "split": split,
                        "winner": winner, "delta": tuple(x-y for x,y in zip(a,b))})
    if not any(r["split"] == "train" for r in records):
        raise DatasetError("A training split is required")
    if not any(r["split"] == "dev" for r in records):
        raise DatasetError("A development split is required")
    return records


def _sigmoid(x):
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


def fit(records, epochs=100, learning_rate=0.15, l2=0.01):
    if not isinstance(epochs, int) or not 1 <= epochs <= 10_000:
        raise ValueError("epochs must be integer 1..10000")
    if not 0 < learning_rate <= 1 or not 0 <= l2 <= 1:
        raise ValueError("Invalid optimizer settings")
    train = [row for row in records if row["split"] == "train"]
    if not train:
        raise DatasetError("Missing training records")
    # Sorted order makes the model fully deterministic independent of input row order.
    train.sort(key=lambda r: r["pair_id"])
    weights = [0.0, 0.0, 0.0]
    for _ in range(epochs):
        for row in train:
            x = row["delta"]
            correct = 1.0 if row["winner"] == "left" else 0.0
            prediction = _sigmoid(sum(w*v for w,v in zip(weights,x)))
            for j in range(len(weights)):
                weights[j] -= learning_rate * ((prediction - correct) * x[j] + l2 * weights[j])
    snapshot = [{k: r[k] for k in ("pair_id", "task_id", "split", "winner")} |
                {"delta": r["delta"]} for r in train]
    evidence_hash = sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
    return {"kind": "pure_python_pairwise_logistic", "weights": weights,
            "features": list(FEATURES), "train_count": len(train),
            "train_sha256": evidence_hash, "epochs": epochs}


def evaluate(records, model, split="dev"):
    if split not in ("dev", "test"):
        raise ValueError("Only dev or public test fixture evaluation permitted")
    selected = [row for row in records if row["split"] == split]
    if not selected:
        return {"split": split, "count": 0, "accuracy": None}
    weights = model["weights"]
    correct = sum(1 for r in selected if
                  ("left" if sum(w*v for w,v in zip(weights, r["delta"])) >= 0 else "right") == r["winner"])
    return {"split": split, "count": len(selected), "correct": correct,
            "accuracy": round(correct / len(selected), 6)}


def run(input_path, output_path):
    source = Path(input_path)
    raw = json.loads(source.read_text(encoding="utf-8"))
    records = validate_records(raw)
    model = fit(records)
    report = {
        "schema": "forge-ml-pairwise-baseline-v1", "dataset_kind": "synthetic_public_fixture",
        "source_sha256": sha256(source.read_bytes()).hexdigest(), "model": model,
        "development": evaluate(records, model, "dev"),
        "public_test_fixture": evaluate(records, model, "test"),
        "promotion_ready": False,
        "disclaimer": "Local educational baseline, not PyTorch/ForgeMind or sealed external evaluation",
    }
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset_json", type=Path)
    parser.add_argument("report_json", type=Path)
    options = parser.parse_args()
    print(json.dumps(run(options.dataset_json, options.report_json), indent=2))
