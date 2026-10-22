# Shared engine snapshot

Unmodified MIT-licensed Agent Lanes 0.4.1 core (from commit `1bf7d2d` on the `security/audit-fixes` branch, which adds the case-folded deny matching, ignored-file reporting and exported raw-diff parser on top of the 0.4.1 release) and data-only template reader. Vendoring keeps each package independently installable.

- agent-lanes.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/1bf7d2d3e834e29fd6385ce8632ab40df852491a/src/core.mjs
  - SHA-256 of canonical LF UTF-8: `00b7f63d5e3caa98fa03d78e7dce389298fb8df3429836fa0d1d25d2924df5c8`
- templates.mjs: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.4.1/src/templates.mjs
  - SHA-256 of canonical LF UTF-8: `6a03bdc071289b90498376b8a3f16b435d698e134c1d4fa61341696938e46881`

Run `npm run test:vendor` to verify every recorded file and version. Update both files and source.json together, then run integration tests. MCP exposes exactly four read-only tools; it never invokes the engine's writing functions.
