import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBenchService } from "../src/engine.mjs";

const h = (client = "team_01", key = "test-key-0001") => ({ "x-client-id": client, "idempotency-key": key });
const post = (service, headers = h(), body = { task: "Repair timeout handling" }) =>
  service.handle({ method: "POST", path: "/v1/jobs", headers, body });
const get = (service, path = "/v1/jobs", headers = h()) => service.handle({ method: "GET", path, headers });

test("task-01: health probes remain accessible without client ID", () => {
  const s = createBenchService({ maxRequests: 1 });
  try { assert.equal(get(s, "/health", {}).status, 200); assert.equal(get(s, "/health", {}).status, 200); }
  finally { s.close(); }
});

test("task-01: rejects unknown client and rejects illegal client identifiers", () => {
  const s = createBenchService();
  try {
    assert.equal(get(s, "/v1/jobs", {}).status, 401);
    assert.equal(get(s, "/v1/jobs", { "x-client-id": "../traversal" }).status, 401);
  } finally { s.close(); }
});

test("task-01: rate limit is isolated by client and resets after window", () => {
  let t = 0;
  const s = createBenchService({ now: () => t, maxRequests: 2, windowMs: 1000 });
  try {
    assert.equal(get(s).status, 200);
    assert.equal(get(s).status, 200);
    const blocked = get(s);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers["retry-after"], "1");
    assert.equal(get(s, "/v1/jobs", h("team_02")).status, 200);
    t = 1000;
    assert.equal(get(s).status, 200);
  } finally { s.close(); }
});

test("task-02: returns same job on retry without duplication", () => {
  const s = createBenchService();
  try {
    const created = post(s);
    const repeated = post(s);
    assert.equal(created.status, 201);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.headers["idempotency-replayed"], "true");
    assert.equal(repeated.body.id, created.body.id);
    assert.equal(get(s).body.jobs.length, 1);
    assert.equal(get(s, "/v1/jobs/" + created.body.id).status, 200);
  } finally { s.close(); }
});

test("task-02: idempotency-key reuse with different payload returns 409", () => {
  const s = createBenchService();
  try {
    assert.equal(post(s).status, 201);
    assert.equal(post(s, h(), { task: "Different task" }).status, 409);
    assert.equal(get(s).body.jobs.length, 1);
  } finally { s.close(); }
});

test("task-02: same idempotency-key is independent across client IDs", () => {
  const s = createBenchService();
  try {
    const a = post(s, h("team_01"));
    const b = post(s, h("team_02"));
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.id, b.body.id);
    assert.equal(get(s, "/v1/jobs/" + a.body.id, h("team_02")).status, 404);
  } finally { s.close(); }
});

test("task-02: data and replay survive service restart using SQLite file", () => {
  const dir = mkdtempSync(join(tmpdir(), "forgebench-"));
  const path = join(dir, "data.sqlite");
  try {
    const s1 = createBenchService({ dbPath: path });
    const first = post(s1);
    s1.close();
    const s2 = createBenchService({ dbPath: path });
    try {
      assert.equal(post(s2).body.id, first.body.id);
      assert.equal(get(s2).body.jobs.length, 1);
    } finally { s2.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("task-02: validates payload and requires idempotency key", () => {
  const s = createBenchService();
  try {
    assert.equal(post(s, { "x-client-id": "team_01" }).status, 428);
    assert.equal(post(s, h(), { task: "" }).status, 422);
    assert.equal(post(s, h(), { task: "okay", description: 7 }).status, 422);
  } finally { s.close(); }
});

test("service rejects invalid config and closes database", () => {
  assert.throws(() => createBenchService({ maxRequests: 0 }), TypeError);
  const s = createBenchService();
  s.close();
  assert.throws(() => s.handle(), /closed/);
});
