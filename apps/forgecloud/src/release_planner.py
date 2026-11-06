"""ForgeCloud local-first release dependency and rollback planner.

This is an offline, fail-closed *plan generator*. It never runs deployments.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
NAME = re.compile(r"^[a-z][a-z0-9-]{1,49}$")
TOP_LEVEL = {"schema", "environment", "estimated_monthly_external_cost_usd", "services"}
SERVICE_KEYS = {"name", "artifact_digest", "rollback_digest", "depends_on", "exposure", "memory_mb"}


class ReleasePlanError(ValueError):
    """Deployment manifest failed safety and reproducibility checks."""


def _allowed(value, allowed, what):
    if not isinstance(value, dict) or set(value) != allowed:
        raise ReleasePlanError(f"{what}: unexpected or missing keys")


def validate_and_plan(manifest: dict) -> dict:
    _allowed(manifest, TOP_LEVEL, "manifest")
    if manifest["schema"] != "forgecloud-release-v1":
        raise ReleasePlanError("Unsupported schema")
    if manifest["environment"] not in ("local", "preview"):
        raise ReleasePlanError("Only local or preview plans are accepted")
    price = manifest["estimated_monthly_external_cost_usd"]
    if type(price) not in (int, float) or price != 0:
        raise ReleasePlanError("External cost must be exactly zero")
    services = manifest["services"]
    if not isinstance(services, list) or not 1 <= len(services) <= 30:
        raise ReleasePlanError("Expected 1–30 services")
    lookup = {}
    for service in services:
        _allowed(service, SERVICE_KEYS, "service")
        name = service["name"]
        if not isinstance(name, str) or not NAME.fullmatch(name) or name in lookup:
            raise ReleasePlanError("Duplicate/invalid service name")
        if not isinstance(service["artifact_digest"], str) or not DIGEST.fullmatch(service["artifact_digest"]):
            raise ReleasePlanError(f"{name}: immutable artifact digest required")
        if not isinstance(service["rollback_digest"], str) or not DIGEST.fullmatch(service["rollback_digest"]):
            raise ReleasePlanError(f"{name}: immutable rollback digest required")
        if service["exposure"] not in ("loopback", "private"):
            raise ReleasePlanError(f"{name}: public exposure is not permitted")
        if type(service["memory_mb"]) is not int or not 32 <= service["memory_mb"] <= 2048:
            raise ReleasePlanError(f"{name}: memory outside allowed budget")
        depends = service["depends_on"]
        if not isinstance(depends, list) or len(depends) != len(set(map(str, depends))) or any(
            not isinstance(dep, str) or not NAME.fullmatch(dep) for dep in depends
        ):
            raise ReleasePlanError(f"{name}: invalid dependencies")
        lookup[name] = service
    if sum(service["memory_mb"] for service in services) > 4096:
        raise ReleasePlanError("Total declared memory exceeds 4096 MB local budget")

    visiting, completed, ordered = set(), set(), []

    def visit(name):
        if name in completed:
            return
        if name in visiting:
            raise ReleasePlanError(f"Dependency cycle involving {name}")
        if name not in lookup:
            raise ReleasePlanError(f"Unknown dependency: {name}")
        visiting.add(name)
        for dep in sorted(lookup[name]["depends_on"]):
            visit(dep)
        visiting.remove(name)
        completed.add(name)
        ordered.append(name)

    for name in sorted(lookup):
        visit(name)

    canonical = {"schema": manifest["schema"], "environment": manifest["environment"],
                 "estimated_monthly_external_cost_usd": 0,
                 "services": [lookup[name] for name in sorted(lookup)]}
    digest = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "schema": "forgecloud-dry-run-report-v1",
        "source_manifest_sha256": digest,
        "environment": manifest["environment"],
        "status": "PLAN_ONLY_NO_DEPLOYMENT",
        "deployments_executed": False,
        "cost_usd": 0,
        "release_order": [{"service": name, "artifact_digest": lookup[name]["artifact_digest"]}
                          for name in ordered],
        "rollback_order": [{"service": name, "artifact_digest": lookup[name]["rollback_digest"]}
                           for name in reversed(ordered)],
        "memory_declared_mb": sum(x["memory_mb"] for x in services),
        "security_note": "This is a local policy/ordering validator. No containers or deployments ran.",
    }


def run(manifest_path: Path, output_path: Path) -> dict:
    source = Path(manifest_path)
    report = validate_and_plan(json.loads(source.read_text(encoding="utf-8")))
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest_json", type=Path)
    parser.add_argument("report_json", type=Path)
    args = parser.parse_args()
    print(json.dumps(run(args.manifest_json, args.report_json), indent=2))
