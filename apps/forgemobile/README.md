# ForgeMobile — Kotlin offline-sync core

A **Kotlin JVM standard-library** mobile-domain prototype for queued offline edits, optimistic revision checks, idempotent retry, conflict preservation, and non-destructive remote merge. It can power an eventual Android client but **is not yet an Android or iOS app**, nor is it Flutter/Swift.

```sh
kotlinc src/OfflineSync.kt src/Main.kt tests/OfflineSyncTest.kt -include-runtime -d build/forge-mobile.jar
java -cp build/forge-mobile.jar forgemobile.OfflineSyncTestKt
java -cp build/forge-mobile.jar forgemobile.MainKt
```

No networking, local disk persistence, authentication, or PII. Next: Android UI, encrypted Room persistence, authenticated sync backend and user testing.
