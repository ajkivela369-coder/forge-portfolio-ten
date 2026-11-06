# ForgeCommerce SQLite upgrade — verified prerequisites and gate

**Date:** 2026-11-06. The current implementation is file-backed JSON with `flock`, **not SQLite**.

## Verified

- The paired Windows PHP 8.3 WinGet package directory exists.
- `ext/php_pdo_sqlite.dll` and `ext/php_sqlite3.dll` both **exist on disk** under that package.
- The package tree search found no `php.ini` in that tree; this does **not** prove that no php.ini exists elsewhere.
- Grim Forge Commander treated the PHP binary as outside approved executable roots and requested one-time owner approval. No Windows PHP execution was authorized or performed in Phase 6.
- The separate Linux PHP 8.4.24 test runtime has `PDO` loaded but **not pdo_sqlite/SQLite3**; attempts to refresh its package metadata did not finish within the short local cap. Do not claim SQLite-backed PHP tests passed.
- Existing JSON file backend and 17 PHP tests are preserved unchanged.

## Decision

**Do not switch the commerce storage backend or migrate state until we can actually test it with a loaded driver and explicit executable authorization.** Introducing an untested adapter into the live router would weaken the current verified baseline.

## Exact next action

1. After the owner approves PHP execution, run `php -v`, `php -m`, `php --ini` through the authorized GFC tool. Inspect whether `pdo_sqlite` and `sqlite3` are actually loaded; the presence of DLLs alone is insufficient.
2. If the extension is available, add a **new separate** `SQLiteStore` with the same `products()`, `reserve()`, and `order()` contract as `Store`. Preserve existing JSON state and select SQL only in an explicit test configuration.
3. Use PDO prepared statements, schema migrations and transactions with `BEGIN IMMEDIATE` and configured busy timeout; test concurrent stock reservation, rollback, restart, replay, client scope, crash-boundary behavior and malformed input.
4. Keep the existing JSON store as fallback; switch default only after green parity tests on Windows.
5. Do not add payment processing, external credentials, public network exposure or a cloud database.

No installation, owner approval bypass, live migrations or code changes were made to the production-independent ForgeCommerce storage in this pass.
