# Report engine snapshot

Unmodified MIT-licensed Agent Lanes 0.3.0 core.

Source: https://github.com/hexmillionaire/Agent-Lanes/blob/v0.3.0/src/core.mjs

SHA-256 of UTF-8 source with canonical LF line endings: `f291cd73eeed5995e6ec24f939328eccd7dd5cbcfe246c4981ea729e00b470b3`

Run `npm run test:vendor` to verify the recorded version and hash. The verifier normalizes CRLF to LF so Windows Git checkouts yield the same source checksum. Update the snapshot, source.json, and this file together, then run integration tests. Vendoring keeps each package independently installable. MCP exposes only four read-only tools even though the shared library includes task-writing functions.
