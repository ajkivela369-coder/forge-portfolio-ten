import copy
import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from release_planner import ReleasePlanError, run, validate_and_plan

SOURCE = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic-preview-manifest.json"


class ReleasePlannerTests(unittest.TestCase):
    def setUp(self):
        self.doc = json.loads(SOURCE.read_text(encoding="utf-8"))

    def test_dependency_order_and_reverse_rollback(self):
        plan = validate_and_plan(self.doc)
        self.assertEqual([x["service"] for x in plan["release_order"]], ["data-service", "api-service"])
        self.assertEqual([x["service"] for x in plan["rollback_order"]], ["api-service", "data-service"])
        self.assertFalse(plan["deployments_executed"])

    def test_deterministic_report_if_manifest_order_changes(self):
        other = copy.deepcopy(self.doc)
        other["services"].reverse()
        self.assertEqual(validate_and_plan(self.doc), validate_and_plan(other))

    def test_requires_immutable_artifacts(self):
        self.doc["services"][0]["artifact_digest"] = "latest"
        with self.assertRaisesRegex(ReleasePlanError, "immutable"):
            validate_and_plan(self.doc)

    def test_denies_public_exposure(self):
        self.doc["services"][0]["exposure"] = "public"
        with self.assertRaisesRegex(ReleasePlanError, "public"):
            validate_and_plan(self.doc)

    def test_denies_nonzero_external_cost(self):
        self.doc["estimated_monthly_external_cost_usd"] = 0.01
        with self.assertRaisesRegex(ReleasePlanError, "zero"):
            validate_and_plan(self.doc)

    def test_denies_unknown_dependency(self):
        self.doc["services"][0]["depends_on"] = ["missing-service"]
        with self.assertRaisesRegex(ReleasePlanError, "Unknown"):
            validate_and_plan(self.doc)

    def test_denies_dependency_cycles(self):
        self.doc["services"][1]["depends_on"] = ["api-service"]
        with self.assertRaisesRegex(ReleasePlanError, "cycle"):
            validate_and_plan(self.doc)

    def test_denies_duplicate_names(self):
        self.doc["services"][1]["name"] = "api-service"
        with self.assertRaisesRegex(ReleasePlanError, "Duplicate"):
            validate_and_plan(self.doc)

    def test_denies_secret_injection_extra_keys(self):
        self.doc["services"][0]["api_key"] = "SENSITIVE_VALUE"
        with self.assertRaisesRegex(ReleasePlanError, "keys"):
            validate_and_plan(self.doc)

    def test_enforces_memory_budgets(self):
        self.doc["services"][0]["memory_mb"] = 9000
        with self.assertRaisesRegex(ReleasePlanError, "memory"):
            validate_and_plan(self.doc)

    def test_writes_no_output_for_invalid_configuration(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "manifest.json"
            out = root / "report.json"
            self.doc["environment"] = "production"
            source.write_text(json.dumps(self.doc), encoding="utf-8")
            with self.assertRaises(ReleasePlanError):
                run(source, out)
            self.assertFalse(out.exists())

    def test_report_is_reproducible_for_valid_synthetic_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            a, b = Path(td) / "a.json", Path(td) / "b.json"
            first, second = run(SOURCE, a), run(SOURCE, b)
            self.assertEqual(first, second)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            self.assertEqual(len(first["source_manifest_sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
