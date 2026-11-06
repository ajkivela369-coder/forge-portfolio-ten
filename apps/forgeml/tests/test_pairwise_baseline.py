import copy
import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pairwise_baseline import (DatasetError, evaluate, fit, run, validate_records)

DATA = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic_preferences.json"


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(DATA.read_text(encoding="utf-8"))

    def test_training_is_deterministic_and_sorted(self):
        records = validate_records(self.data)
        shuffled = validate_records(list(reversed(self.data)))
        self.assertEqual(fit(records), fit(shuffled))

    def test_model_train_count_uses_only_train_records(self):
        model = fit(validate_records(self.data))
        self.assertEqual(model["train_count"], 6)
        self.assertEqual(len(model["train_sha256"]), 64)

    def test_dev_and_test_fixture_are_not_optimizer_inputs(self):
        data1 = validate_records(self.data)
        modified = copy.deepcopy(self.data)
        modified[-1]["winner"] = "left"
        modified[-2]["winner"] = "right"
        modified[-3]["winner"] = "left"
        self.assertEqual(fit(data1), fit(validate_records(modified)))

    def test_leakage_between_splits_rejected(self):
        other = copy.deepcopy(self.data[0])
        other["pair_id"] = "dev-99"
        other["split"] = "dev"
        with self.assertRaisesRegex(DatasetError, "leakage"):
            validate_records(self.data + [other])

    def test_duplicate_pair_id_rejected(self):
        with self.assertRaisesRegex(DatasetError, "pair_id"):
            validate_records(self.data + [self.data[0]])

    def test_out_of_range_and_nan_rejected(self):
        modified = copy.deepcopy(self.data)
        modified[0]["left"]["tests_pass_rate"] = 2.0
        with self.assertRaises(DatasetError):
            validate_records(modified)
        modified = copy.deepcopy(self.data)
        modified[0]["left"]["latency_ms"] = float("nan")
        with self.assertRaises(DatasetError):
            validate_records(modified)

    def test_empty_training_and_missing_dev_rejected(self):
        with self.assertRaises(DatasetError):
            validate_records([r for r in self.data if r["split"] != "train"])
        with self.assertRaises(DatasetError):
            validate_records([r for r in self.data if r["split"] != "dev"])

    def test_evaluation_is_bounded_and_public_only(self):
        records = validate_records(self.data)
        model = fit(records)
        dev = evaluate(records, model, "dev")
        self.assertEqual(dev["count"], 2)
        self.assertGreaterEqual(dev["accuracy"], 0)
        self.assertLessEqual(dev["accuracy"], 1)
        with self.assertRaises(ValueError):
            evaluate(records, model, "train")

    def test_report_is_reproducible_and_no_promotion_claim(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "a.json"
            second = Path(directory) / "b.json"
            one = run(DATA, first)
            self.assertEqual(one, run(DATA, second))
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertFalse(one["promotion_ready"])
            self.assertEqual(one["public_test_fixture"]["count"], 2)


if __name__ == "__main__":
    unittest.main()
