/** Demonstrate structural data adapters against authored synthetic samples.
 * Emits metadata and synthetic predictions only, NEVER scores official benchmarks.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeSWEInstance, serializeSWEPredictions, normalizeHumanEval, normalizeMBPP } from "./frameworks.mjs";
import { FRAMEWORKS } from "./registry.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, "fixtures", "compatibility", "synthetic-records.json");
const sha = text => createHash("sha256").update(text).digest("hex");

export function evaluateSyntheticAdapters({ persist = false } = {}) {
  const raw = readFileSync(fixture, "utf8");
  const example = JSON.parse(raw);
  const instance = normalizeSWEInstance(example.swe_instance);
  const predictionJSONL = serializeSWEPredictions([example.swe_prediction]);
  const humanEval = normalizeHumanEval(example.humaneval);
  const mbpp = normalizeMBPP(example.mbpp);
  const report = {
    schema: "forge-framework-structural-demo-v1",
    sample_type: "synthetic_fictional_not_official_dataset",
    input_sha256: sha(raw),
    swe_bench: { ...instance, prediction_count: predictionJSONL.trim().split("\n").length,
      predictions_sha256: sha(predictionJSONL), official_run: false },
    humaneval: humanEval,
    mbpp,
    framework_registry: FRAMEWORKS.map(x => ({ id: x.id, status: x.status, official_run: x.official_run })),
    official_benchmark_score: null,
    warning: "Data normalization and export only; never submit this fictional prediction to a leaderboard.",
  };
  if (persist) {
    const folder = join(root, "reports");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "synthetic-swe-predictions.jsonl"), predictionJSONL);
    writeFileSync(join(folder, "adapter-demo.json"), JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  console.log(JSON.stringify(evaluateSyntheticAdapters({ persist: true }), null, 2));
}
