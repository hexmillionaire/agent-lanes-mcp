# Shared engine snapshot

Unmodified MIT-licensed Agent Lanes 0.4.0 core and data-only template reader. Vendoring keeps each package independently installable.

- agent-lanes.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.0/src/core.mjs
  - SHA-256 of canonical LF UTF-8: `abc1faaefa48d4ca9c85028110350912f8297a243ccce2d6c14c5d4d5ec8888d`
- templates.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.0/src/templates.mjs
  - SHA-256 of canonical LF UTF-8: `6a03bdc071289b90498376b8a3f16b435d698e134c1d4fa61341696938e46881`

Run `npm run test:vendor` to verify every recorded file and version. Update both files and source.json together, then run integration tests. MCP exposes exactly four read-only tools; it never invokes the engine's writing functions.
