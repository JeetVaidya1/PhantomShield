import crypto from 'crypto';

/**
 * Memorable-but-random alias local parts: `word-xxxxxx`. The word makes the
 * address easier to recognize at a glance; the random suffix keeps it
 * unguessable. (v2-013)
 */
const WORDS = [
  'amber', 'basalt', 'cedar', 'delta', 'ember', 'fjord', 'gusty', 'harbor',
  'indigo', 'juniper', 'kelp', 'lumen', 'maple', 'nimbus', 'onyx', 'pebble',
  'quartz', 'raven', 'slate', 'tundra', 'umber', 'vesper', 'willow', 'zephyr',
];

function pick<T>(arr: readonly T[]): T {
  return arr[crypto.randomInt(arr.length)];
}

/** Generate `word-randomchars@domain`. */
export function generateAliasAddress(domain: string): string {
  const word = pick(WORDS);
  const suffix = crypto.randomBytes(4).toString('hex'); // 8 hex chars
  return `${word}-${suffix}@${domain}`;
}
