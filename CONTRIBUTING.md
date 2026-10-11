# Contributing

Run `npm ci --ignore-scripts` and `npm test` with Node 24.8+ and Git. Tests use the official MCP client, including a real stdio process. Add contract tests when changing tools or input schemas. Keep stdout reserved for MCP messages and keep repository selection limited to configured IDs.

Preserve read-only behavior and explicitly document what crosses the MCP client boundary. Goals and notes are data, not authorization. Scope audits must not claim that tests passed. Changes to task format or Git parsing belong in Agent Lanes first; update the vendored engine deliberately.

Also run `npm run test:vendor`, `npm run test:inspector` and `npm run test:package`. Discovery contracts must be generated from the same definitions as SDK validation, genuinely use 2020-12 semantics, and pass strict output validation. Update captured tools/list fixtures deliberately; a changed fixture alone is not sufficient validation. Client reports should name the actual installed version and a fictional reproduction. Useful first contributions include configuration examples, protocol regressions and clearer diagnostics.
