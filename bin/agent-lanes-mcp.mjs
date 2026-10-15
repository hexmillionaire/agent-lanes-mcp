#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { repoRoot } from '../vendor/agent-lanes.mjs';
import { clientConfig, diagnose } from '../src/setup.mjs';

try {
  const { values } = parseArgs({ strict: true, options: { repo: { type: 'string', multiple: true }, doctor: { type: 'boolean' }, 'print-config': { type: 'string' }, help: { type: 'boolean' }, version: { type: 'boolean' } } });
  // --help and --version never start the stdio server, so stdout is safe to use.
  if (values.version) console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  else if (values.help) console.log('Agent Lanes MCP: read-only MCP stdio server for Agent Lanes task scopes and handoffs.\n\nUsage: agent-lanes-mcp --repo <trusted-path> [--repo <path> ...] [--doctor | --print-config claude|codex|vscode]\n\n--repo <path>: trusted Git repository (repeatable, up to 20). IDs are repo-1, repo-2, etc.\n--print-config claude|codex|vscode: print an absolute-path config snippet; never modify installed client configuration.\n--doctor: verify Git repositories, task data, and a real stdio handshake.\n--version: print the package version.\nUses stdio by default. Four read-only tools; no model API calls.');
  else {
    if (!values.repo?.length || values.repo.length > 20) throw new Error('Configure 1-20 trusted repositories with --repo.');
    if (values.doctor && values['print-config']) throw new Error('Use --doctor or --print-config, not both.');
    if (values['print-config'] && !['claude', 'codex', 'vscode'].includes(values['print-config'])) throw new Error('--print-config must be claude, codex, or vscode.');
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
