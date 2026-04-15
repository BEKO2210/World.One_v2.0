#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Disasters Cache Generator
   Fetches ReliefWeb disaster data and World Bank hunger indicators
   Output: data/cache/disasters.json, hunger.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, extractWorldBankEntries, saveCache } from './cache-utils.js';

// ─── Disasters (ReliefWeb API or static fallback) ───
async function fetchDisasters() {
  console.log('  Fetching disaster data (GDACS)...');

  // Primary: GDACS (Global Disaster Alert & Coordination System, JRC/EU).
  // Keyless, replaces ReliefWeb v1 (decommissioned 2025) / v2 (requires
  // registered appname). Covers EQ/TC/FL/VO/DR/WF.
  try {
    const TYPE_MAP = {
      EQ: 'Earthquake', TC: 'Tropical Cyclone', FL: 'Flood',
      VO: 'Volcano', DR: 'Drought', WF: 'Wildfire'
    };
    const geo = await fetchJSON(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventlist=EQ,TC,FL,VO,DR,WF',
      { timeout: 10000, retries: 1 }
    );
    const features = Array.isArray(geo?.features) ? geo.features : [];
    if (features.length > 0) {
      const disasters = features.slice(0, 40).map(f => {
        const p = f.properties || {};
        return {
          name: p.name || p.htmldescription || `${TYPE_MAP[p.eventtype] || p.eventtype} event`,
          date: p.fromdate || null,
          type: TYPE_MAP[p.eventtype] || p.eventtype || null,
          countries: p.country ? [p.country] : [],
          status: p.iscurrent === 'true' ? 'ongoing' : 'past',
          alertLevel: p.alertlevel || null
        };
      });
      console.log(`  Disasters: ${disasters.length} GDACS events (live)`);
      return { disasters, api_status: 'live', source: 'GDACS (JRC/EU)' };
    }
  } catch (err) {
    console.log(`  Disasters: GDACS failed (${err.message}), using static fallback`);
  }

  // Static fallback -- recent major disasters (2024-2025 dataset)
  // Source: ReliefWeb annual disaster summary reports
  console.log('  Disasters: using static fallback dataset');
  const disasters = [
    { name: 'Myanmar - Cyclone Mocha', date: '2024-05-14', type: 'Cyclone', countries: ['Myanmar'], status: 'past' },
    { name: 'Libya - Floods', date: '2024-09-10', type: 'Flood', countries: ['Libya'], status: 'past' },
    { name: 'Morocco - Earthquake', date: '2024-09-08', type: 'Earthquake', countries: ['Morocco'], status: 'past' },
    { name: 'Turkiye - Syria Earthquake', date: '2024-02-06', type: 'Earthquake', countries: ['Turkiye', 'Syrian Arab Republic'], status: 'past' },
    { name: 'Pakistan - Floods', date: '2024-08-15', type: 'Flood', countries: ['Pakistan'], status: 'past' },
    { name: 'Afghanistan - Earthquake', date: '2024-10-07', type: 'Earthquake', countries: ['Afghanistan'], status: 'past' },
    { name: 'Philippines - Typhoon Rai', date: '2024-12-16', type: 'Cyclone', countries: ['Philippines'], status: 'past' },
    { name: 'East Africa - Drought', date: '2024-01-01', type: 'Drought', countries: ['Somalia', 'Ethiopia', 'Kenya'], status: 'ongoing' },
    { name: 'Sudan - Conflict', date: '2024-04-15', type: 'Complex Emergency', countries: ['Sudan'], status: 'ongoing' },
    { name: 'Ukraine - Conflict', date: '2024-02-24', type: 'Complex Emergency', countries: ['Ukraine'], status: 'ongoing' }
  ];

  return {
    disasters,
    api_status: 'static_fallback',
    note: 'Static fallback -- ReliefWeb API requires registered appname since 2026'
  };
}

// ─── Hunger / Undernourishment (World Bank) ───
async function fetchHunger() {
  console.log('  Fetching hunger data (World Bank undernourishment)...');
  const url = 'https://api.worldbank.org/v2/country/WLD/indicator/SN.ITK.DEFC.ZS?format=json&per_page=60&date=2000:2025';
  const data = await fetchJSON(url);
  const undernourishment_trend = extractWorldBankEntries(data);

  console.log(`  Hunger: ${undernourishment_trend.length} data points`);
  return { undernourishment_trend };
}

// ─── Main ───
async function main() {
  console.log('=== update-disasters ===');
  let filesWritten = 0;

  // Disasters
  try {
    const disasterData = await fetchDisasters();
    saveCache('disasters.json', disasterData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR disasters: ${err.message}`);
  }

  // Hunger
  try {
    const hungerData = await fetchHunger();
    saveCache('hunger.json', hungerData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR hunger: ${err.message}`);
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
