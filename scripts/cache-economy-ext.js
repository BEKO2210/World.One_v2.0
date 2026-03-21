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
  return {
    base: 'USD',
    rates,
    rate_date: data.time_last_update_utc || new Date().toISOString()
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

// ─── Poverty Headcount (World Bank) ───
async function fetchPoverty() {
  console.log('  Fetching poverty data (World Bank $2.15/day)...');
  const url = 'https://api.worldbank.org/v2/country/WLD/indicator/SI.POV.DDAY?format=json&per_page=60&date=1990:2025';
  const data = await fetchJSON(url);
  const poverty_trend = extractWorldBankEntries(data);

  console.log(`  Poverty: ${poverty_trend.length} data points`);
  return { poverty_trend };
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
