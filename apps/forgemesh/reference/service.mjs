/** Runnable Node reference for ForgeMesh HTTP contract (Go implementation uncompiled here).
 * Loopback only. X-Client-Id is a demo label, NOT authentication.
 */
import http from "node:http";
import { createHash } from "node:crypto";

const clientPattern = /^[A-Za-z0-9_-]{3,64}$/;
const keyPattern = /^[A-Za-z0-9_-]{8,128}$/;
const topicPattern = /^[a-z][a-z0-9-]{1,63}$/;
const digest = (topic, payload) => createHash("sha256").update(topic + "\0" + payload).digest("hex");

export function createService({ maxEntries = 1000 } = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 100_000)
    throw new TypeError("Invalid maxEntries");
  let sequence = 0;
  const events = [];
  const keys = new Map();
  const respond = (res, status, value, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
    res.end(JSON.stringify(value) + "\n");
  };
  const fail = (res, status, error) => respond(res, status, { error });
  const handler = async (req, res) => {
    const path = new URL(req.url || "/", "http://127.0.0.1").pathname;
    if (path === "/health" && req.method === "GET") {
      respond(res, 200, { ok: true, service: "ForgeMesh" });
      return;
    }
    if (path !== "/v1/events" || !["GET", "POST"].includes(req.method)) {
      fail(res, 404, "not_found"); return;
    }
    const client = req.headers["x-client-id"];
    if (typeof client !== "string" || !clientPattern.test(client)) {
      fail(res, 401, "invalid_client_label"); return;
    }
    if (req.method === "GET") {
      const topic = new URL(req.url, "http://127.0.0.1").searchParams.get("topic");
      if (!topic || !topicPattern.test(topic)) {
        fail(res, 422, "invalid_topic"); return;
      }
      respond(res, 200, { events: events.filter(x => x.client === client && x.event.topic === topic).map(x => x.event) });
      return;
    }
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || !keyPattern.test(key)) {
      fail(res, 428, "invalid_idempotency_key"); return;
    }
    let raw = "";
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 65536) { fail(res, 413, "body_too_large"); return; }
      raw += chunk.toString("utf8");
    }
    let body;
    try { body = JSON.parse(raw); }
    catch { fail(res, 400, "invalid_json"); return; }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(k => !["topic", "payload"].includes(k))) {
      fail(res, 400, "invalid_json"); return;
    }
    const { topic, payload } = body;
    if (typeof topic !== "string" || !topicPattern.test(topic) ||
        typeof payload !== "string" || Buffer.byteLength(payload) < 1 || Buffer.byteLength(payload) > 1024) {
      fail(res, 422, "invalid_event"); return;
    }
    const scope = client + "\0" + key;
    const hash = digest(topic, payload);
    const prior = keys.get(scope);
    if (prior) {
      if (prior.hash !== hash) { fail(res, 409, "idempotency_conflict"); return; }
      respond(res, 200, prior.event, { "idempotency-replayed": "true" }); return;
    }
    if (events.length >= maxEntries) { fail(res, 503, "capacity_exceeded"); return; }
    const event = { id: "evt-" + String(++sequence).padStart(6, "0"), topic, payload };
    keys.set(scope, { hash, event });
    events.push({ client, event });
    respond(res, 201, event);
  };

  return {
    server: http.createServer((req, res) => {
      handler(req, res).catch(() => {
        if (!res.headersSent) fail(res, 500, "internal_error");
        else res.destroy();
      });
    }),
  };
}

if (process.argv[1] && import.meta.url === new URL("file:///" + process.argv[1].replaceAll("\\", "/")).href) {
  const port = Number(process.env.PORT || 4831);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const { server } = createService();
  server.listen(port, "127.0.0.1", () => console.log(JSON.stringify({ service: "ForgeMesh", address: "127.0.0.1", port })));
}
