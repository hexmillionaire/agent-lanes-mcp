import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

const FILE = '.agent-lanes-templates.json';
const MAX_BYTES = 65536;
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Invalid ${label} fields.`);
}
function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`Invalid template ${label}.`);
  return value;
}
function pattern(value) {
  if (typeof value !== 'string' || !value || value.length > 256 || value.startsWith('/') || value.includes('\\') || value.split('/').includes('..') || /[:\x00-\x1f!{}[\]()]/.test(value)) throw new Error('Invalid template scope pattern.');
  return value;
}

/** Read a bounded data-only template file; missing configuration means no templates. */
export async function readTemplates(root, { signal } = {}) {
  signal?.throwIfAborted();
  const resolved = await realpath(root);
  const filename = path.join(resolved, FILE);
  let stat;
  try { stat = await lstat(filename); } catch (error) { if (error.code === 'ENOENT') return { version: 1, templates: [] }; throw error; }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error('Templates must be a regular JSON file under 64 KiB.');
  const handle = await open(filename, 'r');
  let bytes;
  try {
    const current = await handle.stat();
    if (!current.isFile() || current.dev !== stat.dev || current.ino !== stat.ino || current.size > MAX_BYTES) throw new Error('Template file changed while opening.');
    // Bound allocation even if another process grows the file after stat.
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      signal?.throwIfAborted();
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > MAX_BYTES) throw new Error('Templates must fit within 64 KiB.');
    bytes = buffer.subarray(0, length);
  } finally { await handle.close(); }
  const document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  object(document, ['version', 'templates'], 'template document');
  if (document.version !== 1 || !Array.isArray(document.templates) || document.templates.length > 50) throw new Error('Templates require version 1 and at most 50 entries.');
  const seen = new Set();
  const templates = document.templates.map(item => {
    object(item, ['id', 'name', 'description', 'allow', 'deny'], 'template');
    if (typeof item.id !== 'string' || !ID.test(item.id) || seen.has(item.id)) throw new Error('Template IDs must be unique valid task IDs.');
    seen.add(item.id);
    if (!Array.isArray(item.allow) || !item.allow.length || item.allow.length > 100 || (item.deny !== undefined && (!Array.isArray(item.deny) || item.deny.length > 100))) throw new Error('Template needs 1-100 allow patterns and up to 100 deny patterns.');
    return { id: item.id, name: item.name === undefined ? item.id : text(item.name, 'name', 100), description: item.description === undefined ? '' : text(item.description, 'description', 500), allow: item.allow.map(pattern), deny: (item.deny ?? []).map(pattern) };
  });
  return { version: 1, templates };
}
