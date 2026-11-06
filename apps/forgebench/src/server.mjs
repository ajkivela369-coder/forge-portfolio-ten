import http from "node:http";
import { createBenchService } from "./engine.mjs";

export function createHttpServer(options = {}) {
  const service = createBenchService(options);
  const server = http.createServer(async (req, res) => {
    try {
      let body = null;
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk.toString("utf8");
          if (Buffer.byteLength(raw) > 65_536) {
            res.writeHead(413, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: "body_too_large" }));
            return;
          }
        }
        try { body = JSON.parse(raw); }
        catch { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "invalid_json" })); return; }
      }
      const result = service.handle({ method: req.method, path: req.url, headers: req.headers, body });
      res.writeHead(result.status, result.headers);
      res.end(JSON.stringify(result.body));
    } catch {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
  return { server, service, async shutdown() {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    service.close();
  } };
}

if (process.argv[1] && import.meta.url === new URL("file:///" + process.argv[1].replaceAll("\\", "/")).href) {
  const { server, service } = createHttpServer({ dbPath: process.env.FORGEBENCH_DB || ":memory:" });
  const port = Number(process.env.PORT || 4731);
  server.listen(port, "127.0.0.1", () => console.log(JSON.stringify({ listening: "127.0.0.1", port: server.address().port })));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { service.close(); process.exit(0); }));
}
