import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access, realpath } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const source = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const tempBase = await realpath(os.tmpdir());
const temp = await mkdtemp(path.join(tempBase, 'agent-package-'));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run test:package.');

function run(command, args, { cwd = source, expected = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    child.stdin.end();
    let stdout = ''; let stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Package smoke test timed out.')); }, 60000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== expected) reject(new Error(`Expected exit ${expected}, got ${code}: ${stderr}\n${stdout}`));
      else resolve(stdout);
    });
  });
}

try {
  const packed = JSON.parse(await run(process.execPath, [npm, 'pack', '--json', '--pack-destination', temp]))[0];
  assert.equal(packed.version, '0.2.0');
  for (const file of packed.files) assert.ok(!/^(node_modules|test|\.agent-lanes|\.git)\//.test(file.path), file.path);
  const install = path.join(temp, 'install');
  await mkdir(install);
  await run(process.execPath, [npm, 'install', '--prefix', install, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, packed.filename)]);
  const installed = path.join(install, 'node_modules', ...manifest.name.split('/'));
  const bin = path.join(installed, Object.values(manifest.bin)[0]);
  await run(process.execPath, [bin, '--help']);
  const repo = path.join(temp, 'repo with space');
  await mkdir(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true }).trim();
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid'); git('config', 'core.autocrlf', 'false');
  await writeFile(path.join(repo, 'app.js'), 'baseline\n');
  await writeFile(path.join(repo, '.gitignore'), '.agent-lanes/\n');
  await writeFile(path.join(repo, '.agent-lanes-policy.json'), JSON.stringify({ version: 1, lanes: { fix: { allow: ['app.js'], deny: [] } } }));
  git('add', '.'); git('commit', '-qm', 'Fixture');
  const base = git('rev-parse', 'HEAD');
  const name = manifest.name.split('/')[1];
  if (name === 'agent-lanes') {
    await run(process.execPath, [bin, 'start', 'fix', '--repo', repo, '--goal', 'Fix app', '--allow', 'app.js']);
    assert.equal(JSON.parse(await run(process.execPath, [bin, 'check', 'fix', '--repo', repo, '--json'])).ok, true);
    await writeFile(path.join(repo, 'app.js'), 'change\n'); git('commit', '-qam', 'PR change');
    const head = git('rev-parse', 'HEAD');
    assert.equal(JSON.parse(await run(process.execPath, [bin, 'check-pr', 'fix', '--repo', repo, '--base', base, '--head', head, '--json'])).ok, true);
    await writeFile(path.join(repo, 'outside.txt'), 'outside\n');
    assert.equal(JSON.parse(await run(process.execPath, [bin, 'check', 'fix', '--repo', repo, '--json'], { expected: 1 })).ok, false);
  } else if (name === 'agent-desk') {
    const child = spawn(process.execPath, [bin, '--repo', repo, '--port', '0'], { windowsHide: true });
    try {
      const url = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Desk did not listen.')), 10000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
      });
      const session = await (await fetch(`${url}/api/session`)).json();
      assert.equal(session.writable, true);
      const created = await fetch(`${url}/api/tasks`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', 'X-Agent-Desk-Token': session.token }, body: JSON.stringify({ repository: 'repo-1', task: { id: 'fix', goal: 'Fix app', allow: ['app.js'] } }) });
      assert.equal(created.status, 201);
      assert.equal((await (await fetch(`${url}/api/overview`)).json()).repositories[0].reports[0].task.id, 'fix');
      assert.match(await (await fetch(url)).text(), /New task/);
    } finally {
      const closed = new Promise(resolve => child.once('close', resolve));
      child.kill(); await closed;
    }
  } else if (name === 'agent-lanes-mcp') {
    const doctor = JSON.parse(await run(process.execPath, [bin, '--repo', repo, '--doctor']));
    assert.equal(doctor.ok, true); assert.equal(doctor.tools.length, 4);
    const config = JSON.parse(await run(process.execPath, [bin, '--repo', repo, '--print-config', 'claude']));
    assert.equal(config.mcpServers['agent-lanes'].args[0], bin);
    await assert.rejects(access(path.join(install, 'node_modules/@modelcontextprotocol/inspector')));
  } else throw new Error('Unknown package.');
  console.log(`${manifest.name}: fresh production archive installation and CLI workflow passed.`);
} finally {
  assert.ok(temp.startsWith(path.join(tempBase, 'agent-package-')));
  await rm(temp, { recursive: true, force: true });
}
