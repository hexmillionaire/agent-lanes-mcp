import { fileURLToPath } from 'node:url';
import { checkTasks, VERSION } from '../vendor/agent-lanes.mjs';

export const serverPath = fileURLToPath(new URL('../bin/agent-lanes-mcp.mjs', import.meta.url));
export const TOOL_NAMES = ['check_scope', 'get_handoff', 'list_repositories', 'list_tasks'];

export function clientConfig(client, repositories) {
  const args = [serverPath, ...repositories.flatMap(repo => ['--repo', repo.path])];
  if (client === 'claude') return JSON.stringify({ mcpServers: { 'agent-lanes': { command: process.execPath, args } } }, null, 2) + '\n';
  if (client === 'codex') return `[mcp_servers.agent_lanes]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ${JSON.stringify(args)}\n`;
  throw new Error('--print-config must be claude or codex.');
}

export async function diagnose(repositories, { signal: callerSignal } = {}) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException('Doctor timed out after 60 seconds.', 'TimeoutError')), 60000);
  timer.unref();
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline.signal]) : deadline.signal;
  let client;
  try {
    signal.throwIfAborted();
    const [{ Client }, { StdioClientTransport }] = await Promise.all([
      import('@modelcontextprotocol/sdk/client/index.js'),
      import('@modelcontextprotocol/sdk/client/stdio.js'),
    ]);
    signal.throwIfAborted();
    client = new Client({ name: 'agent-lanes-doctor', version: VERSION });
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath, ...repositories.flatMap(repo => ['--repo', repo.path])], stderr: 'pipe' });
    // Drain stderr without echoing local paths or protocol noise to stdout.
    transport.stderr?.resume();
    await client.connect(transport, { timeout: 15000, signal });
    const { tools } = await client.listTools({}, { timeout: 15000, signal });
    if (JSON.stringify(tools.map(tool => tool.name).sort()) !== JSON.stringify(TOOL_NAMES) || tools.some(tool => tool.annotations?.readOnlyHint !== true)) throw new Error('Expected exactly four read-only tools.');
    const results = [];
    for (const repo of repositories) {
      signal.throwIfAborted();
      const tasks = [];
      let offset = 0;
      let totalCount;
      do {
        const result = await client.callTool({ name: 'list_tasks', arguments: { repository: repo.id, limit: 20, offset } }, undefined, { timeout: 15000, signal });
        if (result.isError) throw new Error(`${repo.name}: ${result.content[0]?.text || 'Task validation failed.'}`);
        const page = result.structuredContent;
        totalCount ??= page.totalCount;
        if (totalCount !== page.totalCount) throw new Error(`${repo.name}: Task list changed during diagnosis; retry.`);
        tasks.push(...page.tasks);
        offset = page.nextOffset;
      } while (offset !== null);
      if (tasks.length !== totalCount || new Set(tasks.map(task => task.id)).size !== totalCount) throw new Error(`${repo.name}: Task list changed during diagnosis; retry.`);
      // Verify every saved base using one fresh batch rather than a separate Git
      // snapshot for each task. Also exercise the scope tool over the real transport.
      await checkTasks(repo.path, tasks, { signal });
      if (tasks.length) {
        const scope = await client.callTool({ name: 'check_scope', arguments: { repository: repo.id, task: tasks[0].id } }, undefined, { timeout: 15000, signal });
        if (scope.isError) throw new Error(`${repo.name}: ${scope.content[0]?.text || 'Scope audit failed.'}`);
      }
      results.push({ id: repo.id, name: repo.name, taskCount: tasks.length, auditedBaseCount: new Set(tasks.map(task => task.base)).size });
    }
    return { ok: true, node: process.version, transport: 'stdio', tools: TOOL_NAMES, repositories: results };
  } finally { clearTimeout(timer); await client?.close(); }
}
