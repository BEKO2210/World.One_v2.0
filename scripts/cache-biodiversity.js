#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Biodiversity Cache Generator
   Fetches GBIF threatened species counts by IUCN status
   Output: data/cache/biodiversity.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, saveCache } from './cache-utils.js';

const GBIF_BASE = 'https://api.gbif.org/v1/species/search';

const THREAT_STATUSES = [
  { key: 'vulnerable', param: 'VULNERABLE' },
  { key: 'endangered', param: 'ENDANGERED' },
  { key: 'critically_endangered', param: 'CRITICALLY_ENDANGERED' }
];

async function fetchThreatCount(status) {
  try {
    const url = `${GBIF_BASE}?threat=${status.param}&limit=0`;
    const result = await fetchJSON(url);
    return result.count ?? null;
  } catch (err) {
    console.warn(`  WARN: Failed to fetch ${status.key}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('=== update-biodiversity ===');

  const counts = {};
  for (const status of THREAT_STATUSES) {
    counts[status.key] = await fetchThreatCount(status);
    console.log(`  ${status.key}: ${counts[status.key] ?? 'failed'}`);
  }

  const validCounts = Object.values(counts).filter(v => v !== null);
  const total = validCounts.length > 0
    ? validCounts.reduce((sum, v) => sum + v, 0)
    : null;

  const data = {
    threatened_counts: {
      ...counts,
      total
    },
    timestamp: new Date().toISOString()
  };

  saveCache('biodiversity.json', data);
  console.log('Done: 1 file written');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
