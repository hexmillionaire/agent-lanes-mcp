import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createLaneServer } from '../src/server.mjs';
import { startTask } from '../vendor/agent-lanes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-mcp-test-'));
  t.after(async () => { assert.ok(root.startsWith(path.join(os.tmpdir(), 'agent-mcp-test-'))); await rm(root, { recursive: true, force: true }); });
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { windowsHide: true });
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'core.autocrlf', 'false');
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, '.gitignore'), '.agent-lanes/\n');
  await writeFile(path.join(root, 'src', 'app.js'), 'baseline\n');
  git('add', '.');
  git('commit', '-qm', 'Fixture');
  await startTask(root, { id: 'login', goal: 'Fix login', allow: ['src/**'] });
  return root;
}

async function connect(t, repositories) {
  const server = createLaneServer(repositories);
  const client = new Client({ name: 'agent-lanes-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}

test('MCP handshake advertises exactly four read-only tools', async t => {
  const client = await connect(t, []);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['check_scope', 'get_handoff', 'list_repositories', 'list_tasks']);
  for (const tool of tools) assert.equal(tool.annotations.readOnlyHint, true);
});

test('repositories are named allowlist entries without absolute path disclosure', async t => {
  const client = await connect(t, [{ id: 'repo-1', name: 'Demo', path: '/private/local/path' }]);
  const result = await client.callTool({ name: 'list_repositories', arguments: {} });
  assert.deepEqual(JSON.parse(result.content[0].text), [{ id: 'repo-1', name: 'Demo' }]);
});

test('real task and Git changes are exposed through the SDK client', async t => {
  const root = await fixture(t);
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  const tasks = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1' } });
  assert.equal(JSON.parse(tasks.content[0].text)[0].id, 'login');
  await writeFile(path.join(root, 'outside.txt'), 'fixture\n');
  const check = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } });
  const report = JSON.parse(check.content[0].text);
  assert.equal(report.ok, false);
  assert.equal(report.changes[0].verdict, 'outside');
  const result = await client.callTool({ name: 'get_handoff', arguments: { repository: 'repo-1', task: 'login' } });
  assert.match(result.content[0].text, /REVIEW REQUIRED/);
});

test('unconfigured repositories and invalid task IDs fail without file access', async t => {
  const client = await connect(t, []);
  const result = await client.callTool({ name: 'list_tasks', arguments: { repository: '/arbitrary/path' } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /not configured/);
  const invalid = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: '../secret' } });
  assert.equal(invalid.isError, true);
});

test('packaged CLI completes a real stdio MCP handshake', async t => {
  const root = await fixture(t);
  const client = new Client({ name: 'stdio-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../bin/agent-lanes-mcp.mjs', import.meta.url)), '--repo', root], stderr: 'pipe' });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 4);
  const result = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } });
  assert.equal(JSON.parse(result.content[0].text).ok, true);
});
