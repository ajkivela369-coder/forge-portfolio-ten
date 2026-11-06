import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHttpServer } from "../src/server.mjs";

async function withServer(fn) {
  const app = createHttpServer();
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  try { await fn("http://127.0.0.1:" + app.server.address().port); }
  finally { await app.shutdown(); }
}

test("HTTP: creates and retrieves job through real loopback server", async () => {
  await withServer(async url => {
    const headers = { "x-client-id": "team_01", "idempotency-key": "http-key-0001", "content-type": "application/json" };
    const response = await fetch(url + "/v1/jobs", { method: "POST", headers, body: JSON.stringify({ task: "Add audit log" }) });
    assert.equal(response.status, 201);
    const created = await response.json();
    const fetched = await fetch(url + "/v1/jobs/" + created.id, { headers });
    assert.equal(fetched.status, 200);
    assert.equal((await fetched.json()).task, "Add audit log");
  });
});

test("HTTP: invalid JSON is rejected before invoking task engine", async () => {
  await withServer(async url => {
    const res = await fetch(url + "/v1/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "invalid_json" });
  });
});

test("HTTP: rejects oversized request bodies", async () => {
  await withServer(async url => {
    const res = await fetch(url + "/v1/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "x".repeat(70000) }) });
    assert.equal(res.status, 413);
  });
});
