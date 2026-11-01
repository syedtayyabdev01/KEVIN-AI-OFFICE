# Architecture overview

KEVIN AI OFFICE is a local-first multi-agent operations environment. ApolloOffice is one specialist engine, not the whole product and not a generic desktop-control API.

\`\`\`text
React Dashboard (localhost:5173)
       | bearer-authenticated HTTP
       v
KEVIN Local Agent (127.0.0.1:47310)
  |-- SQLite task and approval store
  |-- Agent registry and capability policy
  |-- Apollo adapter (planned)
  |-- Windows operator (planned)
  |-- Telegram / TradingView / News / Student adapters (planned)
  \`-- Provider registry (planned): OpenAI / Claude / Gemini / Ollama
\`\`\`

## Trust boundaries

1. Dashboard is an untrusted client; local agent validates requests.
2. Local agent binds to loopback. No public listener or tunnel by default.
3. Bearer token is supplied through process environment and never committed.
4. Task creation persists intent only; it cannot execute commands.
5. Approval is a state transition, not proof of execution.
6. Each adapter declares capabilities, required approval and evidence.
7. Trading actions, public messaging, payments, deletion and account changes remain approval-gated.

## Agents

| Agent | Responsibility | Initial permission |
|---|---|---|
| Kevin Manager | Plan and route work | Plan/enqueue |
| Apollo Development | Verified code changes | Repository-scoped |
| PC Operator | Windows apps, files, browser | Approval required |
| Telegram Manager | Telegram operations | Draft first |
| TradingView Agent | Chart and market analysis | Read only |
| News Intelligence | Source-backed research | Read only |
| Student Manager | Academy records and operations | Approval required |

Task lifecycle: \`awaiting_approval -> queued -> running -> succeeded/failed/cancelled\`. Only the first two states are implemented now. No worker may mark a task successful without returning execution evidence.

Apollo and KEVIN keep separate databases. Integration uses a versioned adapter contract, not direct reads from Apollo's private SQLite schema.
