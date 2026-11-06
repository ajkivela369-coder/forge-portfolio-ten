"""Unit tests for deterministic, fail-closed input analytics."""
import tempfile
import unittest
from pathlib import Path
from sys import path

path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pipeline import DataQualityError, run, summarize  # noqa: E402

HEADER = "event_id,language,project,tests,passed,duration_ms\n"


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.csv = self.root / "input.csv"

    def write(self, text):
        self.csv.write_text(HEADER + text, encoding="utf-8")

    def test_grouped_results_and_p95(self):
        self.write("a,Python,ForgeML,10,8,100\nb,Python,ForgeML,10,10,500\nc,Go,ForgeMesh,4,4,10\n")
        data = summarize(self.csv)
        self.assertEqual(data["records"], 3)
        self.assertEqual(data["languages"][0]["language"], "Go")
        self.assertEqual(data["languages"][1]["pass_rate"], 0.9)
        self.assertEqual(data["languages"][1]["p95_duration_ms_nearest_rank"], 500)

    def test_rejects_more_passed_than_tests(self):
        self.write("a,Python,ForgeML,2,3,100\n")
        with self.assertRaises(DataQualityError):
            summarize(self.csv)

    def test_rejects_duplicates(self):
        self.write("a,Python,ForgeML,2,2,100\na,Go,ForgeMesh,4,4,30\n")
        with self.assertRaises(DataQualityError):
            summarize(self.csv)

    def test_rejects_invalid_integer(self):
        self.write("a,R,ForgeDataLab,not-a-number,2,10\n")
        with self.assertRaises(DataQualityError):
            summarize(self.csv)

    def test_rejects_empty_data(self):
        self.write("")
        with self.assertRaises(DataQualityError):
            summarize(self.csv)

    def test_validated_output_is_reproducible(self):
        self.write("a,Python,ForgeML,1,1,11\n")
        one = self.root / "one.json"
        two = self.root / "two.json"
        self.assertEqual(run(self.csv, one), run(self.csv, two))
        self.assertEqual(one.read_bytes(), two.read_bytes())
        self.assertEqual(len(run(self.csv, one)["input_sha256"]), 64)

    def test_invalid_input_never_writes_output(self):
        self.write("a,Python,ForgeML,0,0,10\n")
        output = self.root / "no-report.json"
        with self.assertRaises(DataQualityError):
            run(self.csv, output)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
