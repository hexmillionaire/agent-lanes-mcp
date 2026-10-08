#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLaneServer } from '../src/server.mjs';
import { repoRoot } from '../vendor/agent-lanes.mjs';
import { clientConfig, diagnose } from '../src/setup.mjs';

try {
  const { values } = parseArgs({ strict: true, options: { repo: { type: 'string', multiple: true }, doctor: { type: 'boolean' }, 'print-config': { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) console.error('Agent Lanes MCP: --repo <trusted-path> (repeatable, up to 20).\n--print-config claude|codex: print an absolute-path config snippet; never modify installed client configuration.\n--doctor: verify Git repositories, task data, and a real stdio handshake.\nUses stdio by default. Repository IDs are repo-1, repo-2, etc. Four read-only tools; no model API calls.');
  else {
    if (!values.repo?.length || values.repo.length > 20) throw new Error('Configure 1-20 trusted repositories with --repo.');
    const repositories = await Promise.all(values.repo.map(async (directory, i) => { const root = await repoRoot(directory); return { id: `repo-${i + 1}`, name: path.basename(root), path: root }; }));
    if (values.doctor && values['print-config']) throw new Error('Use --doctor or --print-config, not both.');
    if (values['print-config']) process.stdout.write(clientConfig(values['print-config'], repositories));
    else if (values.doctor) console.log(JSON.stringify(await diagnose(repositories), null, 2));
    else {
      const server = createLaneServer(repositories);
      await server.connect(new StdioServerTransport());
    }
  }
} catch (error) { console.error(`Agent Lanes MCP: ${error.message}`); process.exitCode = 1; }
