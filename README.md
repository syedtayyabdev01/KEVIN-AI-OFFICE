# KEVIN AI OFFICE

Local-first AI operations office built around the original [ApolloOffice](https://github.com/Silvertree2010/ApolloOffice) engine.

## Architecture

- ApolloOffice remains the specialist software-engineering engine and is pinned at `vendor/ApolloOffice` as a Git submodule.
- KEVIN Local Agent is a separate Windows-side control plane with SQLite task persistence, approvals and a background AI worker.
- KEVIN Dashboard is a React/Vite UI connected to the local agent.
- Department workers currently share a configured OpenAI-compatible model for text-based deliverables. Device control, Telegram sending, live TradingView/broker data, live news feeds and student/payment database writes still require their own adapters.

## Implemented

- Rust/Axum local API bound to `127.0.0.1:47310`, protected by a local bearer token.
- SQLite task persistence and backward-compatible result/worker columns.
- Owner approval flow: `awaiting_approval → queued → running → completed/failed`.
- Background worker polls approved tasks, calls a configured OpenAI-compatible chat-completions endpoint, and persists the real response or provider error.
- Department-specific worker instructions for Management, Development, PC Operations, Telegram, Trading Intelligence, News and Student Academy.
- Live worker readiness/working states and completed-result viewer in the dashboard.
- Responsive dashboard navigation, motion, hover/focus states and reduced-motion support.
- CI for dashboard typecheck/build and Rust fmt/clippy/tests.

## Provider configuration

The worker accepts any provider that implements the OpenAI-compatible `/chat/completions` endpoint, including OpenAI-compatible gateways and Ollama.

Copy `.env.example` to `.env`, then set:

```dotenv
KEVIN_AGENT_TOKEN=your-random-token-at-least-32-characters
KEVIN_AI_BASE_URL=https://api.openai.com/v1
KEVIN_AI_MODEL=gpt-4o-mini
KEVIN_AI_API_KEY=your-provider-api-key
KEVIN_AI_WORKERS=1
```

For Ollama, install Ollama, pull a small model with `ollama pull qwen2.5:3b`, and keep the Ollama service running. Use:

```dotenv
KEVIN_AI_BASE_URL=http://127.0.0.1:11434/v1
KEVIN_AI_MODEL=qwen2.5:3b
KEVIN_AI_API_KEY=
```

Make sure the selected Ollama model is downloaded and Ollama is running. Never commit `.env` or paste provider keys into the dashboard.

## Clone and run (PowerShell)

```powershell
git clone --branch apollo-foundation https://github.com/syedtayyabdev01/KEVIN-AI-OFFICE.git
cd KEVIN-AI-OFFICE
git submodule update --init --recursive
npm install
Copy-Item .env.example .env
# Default is local Ollama + qwen2.5:3b. Install Ollama and run: ollama pull qwen2.5:3b
# The start script generates a secure local token if it is blank.
```

The Windows launcher generates a local token if needed, validates the Ollama model and starts both the local agent and dashboard:

```powershell
.\scripts\start.ps1
```

It uses a prebuilt `kevin-local-agent.exe` if one is present in the project root; otherwise it builds/runs with Cargo. To start manually, load `.env` and run:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)\\s*=\\s*(.*)\\s*$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
cargo run --manifest-path apps/kevin-agent/Cargo.toml
```

In a second terminal:

```powershell
npm run dev
```

Open `http://localhost:5173` and paste the same `KEVIN_AGENT_TOKEN` into Runtime Connection. Create a task, approve it, and watch it move through Running to Completed. Open the result to inspect the worker's actual response.

## Verification

```powershell
cargo fmt --manifest-path apps/kevin-agent/Cargo.toml -- --check
cargo clippy --manifest-path apps/kevin-agent/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path apps/kevin-agent/Cargo.toml
npm run typecheck
npm run build
```

## Security boundaries and limitations

The local agent binds to loopback only. It has no arbitrary shell endpoint. The generic AI worker produces text deliverables; it does not click UI controls, send Telegram messages, place trades, modify student/payment records, or claim repository changes. Those actions need dedicated scoped adapters, explicit approvals and auditable evidence. Do not expose the local API through a public tunnel.

## Apollo license

ApolloOffice is AGPL-3.0-only. Its source and notices remain in the submodule. Review AGPL obligations before distributing a combined or modified build.
