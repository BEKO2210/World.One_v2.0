#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Score Coverage Validator
   Reports which cache files are consumed by process-data.js (→ score)
   and which sit unused. Verifies freshness metadata on every indicator.
   Exit 0 = PASS, 1 = FAIL.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROCESSOR = join(ROOT, 'scripts', 'process-data.js');
const CACHE_DIR = join(ROOT, 'data', 'cache');
const WORLD_STATE = join(ROOT, 'data', 'processed', 'world-state.json');

let errors = 0;
let warnings = 0;
const fail = (m) => { console.log(`  \u2718 ${m}`); errors++; };
const warn = (m) => { console.log(`  ! ${m}`); warnings++; };
const ok = (m) => console.log(`  \u2714 ${m}`);

console.log('\nValidating score coverage...\n');

// 1. Which caches does process-data.js read?
const src = readFileSync(PROCESSOR, 'utf8');
const cacheReads = [...new Set([...src.matchAll(/readCache(?:Fresh)?\('([^']+)'\)/g)].map(m => m[1]))];
ok(`process-data.js reads ${cacheReads.length} distinct cache files`);
console.log(`    ${cacheReads.sort().join(', ')}`);

// 2. Which caches exist but are NOT consumed?
const existing = existsSync(CACHE_DIR)
  ? readdirSync(CACHE_DIR).filter(f => f.endsWith('.json') && f !== 'meta.json')
  : [];
const unused = existing.filter(f => !cacheReads.includes(f));
if (unused.length > 0) {
  console.log('  ! Cache files NOT used in scoring (used only by detail pages):');
  unused.forEach(f => console.log(`      - ${f}`));
}

// 3. world-state.json: does every indicator have freshness metadata?
if (!existsSync(WORLD_STATE)) {
  fail(`world-state.json missing — run npm run process first`);
  process.exit(1);
}
const ws = JSON.parse(readFileSync(WORLD_STATE, 'utf8'));
const subScores = ws.subScores || {};

let indicatorsTotal = 0, indicatorsWithFresh = 0, indicatorsWithFetchedAt = 0;
for (const [cat, sub] of Object.entries(subScores)) {
  if (!Array.isArray(sub.indicators)) continue;
  // Momentum indicators are derived from other sub-scores and do not
  // have their own freshness metadata — skip them.
  if (cat === 'momentum') continue;
  for (const ind of sub.indicators) {
    indicatorsTotal++;
    if ('ageHours' in ind) indicatorsWithFresh++;
    if (ind.fetchedAt) indicatorsWithFetchedAt++;
  }
}
if (indicatorsTotal === indicatorsWithFresh) {
  ok(`All ${indicatorsTotal} scored indicators carry freshness metadata (momentum excluded — derived)`);
} else {
  fail(`Only ${indicatorsWithFresh}/${indicatorsTotal} indicators have ageHours`);
}
ok(`${indicatorsWithFetchedAt}/${indicatorsTotal} indicators have a fetchedAt timestamp (raw files may lack it locally)`);

// 4. meta.cacheFreshness is emitted
if (ws.meta?.cacheFreshness) {
  const cats = Object.keys(ws.meta.cacheFreshness);
  const populated = cats.filter(c => ws.meta.cacheFreshness[c] != null);
  ok(`meta.cacheFreshness covers ${populated.length}/${cats.length} categories (${populated.join(', ')})`);
  for (const c of populated) {
    const f = ws.meta.cacheFreshness[c];
    console.log(`    ${c.padEnd(12)} newest=${f.newestHours}h  oldest=${f.oldestHours}h  sources=${f.sourceCount}`);
  }
} else {
  fail('meta.cacheFreshness is missing from world-state.json');
}

// 5. Sub-score indicators source diversity (no all-static signatures)
for (const [cat, sub] of Object.entries(subScores)) {
  if (!Array.isArray(sub.indicators)) continue;
  const staticOnly = sub.indicators.every(i => !i.fetchedAt);
  if (staticOnly && cat !== 'momentum') {
    warn(`${cat}: every indicator lacks fetchedAt — score is entirely static (run the pipeline to refresh)`);
  }
}

console.log('\n--- Summary ---');
console.log(`  Cache files total:        ${existing.length}`);
console.log(`  Consumed by score:        ${cacheReads.length}`);
console.log(`  Detail-pages only:        ${unused.length}`);
console.log(`  Indicators scored:        ${indicatorsTotal}`);
console.log(`  Errors:                   ${errors}`);
console.log(`  Warnings:                 ${warnings}`);

if (errors > 0) {
  console.log(`\n\u2718 Score coverage validation FAILED\n`);
  process.exit(1);
}
console.log(`\n\u2714 Score coverage validation PASSED\n`);
process.exit(0);
