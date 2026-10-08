import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const serverPath = fileURLToPath(new URL('../bin/agent-lanes-mcp.mjs', import.meta.url));
export const TOOL_NAMES = ['check_scope', 'get_handoff', 'list_repositories', 'list_tasks'];

export function clientConfig(client, repositories) {
  const args = [serverPath, ...repositories.flatMap(repo => ['--repo', repo.path])];
  if (client === 'claude') return JSON.stringify({ mcpServers: { 'agent-lanes': { command: process.execPath, args } } }, null, 2) + '\n';
  if (client === 'codex') return `[mcp_servers.agent_lanes]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ${JSON.stringify(args)}\n`;
  throw new Error('--print-config must be claude or codex.');
}

export async function diagnose(repositories) {
  const client = new Client({ name: 'agent-lanes-doctor', version: '0.2.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath, ...repositories.flatMap(repo => ['--repo', repo.path])], stderr: 'pipe' });
  // Drain stderr without echoing local paths or protocol noise to stdout.
  transport.stderr?.resume();
  try {
    await client.connect(transport, { timeout: 15000 });
    const { tools } = await client.listTools({}, { timeout: 15000 });
    if (JSON.stringify(tools.map(tool => tool.name).sort()) !== JSON.stringify(TOOL_NAMES) || tools.some(tool => tool.annotations?.readOnlyHint !== true)) throw new Error('Expected exactly four read-only tools.');
    const results = [];
    for (const repo of repositories) {
      const result = await client.callTool({ name: 'list_tasks', arguments: { repository: repo.id } }, undefined, { timeout: 15000 });
      if (result.isError) throw new Error(`${repo.name}: ${result.content[0]?.text || 'Task validation failed.'}`);
      const tasks = JSON.parse(result.content[0].text);
      results.push({ id: repo.id, name: repo.name, taskCount: tasks.length });
    }
    return { ok: true, node: process.version, transport: 'stdio', tools: TOOL_NAMES, repositories: results };
  } finally { await client.close(); }
}
