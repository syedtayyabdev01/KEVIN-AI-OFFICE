# ADR-0001: Preserve ApolloOffice as the coding engine

- Status: Accepted
- Date: 2026-11-02

Pin the original ApolloOffice repository as a Git submodule at \`vendor/ApolloOffice\`. Do not rewrite its Rust worker pipeline or copy its implementation into a replacement dashboard.

ApolloOffice provides a local Rust/Axum application, SQLite persistence, per-worker provider routing, the Scout/Guard/Vet/Hunter/Repro/Fixer/CI/Reviewer/Submit/Watcher pipeline, execution hosts and proof-oriented PR workflow. Its internal MCP bridge is repository-scoped; it is not a general Windows desktop automation API.

Consequences:
- Preserve Apollo source, upstream history, license and notices.
- KEVIN adds a separate orchestrator and adapter layer.
- Integrate through a supported local process/adapter boundary.
- Do not couple to Apollo's private SQLite schema.
- Review AGPL-3.0 obligations before distribution.
