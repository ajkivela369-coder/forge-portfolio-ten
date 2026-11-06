import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const json = (status, body, headers = {}) => ({ status, body, headers: { "content-type": "application/json", ...headers } });
const sha256 = value => createHash("sha256").update(value).digest("hex");

export function createBenchService({
  dbPath = ":memory:", now = () => Date.now(), newId = () => randomUUID(),
  maxRequests = 12, windowMs = 60_000,
} = {}) {
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || !Number.isInteger(windowMs) || windowMs < 1)
    throw new TypeError("A positive rate limit and window are required");

  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS jobs(
      id TEXT PRIMARY KEY, client TEXT NOT NULL, task TEXT NOT NULL,
      description TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client, created_at);
    CREATE TABLE IF NOT EXISTS idempotency(
      client TEXT NOT NULL, idem_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
      job_id TEXT NOT NULL REFERENCES jobs(id), PRIMARY KEY(client, idem_key)
    );`);
  const windows = new Map();
  let closed = false;

  function handle({ method = "GET", path = "/", headers = {}, body = null } = {}) {
    if (closed) throw new Error("Service is closed");
    const endpoint = new URL(path, "http://local.test").pathname;
    if (method === "GET" && endpoint === "/health") return json(200, { ok: true, service: "ForgeBench" });
    const client = headers["x-client-id"];
    if (typeof client !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(client))
      return json(401, { error: "Missing or invalid x-client-id (demo identifier, NOT authentication)" });

    const timestamp = now();
    const recent = (windows.get(client) || []).filter(t => timestamp - t < windowMs && timestamp >= t);
    if (recent.length >= maxRequests) {
      const retry = Math.max(1, Math.ceil((windowMs - (timestamp - recent[0])) / 1000));
      windows.set(client, recent);
      return json(429, { error: "rate_limit_exceeded" }, { "retry-after": String(retry) });
    }
    recent.push(timestamp);
    windows.set(client, recent);

    if (method === "POST" && endpoint === "/v1/jobs") {
      const key = headers["idempotency-key"];
      if (typeof key !== "string" || key.length < 8 || key.length > 128)
        return json(428, { error: "An idempotency-key of 8–128 characters is required" });
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          typeof body.task !== "string" || body.task.trim().length < 2 || body.task.length > 200 ||
          (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 2000)))
        return json(422, { error: "Expected task (2–200 chars) and optional description (up to 2000 chars)" });
      const task = body.task.trim();
      const description = body.description || "";
      const digest = sha256(JSON.stringify({ task, description }));
      const existing = db.prepare("SELECT payload_hash, job_id FROM idempotency WHERE client=? AND idem_key=?").get(client, key);
      if (existing) {
        if (existing.payload_hash !== digest) return json(409, { error: "idempotency_key_conflict" });
        const job = db.prepare("SELECT id,task,description,created_at FROM jobs WHERE id=? AND client=?").get(existing.job_id, client);
        return json(200, job, { "idempotency-replayed": "true" });
      }
      const record = { id: newId(), task, description, created_at: timestamp };
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT INTO jobs(id,client,task,description,created_at) VALUES (?,?,?,?,?)")
          .run(record.id, client, task, description, timestamp);
        db.prepare("INSERT INTO idempotency(client,idem_key,payload_hash,job_id) VALUES (?,?,?,?)")
          .run(client, key, digest, record.id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return json(201, record, { location: `/v1/jobs/${record.id}` });
    }
    if (method === "GET" && endpoint === "/v1/jobs") {
      const jobs = db.prepare("SELECT id,task,description,created_at FROM jobs WHERE client=? ORDER BY created_at DESC,id").all(client);
      return json(200, { jobs });
    }
    if (method === "GET" && /^\/v1\/jobs\/[^/]+$/.test(endpoint)) {
      const id = decodeURIComponent(endpoint.slice("/v1/jobs/".length));
      const job = db.prepare("SELECT id,task,description,created_at FROM jobs WHERE id=? AND client=?").get(id, client);
      return job ? json(200, job) : json(404, { error: "not_found" });
    }
    return json(404, { error: "not_found" });
  }

  return { handle, close() { if (!closed) { db.close(); closed = true; } } };
}
