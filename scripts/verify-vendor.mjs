import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { VERSION } from '../vendor/agent-lanes.mjs';
const metadata = JSON.parse(await readFile(new URL('../vendor/source.json', import.meta.url), 'utf8'));
const notes = await readFile(new URL('../vendor/README.md', import.meta.url), 'utf8');
assert.equal(VERSION, metadata.version);
assert.deepEqual(Object.keys(metadata.files).sort(), ['agent-lanes.mjs', 'templates.mjs']);
for (const [name, recorded] of Object.entries(metadata.files)) {
  const canonical = (await readFile(new URL('../vendor/' + name, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  assert.equal(createHash('sha256').update(canonical).digest('hex'), recorded.sha256, name);
  assert.ok(notes.includes(recorded.source) && notes.includes(recorded.sha256));
}
console.log('Vendored Agent Lanes version and both canonical source SHA-256 hashes verified.');
