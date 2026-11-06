# ForgeConnect — Ruby webhook/event core

**Ruby 3 standard-library** prototype with HMAC-SHA256 signature checking, per-tenant replay suppression, topic subscriptions, fan-out, bounded retry queues and dead-letter inspection. It exposes a local library, **not** an HTTP server or a deployed Rails/GraphQL/WebSocket platform. Dispatch handlers are trusted, synchronous test doubles; no outbound network requests or persistent secrets.

```sh
ruby -Ilib test/connect_test.rb
```

Skills: Ruby, event routing, JSON validation, HMAC, idempotency, retry/dead-letter design, Minitest. Next: secure key management, persistent delivery store, authenticated HTTP intake, backpressure and async workers.
