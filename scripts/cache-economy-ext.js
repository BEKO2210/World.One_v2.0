#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Economy Extended Cache Generator
   Fetches currency exchange rates, Gini inequality, and poverty data
   Output: data/cache/currencies.json, inequality.json, poverty.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, extractWorldBankEntries, saveCache } from './cache-utils.js';

const MAJOR_CURRENCIES = ['EUR', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'RUB', 'KRW', 'CHF', 'AUD', 'CAD', 'MXN'];
const TOP10_COUNTRIES = 'USA;CHN;IND;BRA;DEU;GBR;ZAF;NGA;RUS;JPN';

// ─── Currency Exchange Rates (Open ER API) ───
async function fetchCurrencies() {
  console.log('  Fetching currency exchange rates...');
  const url = 'https://open.er-api.com/v6/latest/USD';
  const data = await fetchJSON(url);

  if (!data || !data.rates) {
    throw new Error('No rates in exchange rate response');
  }

  const rates = {};
  for (const code of MAJOR_CURRENCIES) {
    if (data.rates[code] !== undefined) {
      rates[code] = data.rates[code];
    }
  }

  console.log(`  Currencies: ${Object.keys(rates).length} major pairs`);

  // 12-Monats-Verlauf (EZB-Referenzkurse via Frankfurter, keyless):
  // erster Handelstag je Monat, Basis USD.
  let history = null;
  try {
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
    const iso = d => d.toISOString().slice(0, 10);
    const ts = await fetchJSON(`https://api.frankfurter.dev/v1/${iso(start)}..${iso(end)}?base=USD&symbols=EUR,GBP,JPY,CNY`);
    const byMonth = new Map();
    for (const [date, r] of Object.entries(ts?.rates || {}).sort()) {
      const month = date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, { date, ...r });
    }
    history = [...byMonth.values()];
    console.log(`  Currencies history: ${history.length} months (ECB)`);
  } catch (err) {
    console.warn(`  Currencies history failed: ${err.message}`);
  }

  // Höchste Inflationsraten (World Bank FP.CPI.TOTL.ZG, letzter Wert,
  // nur Werte der letzten zwei Jahre, damit keine Altdaten vorne stehen)
  let highInflation = null;
  try {
    const wb = await fetchJSON('https://api.worldbank.org/v2/country/all/indicator/FP.CPI.TOTL.ZG?format=json&mrnev=1&per_page=400');
    const minYear = new Date().getUTCFullYear() - 2;
    highInflation = (wb?.[1] || [])
      .filter(r => r.value != null && Number(r.date) >= minYear && /^[A-Z]{3}$/.test(r.countryiso3code))
      .sort((x, y) => y.value - x.value)
      .slice(0, 6)
      .map(r => ({ country: r.country.value, code: r.countryiso3code, inflation: Math.round(r.value * 10) / 10, year: Number(r.date) }));
  } catch (err) {
    console.warn(`  Inflation ranking failed: ${err.message}`);
  }

  return {
    base: 'USD',
    rates,
    rate_date: data.time_last_update_utc || new Date().toISOString(),
    history,
    history_source: 'EZB-Referenzkurse (Frankfurter)',
    high_inflation: highInflation,
    high_inflation_source: 'World Bank (FP.CPI.TOTL.ZG)'
  };
}

// ─── Inequality / Gini Index (World Bank) ───
async function fetchInequality() {
  console.log('  Fetching inequality data (World Bank Gini)...');

  // World-level Gini trend
  const worldUrl = 'https://api.worldbank.org/v2/country/WLD/indicator/SI.POV.GINI?format=json&per_page=60&date=1960:2025';
  const worldData = await fetchJSON(worldUrl);
  const world_trend = extractWorldBankEntries(worldData);
  console.log(`  Inequality (world): ${world_trend.length} data points`);

  // If sparse world data, fetch top-10 countries individually
  let country_latest = [];
  if (world_trend.length < 3) {
    console.log('  Inequality: sparse world data, fetching top-10 countries...');
    const countries = TOP10_COUNTRIES.split(';');

    for (const code of countries) {
      try {
        const url = `https://api.worldbank.org/v2/country/${code}/indicator/SI.POV.GINI?format=json&per_page=5&mrnev=1`;
        const data = await fetchJSON(url);
        const entries = extractWorldBankEntries(data);

        if (entries.length > 0) {
          const latest = entries[entries.length - 1];
          // Extract country name from API response
          const countryName = Array.isArray(data) && Array.isArray(data[1]) && data[1][0]
            ? data[1][0].country?.value || code
            : code;
          country_latest.push({
            country: countryName,
            code,
            gini: latest.value,
            year: latest.year
          });
        }
      } catch (err) {
        console.warn(`  WARN: Gini for ${code}: ${err.message}`);
      }
    }
    console.log(`  Inequality (countries): ${country_latest.length} latest values`);
  }

  return { world_trend, country_latest };
}

// ─── Poverty Headcount (World Bank PIP, $3.00/Tag, 2021 PPP) ───
// Seit Juni 2025 gilt $3.00 als internationale Armutsgrenze; die alte
// WDI-Reihe SI.POV.DDAY ($2.15) ist überholt. PIP liefert Welt und Regionen.
const PIP_REGIONS = ['WLD', 'SSF', 'SAS', 'EAS', 'LCN', 'ECS', 'MEA'];

async function fetchPoverty() {
  console.log('  Fetching poverty data (World Bank PIP, $3.00/day)...');
  const url = 'https://api.worldbank.org/pip/v1/pip-grp?country=all&year=all&povline=3&group_by=wb&format=json';
  const rows = await fetchJSON(url, { timeout: 60000 });
  if (!Array.isArray(rows)) throw new Error('PIP: unerwartete Antwort');

  const series = (code, type) => rows
    .filter(r => r.region_code === code && r.reporting_year >= 1990 && (!type || r.estimate_type === type))
    .sort((a, b) => a.reporting_year - b.reporting_year);
  const toPoint = r => ({ year: r.reporting_year, value: Math.round(r.headcount * 1000) / 10 });

  const world = series('WLD', 'actual');
  if (!world.length) throw new Error('PIP: keine Weltwerte');
  const last = world[world.length - 1];
  const nowcast = series('WLD', 'nowcast').pop() || null;

  const regions = {};
  for (const code of PIP_REGIONS.slice(1)) regions[code] = series(code, 'actual').map(toPoint);

  console.log(`  Poverty: ${world.length} years, ${last.reporting_year} = ${(last.headcount * 100).toFixed(2)} % (${Math.round(last.pop_in_poverty / 1e6)} Mio)`);
  return {
    poverty_trend: world.map(r => ({ ...toPoint(r), people: Math.round(r.pop_in_poverty) })),
    latest: { year: last.reporting_year, pct: Math.round(last.headcount * 10000) / 100, people: Math.round(last.pop_in_poverty) },
    nowcast: nowcast ? { year: nowcast.reporting_year, pct: Math.round(nowcast.headcount * 10000) / 100, people: Math.round(nowcast.pop_in_poverty) } : null,
    regions,
    poverty_line_usd: 3.0,
    source: 'World Bank PIP ($3.00/Tag, 2021 PPP)'
  };
}

// ─── Main ───
async function main() {
  console.log('=== update-economy-ext ===');
  let filesWritten = 0;

  // Currencies
  try {
    const currData = await fetchCurrencies();
    saveCache('currencies.json', currData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR currencies: ${err.message}`);
  }

  // Inequality
  try {
    const ineqData = await fetchInequality();
    saveCache('inequality.json', ineqData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR inequality: ${err.message}`);
  }

  // Poverty
  try {
    const povData = await fetchPoverty();
    saveCache('poverty.json', povData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR poverty: ${err.message}`);
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
