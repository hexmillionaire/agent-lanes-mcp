# Shared engine snapshot

Unmodified MIT-licensed Agent Lanes 0.4.1 core and data-only template reader. Vendoring keeps each package independently installable.

- agent-lanes.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.1/src/core.mjs
  - SHA-256 of canonical LF UTF-8: `8019c706aa492d6bb0fd06059e85fa3ea0e9760bc5b5bf18630c2653c9acaa95`
- templates.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.1/src/templates.mjs
  - SHA-256 of canonical LF UTF-8: `6a03bdc071289b90498376b8a3f16b435d698e134c1d4fa61341696938e46881`

Run `npm run test:vendor` to verify every recorded file and version. Update both files and source.json together, then run integration tests. MCP exposes exactly four read-only tools; it never invokes the engine's writing functions.
