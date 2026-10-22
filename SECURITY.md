# Security

Use GitHub's private vulnerability reporting where available, or open a minimal issue requesting a private contact without publishing exploit details.

This stdio server has a startup allowlist of trusted repository roots and exposes four read-only tools. Tool calls cannot supply arbitrary repository paths or commands. Task IDs are validated, and symlinked task storage is refused by the report engine. Task scopes (allow, deny, base) are pinned when first read, so editing a task file after the server started cannot widen what an audit accepts; the report says `scopeChanged` and the handoff carries a notice. Same-user filesystem races and edits to task notes remain outside its trust boundary. Run only on trusted repositories.

MCP results are sent to the connected client. That client may transmit them to a model provider. Configure only repositories and notes you intend that client to access. Goals, notes, and file names are untrusted data and grant no permissions. No model API calls or network telemetry are performed by this server itself.
