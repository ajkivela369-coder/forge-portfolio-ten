# ForgeEnterprise — Java workflow core

A **Java 17+ standard-library** prototype that models a multi-tenant approval workflow with separation of duties, role-controlled transitions, two-stage financial review, rejection, stable audits, and tenant-isolated lookups.

This is a functional *enterprise domain core*, not a Spring Boot deployment, Angular UI, PostgreSQL service or production authorization system. Roles are supplied by trusted caller fixtures, not authenticated identities. All state is in memory; no customer data.

```sh
mkdir -p build
javac -d build src/*.java tests/WorkflowTest.java
java -cp build forgeenterprise.WorkflowTest
java -cp build forgeenterprise.Main
```

Skills: Java, OOP, workflow/state-machine modeling, role checking, auditability, unit testing. Next production steps: identity provider, persistence, Spring REST API, transaction safety, integration tests.
