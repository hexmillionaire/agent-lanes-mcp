# Shared engine snapshot

Unmodified MIT-licensed Agent Lanes 0.4.2 core and data-only template reader. Vendoring keeps each package independently installable.

- agent-lanes.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.2/src/core.mjs
  - SHA-256 of canonical LF UTF-8: `ff996e75dc3c4cf8e50ef9c2d510eefa3b7849b3b3e426988b66fff4f4d102ce`
- templates.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.2/src/templates.mjs
  - SHA-256 of canonical LF UTF-8: `6a03bdc071289b90498376b8a3f16b435d698e134c1d4fa61341696938e46881`

Run `npm run test:vendor` to verify both recorded files and version. Update both files and source.json together, then run integration tests. MCP exposes exactly four read-only tools and never invokes engine writing functions.
