import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { createService } from "../reference/service.mjs";

const spec = JSON.parse(readFileSync(new URL("../fixtures/http-contract.json", import.meta.url)));
const headers = (client="team_01", key="request-00001") => ({
  "x-client-id": client, "idempotency-key": key, "content-type": "application/json",
});
const body = (topic="build-ready", payload="done") => JSON.stringify({ topic, payload });

async function withServer(fn, maxEntries=1000) {
  const { server } = createService({ maxEntries });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await fn("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve,reject) => server.close(err => err ? reject(err) : resolve()));
  }
}
async function post(url, value=body(), headers0=headers()) {
  return fetch(url + "/v1/events", { method: "POST", headers: headers0, body: value });
}

test("contract fixture declares health and idempotent events API", () => {
  assert.equal(spec.service, "ForgeMesh");
  assert.equal(spec.scope, "loopback_only_no_auth");
  assert.deepEqual(spec.routes.map(x=>x.success), [200,201,200]);
});

test("real HTTP health endpoint accepts unauthenticated probes", async () => {
  await withServer(async url => {
    const res = await fetch(url + "/health");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok:true, service:"ForgeMesh" });
  });
});

test("create then replay same scoped event with persistent ID", async () => {
  await withServer(async url => {
    const created = await post(url);
    const first = await created.json();
    const replay = await post(url);
    assert.equal(created.status, 201);
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get("idempotency-replayed"), "true");
    assert.deepEqual(await replay.json(), first);
    assert.equal(first.id, "evt-000001");
  });
});

test("same idempotency key but changed event conflicts", async () => {
  await withServer(async url => {
    assert.equal((await post(url)).status, 201);
    const conflict = await post(url, body("build-ready", "changed"));
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { error:"idempotency_conflict" });
  });
});

test("GET events is client-scoped and topic-filtered", async () => {
  await withServer(async url => {
    await post(url, body("build-ready","for client A"), headers("team_01"));
    await post(url, body("build-ready","for client B"), headers("team_02"));
    const res = await fetch(url + "/v1/events?topic=build-ready", { headers: headers("team_01") });
    assert.equal(res.status, 200);
    const listing = await res.json();
    assert.equal(listing.events.length, 1);
    assert.equal(listing.events[0].payload, "for client A");
  });
});

test("rejects unknown JSON fields, invalid topics, malformed JSON", async () => {
  await withServer(async url => {
    assert.equal((await post(url, '{"topic":"ok","payload":"x","command":"shell"}')).status, 400);
    assert.equal((await post(url, body("../escape","x"))).status, 422);
    assert.equal((await post(url, "{bad")).status, 400);
  });
});

test("requires a client label and idempotency key", async () => {
  await withServer(async url => {
    assert.equal((await post(url, body(), { "idempotency-key":"request-00001" })).status, 401);
    assert.equal((await post(url, body(), { "x-client-id":"team_01" })).status, 428);
    assert.equal((await post(url, body(), headers("../invalid"))).status, 401);
  });
});

test("enforces request body and payload limits", async () => {
  await withServer(async url => {
    assert.equal((await post(url, body("build-ready", "x".repeat(1100)))).status, 422);
    assert.equal((await post(url, "x".repeat(70000))).status, 413);
  });
});

test("capacity limits new messages but preserves existing replays", async () => {
  await withServer(async url => {
    assert.equal((await post(url)).status, 201);
    assert.equal((await post(url, body("build-ready","new event"), headers("team_01","request-00002"))).status, 503);
    assert.equal((await post(url)).status, 200);
  }, 1);
});

test("parallel replay requests do not duplicate events in one Node process", async () => {
  await withServer(async url => {
    const responses = await Promise.all(Array.from({length:20}, () => post(url)));
    assert.equal(responses.filter(r => r.status === 201).length, 1);
    assert.equal(responses.filter(r => r.status === 200).length, 19);
    const ids = await Promise.all(responses.map(r=>r.json().then(x=>x.id)));
    assert.equal(new Set(ids).size, 1);
  });
});

test("constructing reference with invalid capacity fails closed", () => {
  assert.throws(() => createService({ maxEntries: 0 }), TypeError);
  assert.throws(() => createService({ maxEntries: 1.1 }), TypeError);
});
