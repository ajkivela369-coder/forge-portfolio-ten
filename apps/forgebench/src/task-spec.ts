/** Deterministic benchmark task dependency validation, using Node 24 native TypeScript stripping. */
export interface BenchmarkTask {
  id: string;
  title: string;
  brief: string;
  depends_on: string[];
  acceptance: string[];
  suite: string;
}

export function sortTasks(tasks: BenchmarkTask[]): BenchmarkTask[] {
  const map = new Map<string, BenchmarkTask>();
  for (const task of tasks) {
    if (!/^task-\d{2}-[a-z0-9-]+$/.test(task.id)) throw new Error("invalid task ID: " + task.id);
    if (map.has(task.id)) throw new Error("duplicate task ID: " + task.id);
    if (!task.title || !task.brief || !Array.isArray(task.acceptance) || task.acceptance.length === 0 ||
        !Array.isArray(task.depends_on) || !/^tests\/[a-z0-9.-]+\.test\.mjs$/.test(task.suite))
      throw new Error("invalid task spec: " + task.id);
    map.set(task.id, task);
  }

  const visiting = new Set<string>();
  const completed = new Set<string>();
  const sorted: BenchmarkTask[] = [];
  function visit(id: string): void {
    if (completed.has(id)) return;
    if (visiting.has(id)) throw new Error("dependency cycle involving " + id);
    const task = map.get(id);
    if (!task) throw new Error("unknown dependency: " + id);
    visiting.add(id);
    for (const dep of task.depends_on) visit(dep);
    visiting.delete(id);
    completed.add(id);
    sorted.push(task);
  }
  for (const id of [...map.keys()].sort()) visit(id);
  return sorted;
}
