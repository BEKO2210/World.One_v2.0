#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Routing & Navigation Integrity Validator
   Run 2 smoke check. Verifies:
     1) Every topic in detail-app.js VALID_TOPICS has a matching
        detail/topics/<topic>.js module file.
     2) Every module on disk is covered by VALID_TOPICS (no orphan
        imports reachable without allowlist).
     3) Every module exports the full contract:
        meta (with id + titleKey), render(), cleanup(), getChartConfigs().
     4) Every main-page STATIC_TOPIC_MAP topic is in the allowlist.
     5) i18n contains every titleKey referenced in modules
        (_stub excluded as intentional placeholder).
   Exit 0 = PASS, 1 = FAIL.
   ═══════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DETAIL_APP = join(ROOT, 'detail', 'detail-app.js');
const TOPICS_DIR = join(ROOT, 'detail', 'topics');
const MAIN_APP = join(ROOT, 'js', 'app.js');
const I18N = join(ROOT, 'js', 'i18n.js');

let errors = 0;
let warnings = 0;
const fail = (msg) => { console.log(`  \u2718 ${msg}`); errors++; };
const warn = (msg) => { console.log(`  ! ${msg}`); warnings++; };
const pass = (msg) => console.log(`  \u2714 ${msg}`);

console.log('\nValidating routing integrity...\n');

// ─── Load sources ───
const detailAppSrc = readFileSync(DETAIL_APP, 'utf8');
const mainAppSrc = readFileSync(MAIN_APP, 'utf8');
const i18nSrc = readFileSync(I18N, 'utf8');

// ─── 1. Extract VALID_TOPICS allowlist ───
const allowlistMatch = detailAppSrc.match(/const\s+VALID_TOPICS\s*=\s*\[([\s\S]*?)\]/);
if (!allowlistMatch) {
  fail('Could not locate VALID_TOPICS literal in detail-app.js');
  process.exit(1);
}
const allowlist = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
pass(`VALID_TOPICS contains ${allowlist.length} topics`);

// ─── 2. Topic files on disk ───
const topicFiles = readdirSync(TOPICS_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => f.slice(0, -3));
pass(`${topicFiles.length} topic modules on disk`);

// Disk vs allowlist diff
const missingFiles = allowlist.filter(t => !topicFiles.includes(t));
const orphanFiles = topicFiles.filter(t => !allowlist.includes(t));
missingFiles.forEach(t => fail(`Allowlist references missing file: ${t}.js`));
orphanFiles.forEach(t => fail(`Topic file not in allowlist: ${t}.js`));
if (missingFiles.length === 0 && orphanFiles.length === 0) {
  pass('Allowlist and filesystem are aligned');
}

// ─── 3. Module contract ───
const titleKeys = {};
for (const topic of allowlist) {
  const path = join(TOPICS_DIR, `${topic}.js`);
  if (!existsSync(path)) continue;
  const src = readFileSync(path, 'utf8');

  // Required exports
  const hasMeta = /export\s+const\s+meta\s*=/.test(src);
  const hasRender = /export\s+async\s+function\s+render\b|export\s+function\s+render\b|export\s*\{\s*[^}]*\brender\b/.test(src);
  const hasCleanup = /export\s+function\s+cleanup\b|export\s+const\s+cleanup\s*=|export\s*\{\s*[^}]*\bcleanup\b/.test(src);
  const hasChartCfg = /export\s+function\s+getChartConfigs\b|export\s+const\s+getChartConfigs\s*=|export\s*\{\s*[^}]*\bgetChartConfigs\b/.test(src);

  if (!hasMeta) fail(`${topic}: missing "export const meta"`);
  if (!hasRender) fail(`${topic}: missing "export function render"`);
  if (!hasCleanup) fail(`${topic}: missing "export function cleanup"`);
  if (!hasChartCfg) fail(`${topic}: missing "export function getChartConfigs"`);

  // titleKey extraction
  const tk = src.match(/titleKey:\s*'([^']+)'/);
  if (!tk) {
    warn(`${topic}: no titleKey in meta (UI will show topicId)`);
  } else {
    titleKeys[topic] = tk[1];
  }
}
pass(`Inspected ${allowlist.length} module contracts`);

// ─── 4. Main-page STATIC_TOPIC_MAP → allowlist coverage ───
const mappedTopics = [...mainAppSrc.matchAll(/topic:\s*'([^']+)'/g)].map(m => m[1]);
const uniqMapped = [...new Set(mappedTopics)];
const mappedNotAllowed = uniqMapped.filter(t => !allowlist.includes(t));
const allowedNotMapped = allowlist.filter(t => !uniqMapped.includes(t) && t !== '_stub');

mappedNotAllowed.forEach(t => fail(`Main page maps "${t}" but it is not in VALID_TOPICS`));
allowedNotMapped.forEach(t => warn(`Topic reachable only via direct URL (no main-page anchor): ${t}`));
pass(`Main page wires ${uniqMapped.length} unique topics`);

// ─── 5. i18n titleKey coverage ───
for (const [topic, key] of Object.entries(titleKeys)) {
  if (topic === '_stub') continue;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hit = new RegExp(`['\"]${escaped}['\"]\\s*:`).test(i18nSrc);
  if (!hit) fail(`i18n missing titleKey for ${topic}: "${key}"`);
}
pass('i18n titleKey coverage checked');

// ─── 6. Cache / fallback tier coverage per topic ───
const CACHE_DIR = join(ROOT, 'data', 'cache');
const FALLBACK_PATH = join(ROOT, 'data', 'fallback', 'static-values.json');
const cacheFiles = existsSync(CACHE_DIR) ? readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')) : [];
let fallbackObj = {};
try { fallbackObj = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8')); } catch { /* ignore */ }

// Topics that read cache under a different filename (known aliases)
const CACHE_ALIAS = {
  // Main cache files whose topic name differs from filename
  // e.g. co2 topic reads 'co2-history.json' too but 'co2' has no direct file.
  co2: ['co2-history.json'],
  ocean_temp: ['ocean.json'],
  ocean_ph: ['ocean.json'],
  ocean_plastic: ['ocean.json'],
  extinction: ['biodiversity.json'],
  endangered: ['biodiversity.json']
};

let liveCount = 0, staticOnlyCount = 0, unresolvedCount = 0;
const tierRows = [];
for (const topic of allowlist) {
  if (topic === '_stub') continue;
  const direct = `${topic}.json`;
  const aliases = CACHE_ALIAS[topic] || [];
  const hasCache = cacheFiles.includes(direct) || aliases.some(a => cacheFiles.includes(a));
  const hasFallback = fallbackObj && fallbackObj[topic] != null;
  let tier;
  if (hasCache) { tier = 'cache'; liveCount++; }
  else if (hasFallback) { tier = 'static'; staticOnlyCount++; }
  else { tier = 'unresolved'; unresolvedCount++; }
  tierRows.push({ topic, tier, hasCache, hasFallback });
}
console.log('\n--- Tier coverage ---');
for (const row of tierRows) {
  const icon = row.tier === 'cache' ? '●' : row.tier === 'static' ? '○' : '!';
  console.log(`  ${icon} ${row.topic.padEnd(20)} ${row.tier}`);
}
if (unresolvedCount > 0) fail(`${unresolvedCount} topics have neither cache nor fallback coverage`);

// ─── Summary ───
console.log('\n--- Summary ---');
console.log(`  Allowlist topics:       ${allowlist.length}`);
console.log(`  Modules on disk:        ${topicFiles.length}`);
console.log(`  Main-page mapped:       ${uniqMapped.length}`);
console.log(`  Cache-backed topics:    ${liveCount}`);
console.log(`  Static-fallback only:   ${staticOnlyCount}`);
console.log(`  Unresolved topics:      ${unresolvedCount}`);
console.log(`  Errors:                 ${errors}`);
console.log(`  Warnings:               ${warnings}`);

if (errors > 0) {
  console.log(`\n\u2718 Routing validation FAILED (${errors} errors, ${warnings} warnings)\n`);
  process.exit(1);
}
console.log(`\n\u2714 Routing validation PASSED (${warnings} warnings)\n`);
process.exit(0);
