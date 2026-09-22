#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Freshness Validation
   Bricht ab, wenn ein als „live" markierter Indikator
     a) ein dataAsOf hat, das älter als 3× seine Kadenz ist, oder
     b) als realtime/daily seit ≥ 30 Tagen denselben Wert zeigt.

   Usage: node scripts/validate-freshness.js
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = join(__dirname, '..', 'data', 'processed', 'world-state.json');
const HISTORY_DIR = join(__dirname, '..', 'data', 'history');
const PREFIX = '[validate-freshness]';
const CATEGORIES = ['environment', 'society', 'economy', 'progress'];
const DAY = 864e5;

// Maximal zulässiges Alter = 3× Kadenz (realtime: 3 Pipeline-Läufe à 6 h)
const MAX_AGE = { realtime: 18 * 36e5, daily: 3 * DAY, monthly: 3 * 31 * DAY, annual: 3 * 366 * DAY };
const FROZEN_DAYS = 30;

// dataAsOf ist ein Jahr (2024), ein Monat ("2026-08") oder ein ISO-Datum.
// Jahres-/Monatswerte gelten bis zum Ende ihres Zeitraums.
function asOfMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Date.UTC(v, 11, 31);
  if (/^\d{4}$/.test(v)) return Date.UTC(Number(v), 11, 31);
  if (/^\d{4}-\d{2}$/.test(v)) { const [y, m] = v.split('-').map(Number); return Date.UTC(y, m, 0); }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function indicators(state) {
  return CATEGORIES.flatMap(c => (state.subScores?.[c]?.indicators || []).map(i => ({ ...i, category: c })));
}

if (!existsSync(STATE)) {
  console.log(`${PREFIX} world-state.json fehlt — übersprungen`);
  process.exit(0);
}
const state = JSON.parse(readFileSync(STATE, 'utf-8'));
const list = indicators(state);
if (!list.some(i => 'cadence' in i)) {
  console.log(`${PREFIX} world-state.json noch ohne cadence/dataAsOf (alter Pipeline-Lauf) — übersprungen`);
  process.exit(0);
}

const errors = [];
const now = Date.now();

for (const ind of list) {
  if (!ind.cadence) { errors.push(`${ind.name}: cadence fehlt`); continue; }
  if (ind.tier !== 'live') continue;
  const t = asOfMs(ind.dataAsOf);
  if (t == null) { errors.push(`${ind.name}: tier live ohne dataAsOf`); continue; }
  const age = now - t;
  if (age > MAX_AGE[ind.cadence]) {
    errors.push(`${ind.name}: live, aber dataAsOf ${ind.dataAsOf} ist ${Math.round(age / DAY)} Tage alt (Kadenz ${ind.cadence})`);
  }
}

// Eingefrorene Werte: alle Snapshots der letzten 30 Tage identisch
if (existsSync(HISTORY_DIR)) {
  const cutoff = now - FROZEN_DAYS * DAY;
  const snaps = readdirSync(HISTORY_DIR)
    .filter(f => /^snapshot-\d{8}-\d{4}\.json$/.test(f))
    .map(f => {
      const [, d, hm] = f.match(/(\d{8})-(\d{4})/);
      const t = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +hm.slice(0, 2), +hm.slice(2));
      return { f, t };
    })
    .filter(s => s.t >= cutoff - DAY)
    .sort((a, b) => a.t - b.t);

  if (snaps.length && snaps[0].t <= cutoff) {
    const seen = new Map(); // name → Set(values)
    for (const { f } of snaps) {
      let snap;
      try { snap = JSON.parse(readFileSync(join(HISTORY_DIR, f), 'utf-8')); } catch { continue; }
      for (const i of indicators(snap)) {
        if (!seen.has(i.name)) seen.set(i.name, new Set());
        seen.get(i.name).add(JSON.stringify(i.value));
      }
    }
    for (const ind of list) {
      if (ind.tier !== 'live' || !['realtime', 'daily'].includes(ind.cadence)) continue;
      const values = seen.get(ind.name);
      if (values && values.size === 1 && values.has(JSON.stringify(ind.value))) {
        errors.push(`${ind.name}: live/${ind.cadence}, aber seit ≥ ${FROZEN_DAYS} Tagen unverändert (${ind.value})`);
      }
    }
  } else {
    console.log(`${PREFIX} History kürzer als ${FROZEN_DAYS} Tage — Einfrier-Prüfung übersprungen`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`${PREFIX} FEHLER ${e}`);
  console.error(`${PREFIX} ${errors.length} Fehler`);
  process.exit(1);
}
console.log(`${PREFIX} OK — ${list.length} Indikatoren, alle live-Werte innerhalb ihrer Kadenz`);
