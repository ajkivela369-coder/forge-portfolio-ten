# ForgeMesh — Go + Node.js Event Microservice

**Status: tested engineering prototype, no public deployment.** This project now has a working Go standard-library HTTP service and a working Node.js reference implementation using the same versioned contract.

## Verified implementation

- `internal/mesh/service.go` — Go `net/http` handler, mutex-protected in-memory event storage, client-scoped listing, idempotent requests, strict JSON decoding, request-size/capacity limits.
- `cmd/forgemesh/main.go` — Go loopback-only server entrypoint, with request timeouts.
- `internal/mesh/service_test.go` — 7 top-level Go tests (including a real TCP HTTP test), with 5 additional nested subcases.
- `reference/service.mjs` — equivalent Node.js loopback HTTP reference implementation.
- `tests/http-contract.test.mjs` — 17 passing Node tests executed on paired Windows workstation.
- `fixtures/http-contract.json` — explicit HTTP contract, errors and sizes.
- `tools/contract-smoke.mjs` — eight checks against an already running loopback server, shared by both implementations.

### Actual verification performed

**On the paired Windows laptop:**
- Node.js 24: `node --test tests/http-contract.test.mjs` — **17/17 passed**.
- Node.js 24: `node tools/contract-smoke.mjs http://127.0.0.1:4831/` — **8/8 checks passed** against the Node reference. Server was stopped afterward.

**On a separate Linux testing environment (no laptop installation):**
- Go **1.23.2 linux/amd64**: `go test -count=1 ./...` — **7 top-level tests passed**, plus five nested subcases.
- `go vet ./...` — passed.
- `go test -race -count=1 ./...` — passed.
- Go binary started on loopback port 4936; the exact same eight-check Node smoke script returned **8/8 passed** against the actual Go HTTP service. Server was stopped afterward.
- Source file hashes from the paired laptop were checked against the tested files, accounting for normalized CRLF/LF line endings.

**Important:** The Go compiler is **not installed on the Windows workstation**. The Go program was compiled and exercised in the independent Linux environment. Neither Go nor Node services were deployed publicly.

## Running locally

Node.js 24+ (present on the laptop):

```powershell
cd apps/forgemesh
npm test
npm run serve:node
# In another terminal:
node tools/contract-smoke.mjs http://127.0.0.1:4831/
```

When a free Go toolchain becomes available on the laptop:

```powershell
go test -count=1 ./...
go test -race -count=1 ./...
go vet ./...
go run ./cmd/forgemesh
```

## Limitations

- `x-client-id` is a **demo routing label, not authentication**. Both servers must remain loopback-only.
- Event storage is **in-memory only**, not a durable message broker.
- No gRPC, Kafka, Redis, distributed retry queue, Docker, cross-node guarantees, or multi-region deployment implemented.
- No traffic from real customers, employer infrastructure, or external benchmarking.
- No software installation, paid services, account credentials, or external API costs were incurred on the laptop.
- No Go source from external/private project repositories was copied.

## Next

Review persistence options and secure authentication **before** any public exposure; add failure recovery and persistence tests; the new Node fault matrix is complete, but the Go source was not changed in Phase 5. Introduce gRPC when toolchain/storage capacity permits.

See `../../docs/FORGEMESH_GO_VERIFICATION_2026-11-05.md` for provenance and independent test evidence.
