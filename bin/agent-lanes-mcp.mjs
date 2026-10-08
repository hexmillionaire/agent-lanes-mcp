#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLaneServer } from '../src/server.mjs';
import { repoRoot } from '../vendor/agent-lanes.mjs';

try {
  const { values } = parseArgs({ strict: true, options: { repo: { type: 'string', multiple: true }, help: { type: 'boolean' } } });
  if (values.help) console.error('Agent Lanes MCP: --repo <trusted-path> (repeatable, up to 20).\nUses stdio. Repository IDs are repo-1, repo-2, etc. No write tools or model API calls.');
  else {
    if (!values.repo?.length || values.repo.length > 20) throw new Error('Configure 1-20 trusted repositories with --repo.');
    const repositories = await Promise.all(values.repo.map(async (directory, i) => { const root = await repoRoot(directory); return { id: `repo-${i + 1}`, name: path.basename(root), path: root }; }));
    const server = createLaneServer(repositories);
    await server.connect(new StdioServerTransport());
  }
} catch (error) { console.error(`Agent Lanes MCP: ${error.message}`); process.exitCode = 1; }
