/** Run basic HTTP contract checks against a manually started loopback server.
 * Works with either Go or Node. Never targets arbitrary network hosts.
 * Does not start processes or deploy services.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const text = process.argv[2] ?? process.env.FORGEMESH_TARGET_URL;
if (!text) throw new Error("Provide http://127.0.0.1:<port>");
const target = new URL(text);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname) ||
    !target.port || target.pathname !== "/" || target.username || target.password)
  throw new Error("Only a loopback HTTP origin is permitted");
const origin = target.origin;
const clientId = "smoke_" + randomUUID().replaceAll("-", "").slice(0, 14);
const key = "request_" + randomUUID().replaceAll("-", "").slice(0, 14);
const headers = { "x-client-id": clientId, "idempotency-key": key, "content-type": "application/json" };
const value = JSON.stringify({ topic: "build-ready", payload: "synthetic-smoke" });

async function call(path, { method="GET", body, headers: h=headers }={}) {
  const response = await fetch(origin + path, {method, headers:h, body, signal:AbortSignal.timeout(4000)});
  return { status:response.status, headers:response.headers, json:await response.json() };
}
const cases = [];
async function check(name, fn) {
  await fn();
  cases.push(name);
}

await check("health",async()=>{
  const r = await call("/health", {headers:{}});
  assert.equal(r.status,200);
  assert.equal(r.json.service,"ForgeMesh");
});
let first;
await check("create",async()=>{
  const r=await call("/v1/events",{method:"POST",body:value});
  assert.equal(r.status,201); assert.equal(r.json.topic,"build-ready");
  assert.equal(r.json.payload,"synthetic-smoke"); first=r.json;
});
await check("replay",async()=>{
  const r=await call("/v1/events",{method:"POST",body:value});
  assert.equal(r.status,200); assert.deepEqual(r.json,first);
  assert.equal(r.headers.get("idempotency-replayed"),"true");
});
await check("changed-payload-conflict",async()=>{
  const r=await call("/v1/events",{method:"POST",body:JSON.stringify({topic:"build-ready",payload:"different"})});
  assert.equal(r.status,409); assert.equal(r.json.error,"idempotency_conflict");
});
await check("scoped-events",async()=>{
  const r=await call("/v1/events?topic=build-ready");
  assert.equal(r.status,200); assert.deepEqual(r.json.events,[first]);
});
await check("unrecognized-fields",async()=>{
  const r=await call("/v1/events",{method:"POST",body:'{"topic":"valid-topic","payload":"x","shell":"invalid"}'});
  assert.equal(r.status,400);
});
await check("invalid-client",async()=>{
  const r=await call("/v1/events?topic=build-ready",{headers:{"x-client-id":"../wrong"}});
  assert.equal(r.status,401);
});
await check("oversized-request",async()=>{
  const r=await call("/v1/events",{method:"POST",body:"x".repeat(70000)});
  assert.equal(r.status,413);
});
console.log(JSON.stringify({schema:"forgemesh-loopback-smoke-v1",target_origin:origin,
  checks:cases,total:cases.length,passed:cases.length,failed:0,
  note:"Synthetic loopback HTTP only; no authorization or distribution guarantees"},null,2));
