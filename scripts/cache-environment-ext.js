#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Environment Extended Cache Generator
   Fetches CO2 history, ocean SST anomaly, and solar cycle data
   Output: data/cache/co2-history.json, ocean.json, solar.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, fetchText, saveCache } from './cache-utils.js';

// ─── CO2 History (NOAA Mauna Loa) ───
async function fetchCO2History() {
  console.log('  Fetching CO2 history (NOAA Mauna Loa)...');
  const url = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv';
  const text = await fetchText(url);

  const lines = text.split('\n');
  const monthly = [];

  for (const line of lines) {
    // Skip comment lines starting with #
    if (line.startsWith('#') || line.trim() === '') continue;

    // Split by whitespace or comma
    const cols = line.trim().split(/[\s,]+/);
    if (cols.length < 4) continue;

    const year = parseInt(cols[0]);
    const month = parseInt(cols[1]);
    const value = parseFloat(cols[3]); // interpolated monthly mean

    if (!isNaN(year) && !isNaN(month) && Number.isFinite(value) && value > 0) {
      monthly.push({ year, month, value });
    }
  }

  console.log(`  CO2: ${monthly.length} monthly records`);
  return { monthly };
}

// ─── Ocean SST Anomaly (NOAA Climate at a Glance) ───
async function fetchOceanSST() {
  console.log('  Fetching ocean SST anomaly...');

  // Primary: try NOAA Coral Reef Watch
  try {
    const coralData = await fetchJSON(
      'https://coralreefwatch.noaa.gov/product/vs/data/all_vs_data.json',
      { timeout: 10000, retries: 1 }
    );
    if (coralData && typeof coralData === 'object') {
      console.log('  Ocean: using Coral Reef Watch data');
      return { source: 'coral-reef-watch', raw: coralData };
    }
  } catch {
    console.log('  Ocean: Coral Reef Watch unavailable, using Climate at a Glance fallback');
  }

  // Fallback: NOAA Climate at a Glance
  const cagData = await fetchJSON(
    'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/ocean/ytd/12/1880-2026.json'
  );

  const annual_sst_anomaly = [];
  if (cagData && cagData.data) {
    for (const [yearStr, val] of Object.entries(cagData.data)) {
      const year = parseInt(yearStr);
      // API returns either a string or an object { anomaly: number }
      const anomaly = typeof val === 'object' && val !== null
        ? parseFloat(val.anomaly)
        : parseFloat(val);
      if (!isNaN(year) && Number.isFinite(anomaly)) {
        annual_sst_anomaly.push({ year, anomaly });
      }
    }
    annual_sst_anomaly.sort((a, b) => a.year - b.year);
  }

  console.log(`  Ocean: ${annual_sst_anomaly.length} annual SST anomaly records`);
  return { annual_sst_anomaly };
}

// ─── Solar Cycle (NOAA SWPC) ───
async function fetchSolarCycle() {
  console.log('  Fetching solar cycle data (NOAA SWPC)...');
  const url = 'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json';
  const data = await fetchJSON(url);

  if (!Array.isArray(data)) {
    throw new Error('Solar cycle data is not an array');
  }

  // Extract last 36 months of entries
  const recent = data.slice(-36);
  console.log(`  Solar: ${recent.length} entries (last 36 months)`);
  return { solar_cycle: recent };
}

// ─── Main ───
async function main() {
  console.log('=== update-environment-ext ===');
  let filesWritten = 0;

  // CO2 History
  try {
    const co2Data = await fetchCO2History();
    saveCache('co2-history.json', co2Data);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR co2-history: ${err.message}`);
  }

  // Ocean SST
  try {
    const oceanData = await fetchOceanSST();
    saveCache('ocean.json', oceanData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR ocean: ${err.message}`);
  }

  // Solar Cycle
  try {
    const solarData = await fetchSolarCycle();
    saveCache('solar.json', solarData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR solar: ${err.message}`);
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
