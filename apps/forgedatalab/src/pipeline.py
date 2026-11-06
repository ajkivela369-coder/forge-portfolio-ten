"""Reproducible CSV -> SQLite benchmark telemetry analytics. Standard library only."""
from __future__ import annotations

import csv
import hashlib
import json
import math
import sqlite3
from pathlib import Path

REQUIRED = ("event_id", "language", "project", "tests", "passed", "duration_ms")


class DataQualityError(ValueError):
    """Invalid or inconsistent benchmark telemetry."""


def read_validated(csv_path: str | Path) -> list[tuple[str, str, str, int, int, int]]:
    seen: set[str] = set()
    records: list[tuple[str, str, str, int, int, int]] = []
    with Path(csv_path).open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames or any(name not in reader.fieldnames for name in REQUIRED):
            raise DataQualityError("CSV must contain: " + ", ".join(REQUIRED))
        for row_number, row in enumerate(reader, 2):
            try:
                uid, lang, project = (row[field].strip() for field in REQUIRED[:3])
                if not uid or not lang or not project or any(len(x) > 100 for x in (uid, lang, project)):
                    raise ValueError("missing/oversized text field")
                tests, passed, duration = (int(row[key]) for key in REQUIRED[3:])
                if tests < 1 or not 0 <= passed <= tests or duration < 0:
                    raise ValueError("out-of-range count/duration")
                if uid in seen:
                    raise ValueError("duplicate event_id")
            except (TypeError, ValueError, AttributeError) as err:
                raise DataQualityError(f"row {row_number}: {err}") from err
            seen.add(uid)
            records.append((uid, lang, project, tests, passed, duration))
    if not records:
        raise DataQualityError("CSV has no data rows")
    return records


def summarize(csv_path: str | Path) -> dict:
    source = Path(csv_path)
    records = read_validated(source)  # validate the entire input BEFORE writing any output
    with sqlite3.connect(":memory:") as db:
        db.execute("""CREATE TABLE observations (
            event_id TEXT PRIMARY KEY, language TEXT NOT NULL,
            project TEXT NOT NULL, tests INTEGER NOT NULL,
            passed INTEGER NOT NULL, duration_ms INTEGER NOT NULL
        )""")
        db.executemany("INSERT INTO observations VALUES (?,?,?,?,?,?)", records)
        query = """SELECT language, COUNT(*), SUM(tests), SUM(passed)
                   FROM observations GROUP BY language ORDER BY language COLLATE NOCASE"""
        summary = []
        for lang, runs, tests, passed in db.execute(query).fetchall():
            durations = [r[0] for r in db.execute(
                "SELECT duration_ms FROM observations WHERE language=? ORDER BY duration_ms", (lang,))]
            idx = math.ceil(0.95 * len(durations)) - 1
            summary.append({
                "language": lang, "runs": runs, "tests": tests, "passed": passed,
                "pass_rate": round(passed / tests, 6),
                "p95_duration_ms_nearest_rank": durations[idx],
            })
    return {
        "schema": "forge-datalab-telemetry-v1",
        "input_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "records": len(records), "languages": summary,
        "note": "Synthetic example dataset. Pass rate describes tests passed, not model accuracy."
    }


def run(csv_path: str | Path, json_path: str | Path) -> dict:
    report = summarize(csv_path)
    Path(json_path).parent.mkdir(parents=True, exist_ok=True)
    Path(json_path).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_csv", type=Path)
    parser.add_argument("output_json", type=Path)
    options = parser.parse_args()
    print(json.dumps(run(options.input_csv, options.output_json), indent=2))
