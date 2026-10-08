import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createLaneServer } from '../src/server.mjs';
import { startTask, git as executeGit } from '../vendor/agent-lanes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-mcp-test-'));
  t.after(async () => { assert.ok(root.startsWith(path.join(os.tmpdir(), 'agent-mcp-test-'))); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); });
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
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.outputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});

test('repositories are named allowlist entries without absolute path disclosure', async t => {
  const client = await connect(t, [{ id: 'repo-1', name: 'Demo', path: '/private/local/path' }]);
  const result = await client.callTool({ name: 'list_repositories', arguments: {} });
  assert.deepEqual(JSON.parse(result.content[0].text), [{ id: 'repo-1', name: 'Demo' }]);
  assert.deepEqual(result.structuredContent, { repositories: [{ id: 'repo-1', name: 'Demo' }] });
});

test('real task and Git changes are exposed through the SDK client', async t => {
  const root = await fixture(t);
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  const tasks = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1' } });
  assert.equal(JSON.parse(tasks.content[0].text)[0].id, 'login');
  assert.deepEqual(tasks.structuredContent.tasks, JSON.parse(tasks.content[0].text));
  await writeFile(path.join(root, 'outside.txt'), 'fixture\n');
  const check = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } });
  const report = JSON.parse(check.content[0].text);
  assert.deepEqual(check.structuredContent, report);
  assert.equal(report.ok, false);
  assert.equal(report.changes[0].verdict, 'outside');
  const result = await client.callTool({ name: 'get_handoff', arguments: { repository: 'repo-1', task: 'login' } });
  assert.match(result.content[0].text, /REVIEW REQUIRED/);
  assert.equal(result.structuredContent.handoff, result.content[0].text);
});

test('only documented task fields leave the server; local task files are unchanged', async t => {
  const root = await fixture(t);
  const file = path.join(root, '.agent-lanes/login.json');
  const saved = JSON.parse(await readFile(file, 'utf8'));
  const original = JSON.stringify({ ...saved, localCredential: 'keep-this-local', extension: { absolutePath: root } });
  await writeFile(file, original);
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  for (const name of ['list_tasks', 'check_scope', 'get_handoff']) {
    const result = await client.callTool({ name, arguments: { repository: 'repo-1', ...(name === 'list_tasks' ? {} : { task: 'login' }) } });
    assert.notEqual(result.isError, true, result.content[0].text);
    assert.doesNotMatch(JSON.stringify(result), /keep-this-local|localCredential|absolutePath/);
  }
  assert.equal(await readFile(file, 'utf8'), original);
});

test('missing and malformed task errors do not expose local paths or invalid JSON fragments', async t => {
  const root = await fixture(t);
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  const missing = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'missing' } });
  assert.equal(missing.isError, true);
  assert.ok(!missing.content[0].text.includes(root));
  assert.match(missing.content[0].text, /Task data is unavailable|does not exist/);
  await writeFile(path.join(root, '.agent-lanes/login.json'), 'private-secret-is-not-json');
  const malformed = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1' } });
  assert.equal(malformed.isError, true);
  assert.equal(malformed.content[0].text, 'Task JSON is invalid. Repair the task data locally.');
  assert.doesNotMatch(JSON.stringify(malformed), /private-secret/);
});

test('strict inputs reject additional paths and excessive nested input', async t => {
  const client = await connect(t, []);
  const extra = await client.callTool({ name: 'list_repositories', arguments: { path: '/private/path' } });
  assert.equal(extra.isError, true);
  const excessive = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1', extra: Array(9).fill(0) } });
  assert.equal(excessive.isError, true);
  assert.match(excessive.content[0].text, /maximum of 8 elements/);
});

test('tool concurrency is bounded and slots are released after audits finish', async t => {
  const root = await fixture(t);
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  const results = await Promise.all(Array.from({ length: 9 }, () => client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } })));
  assert.equal(results.filter(result => result.isError && /Server is busy/.test(result.content[0].text)).length, 1);
  assert.equal(results.filter(result => !result.isError).length, 8);
  const afterwards = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } });
  assert.equal(afterwards.structuredContent.ok, true);
});

test('SDK cancellation releases tool slots while the Git queue remains occupied', async t => {
  const root = await fixture(t);
  const heldController = new AbortController();
  // Git waits for stdin, occupying the six shared subprocess slots without
  // timing-sensitive repository mutations or platform-specific executable shims.
  const held = Array.from({ length: 6 }, () => executeGit(root, ['hash-object', '--stdin'], { signal: heldController.signal }).catch(error => error));
  try {
    const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
    const controllers = Array.from({ length: 8 }, () => new AbortController());
    const pending = controllers.map(controller => client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } }, undefined, { signal: controller.signal }).then(result => result, error => error));
    const busy = await client.callTool({ name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } });
    assert.match(busy.content[0].text, /Server is busy/);
    for (const controller of controllers) controller.abort(new Error('Stop this audit'));
    assert.ok((await Promise.all(pending)).every(result => result instanceof Error));
    const deadline = Date.now() + 2000;
    let available;
    do {
      available = await client.callTool({ name: 'list_repositories', arguments: {} });
      if (!available.isError) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    } while (Date.now() < deadline);
    assert.notEqual(available.isError, true, 'Cancelled audit handlers must release their slots before waiting Git subprocesses complete.');
  } finally { heldController.abort(); await Promise.all(held); }
});

test('task pagination preserves legacy JSON arrays and provides the next offset', async t => {
  const root = await fixture(t);
  await startTask(root, { id: 'another', goal: 'Another fix', allow: ['src/**'] });
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  const first = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1', limit: 1 } });
  assert.deepEqual(JSON.parse(first.content[0].text).map(task => task.id), ['another']);
  assert.equal(first.structuredContent.totalCount, 2);
  assert.equal(first.structuredContent.nextOffset, 1);
  const second = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1', limit: 1, offset: first.structuredContent.nextOffset } });
  assert.deepEqual(second.structuredContent.tasks.map(task => task.id), ['login']);
  assert.equal(second.structuredContent.nextOffset, null);
  const legacy = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1' } });
  assert.equal(JSON.parse(legacy.content[0].text).length, 2);
  assert.equal(legacy.structuredContent.nextOffset, null);
});

test('oversized task responses fail clearly and can be retrieved in smaller pages', async t => {
  const root = await fixture(t);
  const saved = JSON.parse(await readFile(path.join(root, '.agent-lanes/login.json'), 'utf8'));
  await Promise.all(Array.from({ length: 70 }, async (_, i) => {
    const id = `bulk-${String(i).padStart(3, '0')}`;
    const task = { ...saved, id, goal: 'a'.repeat(4000), summary: 'b'.repeat(4000), next: 'c'.repeat(4000), allow: Array(100).fill('a'.repeat(250)), deny: Array(100).fill('b'.repeat(250)) };
    const contents = JSON.stringify(task);
    assert.ok(Buffer.byteLength(contents) < 65536);
    await writeFile(path.join(root, '.agent-lanes', `${id}.json`), contents);
  }));
  const client = await connect(t, [{ id: 'repo-1', name: 'Fixture', path: root }]);
  const oversized = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1' } });
  assert.equal(oversized.isError, true);
  assert.match(oversized.content[0].text, /exceeds 8 MiB.*limit and offset/);
  const page = await client.callTool({ name: 'list_tasks', arguments: { repository: 'repo-1', limit: 10 } });
  assert.notEqual(page.isError, true);
  assert.equal(page.structuredContent.tasks.length, 10);
  assert.equal(page.structuredContent.totalCount, 71);
  assert.equal(page.structuredContent.nextOffset, 10);
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

test('stdio EOF closes active requests and their waiting Git subprocesses', async t => {
  const root = await fixture(t);
  const preload = path.join(root, 'hold-scope-git.mjs');
  // Instrument only this test child through Node's public promisify hook. The
  // scope handler still starts a real Git subprocess and receives real signals.
  await writeFile(preload, `import childProcess from 'node:child_process';
import { promisify } from 'node:util';
import { syncBuiltinESMExports } from 'node:module';
const original = childProcess.execFile;
const execute = promisify(original);
const wrapped = (...args) => original(...args);
wrapped[promisify.custom] = (command, args, options) => {
  const diff = args.indexOf('diff');
  if (command === 'git' && diff !== -1) {
    process.stderr.write('scope-git-started\\n');
    return execute(command, [...args.slice(0, diff), 'hash-object', '--stdin'], options);
  }
  return execute(command, args, options);
};
childProcess.execFile = wrapped;
syncBuiltinESMExports();
`);
  const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, fileURLToPath(new URL('../bin/agent-lanes-mcp.mjs', import.meta.url)), '--repo', root], { windowsHide: true });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  const waitFor = (ready, label) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error(`${label} did not complete: ${stderr}`)); }, 15000);
      const onData = () => { if (ready()) { cleanup(); resolve(); } };
      const onClose = () => { cleanup(); reject(new Error(`Server exited before ${label}: ${stderr}`)); };
      const cleanup = () => { clearTimeout(timer); child.stdout.off('data', onData); child.stderr.off('data', onData); child.off('close', onClose); };
      child.stdout.on('data', onData); child.stderr.on('data', onData); child.once('close', onClose); onData();
    });
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'eof-regression', version: '1.0.0' } } }) + '\n');
    await waitFor(() => stdout.split('\n').slice(0, -1).some(line => JSON.parse(line).id === 1), 'MCP initialization');
    assert.equal(JSON.parse(stdout.split('\n')[0]).result.protocolVersion, '2025-11-25');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'check_scope', arguments: { repository: 'repo-1', task: 'login' } } }) + '\n');
    await waitFor(() => stderr.includes('scope-git-started'), 'Scope Git start');
    child.stdin.end();
    let timer;
    const result = await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Server kept its active Git work alive after stdin EOF.')), 5000); })]).finally(() => clearTimeout(timer));
    assert.deepEqual(result, { code: 0, signal: null }, stderr);
    assert.deepEqual(stdout.split('\n').filter(Boolean).map(line => JSON.parse(line).id), [1], 'A disconnected scope request must not receive a late result.');
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill(); await closed; }
});
