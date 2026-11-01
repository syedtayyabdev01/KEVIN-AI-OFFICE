# ADR-0002: Local-first Windows agent

- Status: Accepted
- Date: 2026-11-02

Run a separate KEVIN Local Agent on the user's computer. Dashboard communicates over loopback HTTP. A cloud backend must not issue arbitrary commands to the user's PC.

Initial implementation: loopback-only Axum listener, bearer token, SQLite task records, explicit approval transition and truthful adapter capability reporting.

Deferred: arbitrary shell endpoint, unrestricted file browser, silent desktop clicking, credential capture, Telegram sending, trade placement and student/payment writes. Each requires a dedicated adapter, narrow operation schema, policy check and auditable result.
