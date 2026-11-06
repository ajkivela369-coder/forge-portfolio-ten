import { createHash } from "node:crypto";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { sortTasks } from "./task-spec.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const taskDir = join(root, "tasks");
const tasks = sortTasks(readdirSync(taskDir).filter(f => f.endsWith(".json")).sort()
  .map(f => JSON.parse(readFileSync(join(taskDir, f), "utf8"))));
const command = process.argv[2] || "tasks";

if (command === "tasks") {
  for (const task of tasks) console.log(`${task.id}: ${task.title} [after: ${task.depends_on.join(", ") || "none"}]`);
} else if (command === "score") {
  // This runner executes repository source code. Run only trusted local worktrees, never unknown submissions.
  const name = process.argv[3] || "all";
  const selected = name === "all" ? tasks : tasks.filter(task => task.id === name);
  if (!selected.length) { console.error("Unknown task: " + name); process.exitCode = 2; }
  else {
    const suites = name === "all" ? readdirSync(join(root, "tests")).filter(f => f.endsWith(".test.mjs")).map(f => "tests/" + f)
      : [...new Set(selected.map(task => task.suite))];
    const args = ["--test", "--test-reporter=tap", ...suites];
    const run = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000 });
    const output = (run.stdout || "") + (run.stderr || "");
    const count = key => Number(output.match(new RegExp("^# " + key + " (\\d+)$", "m"))?.[1] ?? 0);
    const digest = createHash("sha256");
    for (const suite of suites.sort()) {
      digest.update(suite);
      digest.update(readFileSync(join(root, suite)));
    }
    const result = {
      schema: "forgebench-swe-evaluation-v1", tasks: selected.map(t => t.id),
      suites, node: process.version, platform: process.platform,
      test_suite_sha256: digest.digest("hex"),
      exit_code: run.status, timed_out: run.error?.code === "ETIMEDOUT",
      tests: count("tests"), pass: count("pass"), fail: count("fail"), skip: count("skipped"),
      verdict: run.status === 0 && count("tests") > 0 ? "PASS" : "FAIL",
      warning: "Trusted local code only; passing this self-test is not independent or sealed evaluation."
    };
    mkdirSync(join(root, "reports"), { recursive: true });
    writeFileSync(join(root, "reports", "latest.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
    if (result.verdict !== "PASS") { console.error(output.slice(-5000)); process.exitCode = 1; }
  }
} else { console.error("Use: tasks | score [task-id|all]"); process.exitCode = 2; }
