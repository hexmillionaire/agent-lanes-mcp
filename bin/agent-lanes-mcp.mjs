#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { repoRoot } from '../vendor/agent-lanes.mjs';
import { clientConfig, diagnose } from '../src/setup.mjs';

try {
  const { values } = parseArgs({ strict: true, options: { repo: { type: 'string', multiple: true }, doctor: { type: 'boolean' }, 'print-config': { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) console.error('Agent Lanes MCP: --repo <trusted-path> (repeatable, up to 20).\n--print-config claude|codex: print an absolute-path config snippet; never modify installed client configuration.\n--doctor: verify Git repositories, task data, and a real stdio handshake.\nUses stdio by default. Repository IDs are repo-1, repo-2, etc. Four read-only tools; no model API calls.');
  else {
    if (!values.repo?.length || values.repo.length > 20) throw new Error('Configure 1-20 trusted repositories with --repo.');
    if (values.doctor && values['print-config']) throw new Error('Use --doctor or --print-config, not both.');
    if (values['print-config'] && !['claude', 'codex'].includes(values['print-config'])) throw new Error('--print-config must be claude or codex.');
    const repositories = await Promise.all(values.repo.map(async (directory, i) => { const root = await repoRoot(directory); return { id: `repo-${i + 1}`, name: path.basename(root), path: root }; }));
    if (values['print-config']) process.stdout.write(clientConfig(values['print-config'], repositories));
    else if (values.doctor) console.log(JSON.stringify(await diagnose(repositories), null, 2));
    else {
      const [{ createLaneServer }, { StdioServerTransport }] = await Promise.all([
        import('../src/server.mjs'),
        import('@modelcontextprotocol/sdk/server/stdio.js'),
      ]);
      const server = createLaneServer(repositories);
      // SDK's stdio transport does not close itself when its input reaches EOF.
      // Closing the server aborts active request signals and their Git work.
      const closeOnEnd = () => {
        server.close().catch(() => { console.error('Agent Lanes MCP: could not close the stdio server.'); process.exitCode = 1; });
      };
      process.stdin.once('end', closeOnEnd);
      try { await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 256 * 1024 })); }
      catch (error) { process.stdin.off('end', closeOnEnd); throw error; }
    }
  }
} catch (error) { console.error(`Agent Lanes MCP: ${error.message}`); process.exitCode = 1; }
