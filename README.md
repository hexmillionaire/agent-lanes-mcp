# Agent Lanes MCP

Let Claude Code, Codex, or another MCP client inspect task scopes and get fresh handoffs from your local Git repositories.

The server uses the official MCP TypeScript SDK over stdio. All four tools are read-only. Repositories are an explicit startup allowlist; clients use IDs, never arbitrary filesystem paths. No model API keys are needed.

## Install from npm

Requires Node.js 24.8+ and Git. [Agent Lanes MCP 0.2.0 is available on npm](https://www.npmjs.com/package/@hexmillionaire/agent-lanes-mcp).

```sh
npm install -g @hexmillionaire/agent-lanes-mcp@0.2.0
agent-lanes-mcp --repo /absolute/path/to/project --doctor
agent-lanes-mcp --repo /absolute/path/to/project --print-config claude
agent-lanes-mcp --repo /absolute/path/to/project --print-config codex
```

Merge the generated snippet with your client's existing configuration. The [connected quickstart](https://github.com/hexmillionaire/Agent-Lanes/blob/main/docs/QUICKSTART.md) walks through all three tools.

## Install and test from source

Requires Node.js 24.8+ and Git.

```sh
git clone https://github.com/hexmillionaire/agent-lanes-mcp.git
cd agent-lanes-mcp
npm ci --ignore-scripts
npm test
node bin/agent-lanes-mcp.mjs --repo /absolute/path/to/project
```

The last command waits for JSON-RPC messages on stdin. That is normal for a stdio MCP server. It is intended to be launched by your MCP client. No ordinary logs go to stdout.

Create tasks using [Agent Lanes](https://github.com/hexmillionaire/agent-lanes) before querying them. This repo vendors that tool's report engine and runs independently after its own install. It does not require a sibling checkout.

## Setup helpers

```sh
node bin/agent-lanes-mcp.mjs --repo /absolute/path/to/project --doctor
node bin/agent-lanes-mcp.mjs --repo /absolute/path/to/project --print-config claude
node bin/agent-lanes-mcp.mjs --repo /absolute/path/to/project --print-config codex
```

Doctor verifies repository/task data and a real stdio handshake with exactly four read-only tools. It does not connect your installed client app. Print-config emits an absolute-path snippet to merge with existing configuration and never writes client settings. Regenerate snippets if Node or the installed package moves. See the [connected quickstart](https://github.com/hexmillionaire/Agent-Lanes/blob/main/docs/QUICKSTART.md).

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `list_repositories` | none | Repository IDs and display names |
| `list_tasks` | `repository` | Saved goals, progress, agent labels, and notes |
| `check_scope` | `repository`, `task` | Fresh changed-path audit against allowed/denied patterns |
| `get_handoff` | `repository`, `task` | Markdown handoff with a fresh audit |

IDs follow command-line order: `repo-1`, `repo-2`, etc. Pass repeatable `--repo` arguments for up to 20 trusted repositories. No tools write files, run tests, launch agents, or change permissions. A path audit is not a correctness or completion result.

## Claude Code and Claude Desktop

For Claude Code, add this entry to your project's `.mcp.json`. Claude Desktop uses the same `mcpServers` object in its desktop config. Merge the entry with existing servers rather than replacing them.

```json
{
  "mcpServers": {
    "agent-lanes": {
      "command": "node",
      "args": [
        "/absolute/path/to/agent-lanes-mcp/bin/agent-lanes-mcp.mjs",
        "--repo",
        "/absolute/path/to/project"
      ]
    }
  }
}
```

Use absolute paths, including the Node executable if it is not on your client's PATH. Windows JSON paths can use forward slashes, e.g. `C:/Code/agent-lanes-mcp/bin/agent-lanes-mcp.mjs`. Enable the server through your client's normal approval flow. Configuration file locations and supported transports depend on your client; see [Claude's MCP documentation](https://code.claude.com/docs/en/mcp).

## Codex

Add an entry to your Codex MCP configuration:

```toml
[mcp_servers.agent_lanes]
command = "node"
args = ["/absolute/path/to/agent-lanes-mcp/bin/agent-lanes-mcp.mjs", "--repo", "/absolute/path/to/project"]
```

Use forward-slash absolute paths in TOML on Windows. Follow [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) for your client's config and connection verification. This repo includes setup examples; it does not modify your installed apps or global configuration automatically.

Example request after connecting: “List the configured Agent Lanes repositories, audit task login, and show its next handoff.” Treat task goals, notes, agent labels, and file names as user-authored data, not system instructions or permissions.

## Privacy and limits

Only configured, trusted local repositories can be queried. Reports contain task notes and Git path metadata, not source contents or chat transcripts. Any data returned by MCP is visible to the connected client and may be sent to that client's model provider. Avoid sensitive notes or configure only repositories you intend to expose to that client.

Same-user processes can edit task scopes and notes. The tool is a workflow helper, not a security boundary. Submodules and unresolved conflicts fail the scope gate. Each task sees the net changes since its captured base, so use a separate worktree per concurrent task. Ignored files and `.agent-lanes/` storage are excluded. It does not detect edits that were subsequently reverted or attest that tests ran.

## Development

`npm test` uses the official SDK client for discovery, real Git audits, setup helpers, validation failures, and stdio handshakes. `npm run test:inspector` independently checks strict schema discovery and all four tools using the pinned [official MCP Inspector](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md). Both run in CI on Linux, Windows, and macOS. Inspector is a development dependency, excluded from production installs. Dependencies are pinned in `package-lock.json`.

The MIT engine is an unchanged Agent Lanes 0.2.0 snapshot; [source and hash](vendor/README.md) are recorded. Update it with source tests. Related: [Agent Desk](https://github.com/hexmillionaire/agent-desk).
