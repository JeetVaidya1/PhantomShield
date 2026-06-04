#!/usr/bin/env node
// Flip passes:true for the given story IDs in prd-v2-final.json (immutable rewrite).
import { readFileSync, writeFileSync } from 'fs';

const ids = new Set(process.argv.slice(2));
if (ids.size === 0) {
  console.error('usage: mark-passed.mjs <story-id> [<story-id> ...]');
  process.exit(1);
}

const path = new URL('../prd-v2-final.json', import.meta.url);
const data = JSON.parse(readFileSync(path, 'utf-8'));

let changed = 0;
const visit = (node) => {
  if (Array.isArray(node)) return node.map(visit);
  if (node && typeof node === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(node)) next[k] = visit(v);
    if (typeof next.id === 'string' && ids.has(next.id) && next.passes !== true) {
      changed++;
      return { ...next, passes: true };
    }
    return next;
  }
  return node;
};

const updated = visit(data);
writeFileSync(path, JSON.stringify(updated, null, 2) + '\n');
console.log(`Marked ${changed} story(ies) passing: ${[...ids].join(', ')}`);
