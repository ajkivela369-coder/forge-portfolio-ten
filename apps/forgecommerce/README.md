# ForgeCommerce — PHP Inventory and Order Reservation Prototype

**PHP 8.3+ with no package dependencies.** Genuine PHP core business logic, file-backed stock reservation, client-scoped idempotency, and a loopback HTTP API. This is a prototype, not a payment service or production e-commerce platform.

## Verification

```bash
php tests/run.php
FORGECOMMERCE_STATE="$(pwd)/var/state.json" php -S 127.0.0.1:4937 public/router.php
```

The demo catalog contains only synthetic products. `GET /health` and `GET /v1/products` are available without client headers. Use `POST /v1/orders` with `X-Client-Id` (a **demo label, not authentication**) and `Idempotency-Key`.

```bash
curl -sS -X POST http://127.0.0.1:4937/v1/orders -H 'Content-Type: application/json' -H 'X-Client-Id: client_01' -H 'Idempotency-Key: request-0001' --data '{"items":[{"sku":"BOOK-01","quantity":2}]}'
```

Stock updates and idempotency metadata are written under a dedicated `flock` lock and a temp-file rename. This gives coherent single-host behavior under normal operation; it does **not** guarantee durability after power failure, network filesystem correctness, or high-volume throughput.

**Not implemented:** SQLite adapter, Laravel, Vue, MySQL, payment processing, shipment fulfillment, public-facing authentication, network exposure, or production hardening. All funds are mock integer cents, and no real transactions or credentials are accepted. Do not expose this sample server beyond loopback.

Tests run in a separate PHP environment when the workstation PHP executable needs owner approval. The project itself is saved to the canonical Forge portfolio worktree; the Windows PHP runtime has not been invoked without its GFC approval.

## Phase 5 verification details

**Tested in a separate Linux PHP 8.4.24 environment:** `php tests/run.php` passed **17/17** cases; `python tools/http_smoke.py http://127.0.0.1:4937` passed **12/12** checks against an actual loopback PHP server; and `php tests/concurrency.php` passed one four-process stock-reservation race. Servers and temporary test state were stopped/cleaned up afterward.

**Saved on paired Windows laptop:** nine source/test/documentation files transferred into `apps/forgecommerce` and verified against independent SHA-256 hashes. Windows PHP execution remains **unverified** because Grim Forge Commander requires explicit one-time permission for its WinGet PHP executable. No permission bypass attempted.

The concurrency test uses `pcntl_fork` and skips on platforms without that extension. The built-in PHP server is for local testing only. This prototype uses a JSON file under `var/`, not SQLite; it is not crash-safe or appropriate for real customers, transactions or public exposure.

To run the tests after PHP executable approval:

```powershell
cd apps/forgecommerce
php -l src/Store.php
php -l public/router.php
php tests/run.php
# The Linux-only concurrency test is optional on Windows:
php tests/concurrency.php
```
