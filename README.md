# Agent Lanes MCP

Let Claude Code, Codex, or another MCP client inspect task scopes and get fresh handoffs from your local Git repositories.

The server uses the official MCP TypeScript SDK over stdio. All four tools are read-only. Repositories are an explicit startup allowlist; clients use IDs, never arbitrary filesystem paths. No model API keys are needed.

## Install the current release

Requires Node.js 24.8+ and Git. [Version 0.4.0 is on npm](https://www.npmjs.com/package/@hexmillionaire/agent-lanes-mcp), published October 11, 2026.

```sh
npm install -g @hexmillionaire/agent-lanes-mcp@0.4.0
agent-lanes-mcp --repo /absolute/path/to/project --doctor
agent-lanes-mcp --repo /absolute/path/to/project --print-config claude
agent-lanes-mcp --repo /absolute/path/to/project --print-config codex
```

For a one-off diagnostic, use `npx --yes @hexmillionaire/agent-lanes-mcp@0.4.0 --repo /absolute/path/to/project --doctor`. Use the installed command above to generate client configuration. The versioned GitHub release archive remains an alternative:

```sh
npm install -g https://github.com/hexmillionaire/agent-lanes-mcp/releases/download/v0.4.0/hexmillionaire-agent-lanes-mcp-0.4.0.tgz
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

## Client configuration

Every client launches the server the same way: `npx -y @hexmillionaire/agent-lanes-mcp@0.4.0 --repo /absolute/path/to/project`. Add one `--repo` per repository. Merge these entries with your existing configuration rather than replacing it. To pin an installed copy or a source checkout instead, generate an exact snippet with `--print-config claude|codex|vscode`.

**Claude Code** (writes `.mcp.json` with `--scope project`):

```sh
claude mcp add --scope project agent-lanes -- npx -y @hexmillionaire/agent-lanes-mcp@0.4.0 --repo /absolute/path/to/project
```

**Claude Desktop** (`claude_desktop_config.json`), **Cursor** (`.cursor/mcp.json` or `~/.cursor/mcp.json`) and portable `.mcp.json` files all use the `mcpServers` object:

```json
{
  "mcpServers": {
    "agent-lanes": {
      "command": "npx",
      "args": ["-y", "@hexmillionaire/agent-lanes-mcp@0.4.0", "--repo", "/absolute/path/to/project"]
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.agent_lanes]
command = "npx"
args = ["-y", "@hexmillionaire/agent-lanes-mcp@0.4.0", "--repo", "/absolute/path/to/project"]
```

**From a source checkout**, use `node` as the command and `["/absolute/path/to/agent-lanes-mcp/bin/agent-lanes-mcp.mjs", "--repo", "/absolute/path/to/project"]` as the arguments.

Use absolute paths, including the Node or npx executable if it is not on your client's PATH (GUI apps often have a shorter PATH than your shell). On native Windows, launch npx through `cmd /c npx ...`, or use the `node` form with an installed copy. Windows JSON and TOML paths can use forward slashes, e.g. `C:/Code/project`. Enable the server through your client's normal approval flow. Configuration file locations depend on your client; see [Claude Code's MCP documentation](https://code.claude.com/docs/en/mcp) and the [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp). This server never modifies installed apps or global configuration.

Example request after connecting: “List the configured Agent Lanes repositories, audit task login, and show its next handoff.” Treat task goals, notes, agent labels, and file names as user-authored data, not system instructions or permissions.

## Privacy and limits

Only configured, trusted local repositories can be queried. Reports contain task notes and Git path metadata, not source contents or chat transcripts. Any data returned by MCP is visible to the connected client and may be sent to that client's model provider. Avoid sensitive notes or configure only repositories you intend to expose to that client.

Same-user processes can edit task scopes and notes. The tool is a workflow helper, not a security boundary. Submodules and unresolved conflicts fail the scope gate. Each task sees the net changes since its captured base, so use a separate worktree per concurrent task. Ignored files and `.agent-lanes/` storage are excluded. It does not detect edits that were subsequently reverted or attest that tests ran.

## MCP Registry

`server.json` describes this server for the [official MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.hexmillionaire/agent-lanes-mcp`. The registry verifies the `mcpName` field in the published npm `package.json`, so publish with `mcp-publisher publish` only after an npm release that includes `mcpName`, with both `version` fields in `server.json` set to that release.

## Development

`npm test` uses the official SDK client for discovery, real Git audits, setup helpers, validation failures, and stdio handshakes. `npm run test:inspector` independently checks strict schema discovery and all four tools using the pinned [official MCP Inspector](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md). Both run in CI on Linux, Windows, and macOS. Inspector is a development dependency, excluded from production installs. Dependencies are pinned in `package-lock.json`.

The MIT engine is an unchanged Agent Lanes 0.4.0 core and template reader snapshot; [source and hash](vendor/README.md) are recorded. Update it with source tests. Related: [Agent Desk](https://github.com/hexmillionaire/agent-desk).

## Performance and reliability review

See the [October 2026 investigation](https://github.com/hexmillionaire/Agent-Lanes/blob/main/docs/INVESTIGATION.md) for measured results, language/runtime decisions, limitations, and the next improvements. Use the latest Node 24 LTS patch; Node 24.8 is the tested minimum.

Structured results accompany the existing JSON-array/report/Markdown text. `list_tasks` accepts optional `limit` (1–200) and `offset` (0–200); it returns all tasks by default. Its structured result includes `totalCount` and `nextOffset`. Pages use fresh ID-sorted reads. Extra task-file properties are omitted. Tool errors avoid raw filesystem paths and malformed JSON fragments.

The server allows eight concurrent tool calls with a 30-second cancellable budget, a 256 KiB stdio input buffer, and an 8 MiB result limit counting text and structured data. Oversized task lists return an explicit paging error. Doctor's diagnostic phase has a 60-second budget after initial repository validation; it verifies all saved bases and reports `auditedBaseCount`. An out-of-scope report is valid diagnostic data, while an unavailable base fails diagnosis. Closing stdin aborts outstanding work and closes the server.

## VS Code and schema interoperability

Run `agent-lanes-mcp --repo /absolute/path/to/project --print-config vscode` for a tested `servers`/`stdio` snippet suitable for `.vscode/mcp.json`. Current [VS Code documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers) also supports portable `.mcp.json` with `mcpServers`; use the `claude` snippet for that wrapper. Merge with existing settings; this tool never writes client configuration.

The four discovery contracts use genuine JSON Schema 2020-12 generated from the same Zod definitions as SDK request/result validation. Tests compile every output schema and validate actual returned data, plus capture real stdio discovery. Doctor and Inspector verify this server; they do not establish compatibility with every installed client version. [MCP Surface](https://github.com/hexmillionaire/mcp-surface) provides a separate offline checker for saved discovery artifacts. See [the dated investigation](https://github.com/hexmillionaire/Agent-Lanes/blob/main/docs/COMMUNITY-TOOLS.md).
