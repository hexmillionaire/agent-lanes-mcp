import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { VERSION } from '../vendor/agent-lanes.mjs';
const source = JSON.parse(await readFile(new URL('../vendor/source.json', import.meta.url), 'utf8'));
// Hash Git's canonical LF source independently of checkout line endings.
const canonical = (await readFile(new URL('../vendor/agent-lanes.mjs', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const notes = await readFile(new URL('../vendor/README.md', import.meta.url), 'utf8');
assert.equal(VERSION, source.version);
assert.equal(createHash('sha256').update(canonical).digest('hex'), source.sha256);
assert.ok(notes.includes(source.source) && notes.includes(source.sha256));
console.log('Vendored Agent Lanes version and canonical source SHA-256 verified.');
