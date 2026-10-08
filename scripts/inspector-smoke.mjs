import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { startTask } from '../vendor/agent-lanes.mjs';
import { clientConfig, TOOL_NAMES } from '../src/setup.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'lanes-inspector-'));
const inspector = fileURLToPath(new URL('../node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js', import.meta.url));
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [inspector, '--cli', '--config', path.join(root, 'mcp.json'), '--server', 'agent-lanes', '--format', 'json', ...args], { cwd: root, windowsHide: true, env: { ...process.env, MCP_STORAGE_DIR: path.join(root, 'inspector-storage') } });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Inspector timed out.')); }, 45000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Inspector exit ${code}: ${stderr}\n${stdout}`));
      try { resolve(JSON.parse(stdout).result); } catch (error) { reject(error); }
    });
  });
}
const call = (name, args) => run(['--method', 'tools/call', '--tool-name', name, '--tool-args-json', JSON.stringify(args)]);
try {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { windowsHide: true });
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); git('config', 'core.autocrlf', 'false');
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src/app.js'), 'baseline\n');
  await writeFile(path.join(root, '.gitignore'), '.agent-lanes/\nmcp.json\ninspector-storage/\n');
  git('add', '.'); git('commit', '-qm', 'Fixture');
  await startTask(root, { id: 'fix', goal: 'Fix app', allow: ['src/**'] });
  await writeFile(path.join(root, 'mcp.json'), clientConfig('claude', [{ path: root }]));
  const discovery = await run(['--method', 'tools/list', '--strict']);
  assert.deepEqual(discovery.tools.map(tool => tool.name).sort(), TOOL_NAMES);
  for (const tool of discovery.tools) assert.equal(tool.annotations.readOnlyHint, true);
  const repos = await call('list_repositories', {});
  assert.equal(JSON.parse(repos.content[0].text)[0].id, 'repo-1');
  const tasks = await call('list_tasks', { repository: 'repo-1' });
  assert.equal(JSON.parse(tasks.content[0].text)[0].id, 'fix');
  await writeFile(path.join(root, 'outside.txt'), 'scope failure\n');
  const check = await call('check_scope', { repository: 'repo-1', task: 'fix' });
  assert.equal(JSON.parse(check.content[0].text).ok, false);
  const packet = await call('get_handoff', { repository: 'repo-1', task: 'fix' });
  assert.match(packet.content[0].text, /outside.txt/);
  console.log('Official MCP Inspector: strict schema discovery and all four tools passed over stdio.');
} finally { await rm(root, { recursive: true, force: true }); }
