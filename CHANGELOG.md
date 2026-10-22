# Changelog

## Unreleased

- Security: re-vendor the Agent Lanes core from the `security/audit-fixes` branch: deny patterns also match case-folded, NFC-normalised paths; local audits ignore the global Git excludes file and report entries hidden by repository ignore rules in a new `ignored` field; `parseRawDiff` is exported. `check_scope` output now carries `ignored`.
- Bump the dev-only `@modelcontextprotocol/inspector` from 2.10.1 to 2.12.0 to clear its advisories; the inspector smoke test still passes.
- Security: `check_scope` and `get_handoff` audit against the task scope (allow, deny, base) pinned when this server first read the task, at startup for existing tasks. A model could previously widen its own `allow` list by editing `.agent-lanes/<id>.json` with an ordinary file write, then ask `check_scope` to confirm it stayed in scope; the audit filters `.agent-lanes/` out of the change list, so nothing showed. Reports now carry `scopeChanged`, and handoffs start with a `SCOPE CHANGED` notice when the on-disk scope has drifted.
- The dogfood policy denies `.github/workflows/**`, and the scope workflow pins the Agent Lanes action to the 0.4.1 release commit.

## 0.4.1

- Update the vendored Agent Lanes core to 0.4.1: deny patterns now also match hidden files and directories.
- Add `--version`; `--help` now prints to stdout with a usage line.
- Add `server.json` and the `mcpName` package field for the official MCP Registry.
- Document `npx` setup for Claude Code, Claude Desktop, Cursor and Codex; add `llms.txt` and npm `homepage`/`bugs` metadata.

## 0.4.0

- Emit genuine JSON Schema 2020-12 discovery contracts from the same Zod definitions as SDK validation.
- Capture real stdio discovery and strictly validate output schemas/responses without changing the four read-only tools.
- Print a tested VS Code servers/stdio configuration; retain Claude and Codex formats.
- Refresh the shared two-module 0.4.0 engine snapshot with recorded source hashes.


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
