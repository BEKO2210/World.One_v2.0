#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — i18n-Validator
   i18n/de.json und i18n/en.json müssen dieselben Schlüssel haben,
   keine leeren Werte, und gleiche {platzhalter} je Schlüssel.
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (l) => JSON.parse(readFileSync(join(ROOT, 'i18n', `${l}.json`), 'utf8'));
const de = load('de');
const en = load('en');
const errors = [];

for (const k of Object.keys(de)) if (!(k in en)) errors.push(`fehlt in en: ${k}`);
for (const k of Object.keys(en)) if (!(k in de)) errors.push(`fehlt in de: ${k}`);
for (const [lang, obj] of [['de', de], ['en', en]]) {
  for (const [k, v] of Object.entries(obj)) if (typeof v !== 'string' || !v.trim()) errors.push(`leer (${lang}): ${k}`);
}
const params = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
for (const k of Object.keys(de)) {
  if (k in en && params(de[k]) !== params(en[k])) errors.push(`Platzhalter verschieden: ${k} (de: ${params(de[k])} / en: ${params(en[k])})`);
}

if (errors.length) {
  errors.forEach(e => console.error(`[validate-i18n] ${e}`));
  process.exit(1);
}
console.log(`[validate-i18n] OK — ${Object.keys(de).length} Schlüssel, DE/EN deckungsgleich`);
