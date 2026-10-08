# Changelog

## 0.3.0

- Add validated structured results alongside existing text results; keep exactly four read-only tools.
- Add optional task pagination, public-field filtering, safe errors, cancellation, and bounded request/response sizes.
- Verify every saved Git base in doctor and exercise a real scope call.
- Load the SDK only for protocol/doctor execution; update development-only Inspector to 2.10.1.
- Update the shared engine to 0.3.0 and verify its version and hash in CI.

## 0.2.0

- Absolute-path Claude JSON/Codex TOML output without editing installed clients.
- Doctor verifies repository/task data and a real stdio handshake.
- Pinned official Inspector strict discovery and all-four-tool CI smoke checks.
- Agent Lanes 0.2.0 engine, shared quickstart, and feedback templates.
- All four MCP tools remain read-only.

## 0.1.0

- Official SDK stdio server with four read-only task tools.
- Explicit repository allowlist and validated task IDs.
- Claude and Codex configuration examples.
- Official client contract and real stdio integration tests.
