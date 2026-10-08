import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { clientConfig, diagnose, serverPath, TOOL_NAMES } from '../src/setup.mjs';
import { startTask } from '../vendor/agent-lanes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mcp setup space-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { windowsHide: true });
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); git('config', 'core.autocrlf', 'false');
  await writeFile(path.join(root, 'app.js'), 'baseline\n'); git('add', '.'); git('commit', '-qm', 'Fixture');
  await startTask(root, { id: 'fix', goal: 'Fix app', allow: ['app.js'] });
  return [{ id: 'repo-1', name: 'Fixture', path: root }];
}

test('prints portable Claude JSON and Codex TOML with absolute commands and paths', () => {
  const repositories = [{ path: 'C:\\Code\\project with space' }];
  const config = JSON.parse(clientConfig('claude', repositories));
  assert.equal(config.mcpServers['agent-lanes'].command, process.execPath);
  assert.deepEqual(config.mcpServers['agent-lanes'].args, [serverPath, '--repo', repositories[0].path]);
  const toml = clientConfig('codex', repositories);
  assert.match(toml, /^\[mcp_servers.agent_lanes\]/);
  const args = JSON.parse(toml.split('\n').find(line => line.startsWith('args = ')).slice(7));
  assert.deepEqual(args, config.mcpServers['agent-lanes'].args);
  assert.throws(() => clientConfig('invalid', repositories));
});

test('doctor probes real stdio and validates tasks', async t => {
  const repositories = await fixture(t);
  const result = await diagnose(repositories);
  assert.equal(result.ok, true);
  assert.deepEqual(result.tools, TOOL_NAMES);
  assert.equal(result.repositories[0].taskCount, 1);
  assert.equal(result.repositories[0].auditedBaseCount, 1);
  await writeFile(path.join(repositories[0].path, '.agent-lanes/fix.json'), '{}');
  await assert.rejects(diagnose(repositories), /Unsupported task format/);
});

test('doctor detects unavailable base commits even when task JSON is valid', async t => {
  const repositories = await fixture(t);
  await startTask(repositories[0].path, { id: 'other', goal: 'Another task', allow: ['app.js'] });
  const file = path.join(repositories[0].path, '.agent-lanes/other.json');
  const task = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...task, base: '0'.repeat(40) }));
  await assert.rejects(diagnose(repositories), /Git/);
});

test('doctor can be cancelled before launching a child process', async t => {
  const repositories = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(diagnose(repositories, { signal: controller.signal }), { name: 'AbortError' });
});

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Child process timed out.')); }, 45000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

test('setup CLI prints JSON, resolves repository roots, and rejects mixed modes', async t => {
  const repositories = await fixture(t);
  const result = await run(process.execPath, [serverPath, '--repo', repositories[0].path, '--print-config', 'claude']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).mcpServers['agent-lanes'].args[2], await realpath(repositories[0].path));
  const invalid = await run(process.execPath, [serverPath, '--repo', repositories[0].path, '--doctor', '--print-config', 'claude']);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /not both/);
  const noAccess = await run(process.execPath, [serverPath, '--repo', path.join(repositories[0].path, 'absent'), '--doctor', '--print-config', 'claude']);
  assert.match(noAccess.stderr, /not both/);
  const badClient = await run(process.execPath, [serverPath, '--repo', path.join(repositories[0].path, 'absent'), '--print-config', 'unsupported']);
  assert.match(badClient.stderr, /must be claude or codex/);
});
