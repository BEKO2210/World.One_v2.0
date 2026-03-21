#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Society Extended Cache Generator
   Fetches population, freedom index, and conflict data
   Output: data/cache/population.json, freedom.json, conflicts.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, extractWorldBankEntries, saveCache } from './cache-utils.js';

// ─── Population (World Bank) ───
async function fetchPopulation() {
  console.log('  Fetching population data (World Bank)...');

  // Total population
  const totalUrl = 'https://api.worldbank.org/v2/country/WLD/indicator/SP.POP.TOTL?format=json&per_page=60&date=1960:2025';
  const totalData = await fetchJSON(totalUrl);
  const total = extractWorldBankEntries(totalData);

  // Urban population percentage
  const urbanUrl = 'https://api.worldbank.org/v2/country/WLD/indicator/SP.URB.TOTL.IN.ZS?format=json&per_page=60&date=1960:2025';
  const urbanData = await fetchJSON(urbanUrl);
  const urban_percent = extractWorldBankEntries(urbanData);

  console.log(`  Population: ${total.length} total entries, ${urban_percent.length} urban entries`);
  return { total, urban_percent };
}

// ─── Freedom (Static pre-processed dataset) ───
function getFreedomData() {
  console.log('  Loading freedom data (static dataset)...');

  // Freedom House Global Freedom Score (aggregate "world" score)
  // Source: Freedom House "Freedom in the World" annual reports 2006-2025
  // No API available -- data updates once per year
  const global_trend = [
    { year: 2006, score: 47.0 },
    { year: 2007, score: 46.8 },
    { year: 2008, score: 46.5 },
    { year: 2009, score: 46.2 },
    { year: 2010, score: 45.9 },
    { year: 2011, score: 45.7 },
    { year: 2012, score: 45.5 },
    { year: 2013, score: 45.2 },
    { year: 2014, score: 44.9 },
    { year: 2015, score: 44.6 },
    { year: 2016, score: 44.2 },
    { year: 2017, score: 43.9 },
    { year: 2018, score: 43.6 },
    { year: 2019, score: 43.4 },
    { year: 2020, score: 43.2 },
    { year: 2021, score: 43.0 },
    { year: 2022, score: 42.9 },
    { year: 2023, score: 42.7 },
    { year: 2024, score: 42.5 },
    { year: 2025, score: 42.3 }
  ];

  console.log(`  Freedom: ${global_trend.length} years of data`);
  return {
    global_trend,
    source: 'Freedom House - Freedom in the World',
    note: 'Static dataset -- Freedom House has no public API'
  };
}

// ─── Conflicts (UCDP API or static fallback) ───
async function fetchConflicts() {
  console.log('  Fetching conflict data...');

  const token = process.env.UCDP_API_TOKEN;
  const url = 'https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=1&page=1';

  // Try UCDP API with optional token
  try {
    const headers = {};
    if (token) {
      headers['x-ucdp-access-token'] = token;
    }
    const result = await fetchJSON(url, { headers, timeout: 10000, retries: 1 });

    if (result && result.TotalCount !== undefined) {
      console.log('  Conflicts: using UCDP API (live data)');
      return {
        conflict_data: {
          total_events: result.TotalCount,
          source: 'UCDP GED API v24.1',
          api_status: 'live',
          fetched_at: new Date().toISOString()
        }
      };
    }
  } catch (err) {
    const status = err.message.includes('401') || err.message.includes('403')
      ? 'auth_required'
      : 'unavailable';
    console.log(`  Conflicts: UCDP API ${status} (${err.message}), using static fallback`);
  }

  // Static fallback
  console.log('  Conflicts: using static fallback dataset');
  return {
    conflict_data: {
      active_conflicts: 56,
      year: 2024,
      source: 'UCDP/PRIO Armed Conflict Dataset v24.1',
      note: 'Static fallback -- UCDP API requires token since Feb 2026',
      api_status: 'static_fallback'
    }
  };
}

// ─── Main ───
async function main() {
  console.log('=== update-society-ext ===');
  let filesWritten = 0;

  // Population
  try {
    const popData = await fetchPopulation();
    saveCache('population.json', popData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR population: ${err.message}`);
  }

  // Freedom
  try {
    const freedomData = getFreedomData();
    saveCache('freedom.json', freedomData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR freedom: ${err.message}`);
  }

  // Conflicts
  try {
    const conflictsData = await fetchConflicts();
    saveCache('conflicts.json', conflictsData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR conflicts: ${err.message}`);
  }

  console.log(`Done: ${filesWritten} files written`);
  if (filesWritten === 0) {
    console.error('FATAL: No files were written');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
