# KEVIN AI OFFICE

Local-first AI operations office built around the original [ApolloOffice](https://github.com/Silvertree2010/ApolloOffice) engine.

## Architecture

- ApolloOffice remains the specialist software-engineering engine and is pinned at \`vendor/ApolloOffice\` as a Git submodule.
- KEVIN Local Agent is a separate Windows-side control plane with SQLite task persistence, approvals and capability reporting.
- KEVIN Dashboard is a React/Vite UI connected to the local agent.
- PC, Telegram, TradingView, News and Student Academy are separate adapters. Disconnected adapters are visibly marked unavailable.

## Implemented in this foundation

- Rust/Axum local API bound to \`127.0.0.1:47310\`.
- Bearer-token protection for agent and task endpoints.
- SQLite task persistence.
- Task creation starts in \`awaiting_approval\`.
- Owner approval transitions the record to \`queued\`.
- Dashboard polls the real local API and shows adapter status.
- CI workflow for dashboard typecheck/build and Rust fmt/clippy/tests.

## Not implemented yet

Apollo process lifecycle integration, Windows UI automation, Telegram operations, TradingView integration, live news feeds, Student Academy CRUD, and multi-provider orchestration. These must be implemented as real adapters before being shown as connected. A queued task is not evidence of execution.

## Requirements

- Node.js 20+
- Rust stable toolchain
- Git with submodule support

## Clone and run (PowerShell)

\`\`\`powershell
git clone --branch apollo-foundation https://github.com/syedtayyabdev01/KEVIN-AI-OFFICE.git
cd KEVIN-AI-OFFICE
git submodule update --init --recursive
npm install
npm run typecheck
npm run build
\`\`\`

In a second PowerShell terminal:

\`\`\`powershell
$env:KEVIN_AGENT_TOKEN = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
cargo run --manifest-path apps/kevin-agent/Cargo.toml
\`\`\`

Open the Vite URL printed by \`npm run dev\` (normally \`http://localhost:5173\`). Paste the same local token into Runtime Connection.

## Verification

\`\`\`powershell
cargo fmt --manifest-path apps/kevin-agent/Cargo.toml -- --check
cargo test --manifest-path apps/kevin-agent/Cargo.toml
npm run typecheck
npm run build
\`\`\`

## Security boundaries

The local agent binds to loopback only. It has no arbitrary shell endpoint. Task creation persists intent; approval only queues it. It does not click UI controls, send messages, place trades, or change student/payment records. Each future adapter needs a narrow capability contract, scoped permissions and audit evidence. Do not expose the local API through a public tunnel.

## Apollo license

ApolloOffice is AGPL-3.0-only. Its source and notices remain in the submodule. Review AGPL obligations before distributing a combined or modified build.
