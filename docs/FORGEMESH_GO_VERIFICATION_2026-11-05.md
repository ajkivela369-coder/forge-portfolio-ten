# ForgeMesh — Go compilation and integration verification

**Workstation origin:** `C:\Users\user\ForgeRepo\forge-portfolio-ten-20261105\apps\forgemesh`

**Independent testing environment:** Linux amd64 container with Go 1.23.2 and Node 22.16.0.

**Workstation Node:** Node 24 (Windows).

## Provenance and exact source verification

The Go sources were created on the paired Windows workstation, transferred as a compressed ZIP to an independent Linux testing environment, and verified against SHA-256 hashes. During independent compilation, two defects were found and repaired on the workstation, then identically corrected in the test environment:

1. Unused `net/http` test import caused the initial Go build to fail; removed it.
2. An oversized malformed request initially returned HTTP 400 rather than 413; fixed request-size validation to read a bounded maximum before JSON parsing.

A live TCP test was added. For the final verification pass, the exact CRLF workstation test source was retransferred and the Linux tests rerun. The Go service/main source text matched the workstation after newline normalization, and the raw SHA-256 values reconstructed with Windows CRLF matched the source. No unrelated project code was included.

| Source file relative to `apps/forgemesh/` | Raw Windows SHA-256 |
| --- | --- |
| `go.mod` | `5422dec74a0544748ab0ad2d38226f1fa20053121f6eb663b2da5f0164a8cfa9` |
| `internal/mesh/service.go` | `a129ef7914a0ead17c4efb578d2723d6471c89e45ce7d05b4e09e0100f2ee5be` |
| `internal/mesh/service_test.go` | `ed900649b913f3cf778a8aa2ec9f36bc8ce9a11d92cb0314d8f7f6cb980a407c` |
| `cmd/forgemesh/main.go` | `3ff0a2f6d145467ddb64fbbb77818ee68a2187c2a670141d66e0e38aef9e75c4` |

Shared smoke script `tools/contract-smoke.mjs`: raw Windows SHA-256 `e5a6f5993378cd6763e71ff7f1665086bf3160f10fde965094eddeb140a8bbcc`.

## Verified results

### Linux Go compiler (separate from laptop)

- `go test -count=1 ./...` — **PASS**: 7 top-level Go tests, 5 additional nested cases.
- `go test -race -count=1 ./...` — **PASS**, no race reports.
- `go vet ./...` — **PASS**.
- `go build -o /tmp/forgemesh-demo ./cmd/forgemesh` — **PASS**.
- Go service started on `127.0.0.1:4936`; the eight-check shared HTTP smoke script returned **8/8 passed**.

### Paired Windows laptop

- `node --test tests/http-contract.test.mjs` — **11/11 passed**.
- Node service started on `127.0.0.1:4831`; same smoke script returned **8/8 passed**, then the process was stopped.
- `shutil.which('go')` returned null, and conventional Go install paths were absent. No Go compiler was installed.
- `C:` free space was approximately **8.08 GiB** at inspection. No large installation or new cloud service was initiated.

## Limits / interpretation

This is **Go source compilation and testing verified in an independent local Linux environment**, not tests of a Go executable on the paired Windows machine, nor a production certification. The Node tests and Go tests exercise overlapping contract behaviors, while the same smoke script tests eight common HTTP operations against both live servers.

There is no gRPC, Kafka, Redis, Docker, production authentication or persistent event transport. `X-Client-Id` is a demo label only. Public network exposure is prohibited.

A GitHub Actions workflow was authored for future CI but **not submitted or run**. No code was committed, pushed or deployed in this pass.
