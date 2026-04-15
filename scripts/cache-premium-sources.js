#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Premium Sources Cache Generator
   Pulls live data from the three APIs that require free tokens:

     • FRED    (St. Louis Fed — economic indicators)    env FRED_API_KEY
     • WAQI    (World Air Quality Index — station data) env WAQI_TOKEN
     • NewsAPI (developer plan — world headlines)       env NEWS_API_KEY

   Skips any source whose env var is not set (useful for local testing
   and for partial secret rollouts). Only fails hard if ALL three are
   configured AND ALL three fail.

   Output files:
     data/cache/fred.json       (US + global economic indicators)
     data/cache/waqi.json       (official station AQI for 20 cities)
     data/cache/news.json       (world / climate / conflict headlines)
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, saveCache } from './cache-utils.js';

// 20 cities shared with cache-live-data.js air-quality snapshot
const CITIES = [
  { name: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 },
  { name: 'Delhi', country: 'IN', lat: 28.61, lon: 77.21 },
  { name: 'Shanghai', country: 'CN', lat: 31.23, lon: 121.47 },
  { name: 'São Paulo', country: 'BR', lat: -23.55, lon: -46.63 },
  { name: 'Mexico City', country: 'MX', lat: 19.43, lon: -99.13 },
  { name: 'Cairo', country: 'EG', lat: 30.04, lon: 31.24 },
  { name: 'Mumbai', country: 'IN', lat: 19.08, lon: 72.88 },
  { name: 'Beijing', country: 'CN', lat: 39.90, lon: 116.40 },
  { name: 'Dhaka', country: 'BD', lat: 23.81, lon: 90.41 },
  { name: 'Lagos', country: 'NG', lat: 6.52, lon: 3.38 },
  { name: 'Istanbul', country: 'TR', lat: 41.01, lon: 28.98 },
  { name: 'Karachi', country: 'PK', lat: 24.86, lon: 67.00 },
  { name: 'New York', country: 'US', lat: 40.71, lon: -74.00 },
  { name: 'Los Angeles', country: 'US', lat: 34.05, lon: -118.24 },
  { name: 'London', country: 'GB', lat: 51.51, lon: -0.13 },
  { name: 'Paris', country: 'FR', lat: 48.86, lon: 2.35 },
  { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.41 },
  { name: 'Moscow', country: 'RU', lat: 55.75, lon: 37.62 },
  { name: 'Sydney', country: 'AU', lat: -33.87, lon: 151.21 },
  { name: 'Jakarta', country: 'ID', lat: -6.21, lon: 106.85 }
];

// ──────────────────────────────────────────────────────────────
// 1. FRED — St. Louis Fed Economic Indicators
// ──────────────────────────────────────────────────────────────

/**
 * Series we pull. Each gives a single "latest observation" plus a
 * 10-year history for trend rendering.
 */
const FRED_SERIES = [
  // US macro (highest quality, most current — weekly or monthly)
  { id: 'UNRATE',   label: 'US Unemployment Rate',     unit: '%',    obs: 120 },
  { id: 'CPIAUCSL', label: 'US Consumer Price Index',  unit: 'idx',  obs: 120 },
  { id: 'FEDFUNDS', label: 'Federal Funds Rate',       unit: '%',    obs: 120 },
  { id: 'DGS10',    label: '10Y Treasury Yield',       unit: '%',    obs: 250 },
  { id: 'T10Y2Y',   label: '10Y-2Y Treasury Spread',   unit: '%',    obs: 250 },
  { id: 'GDPC1',    label: 'US Real GDP (chained)',    unit: 'bn$',  obs: 40 },

  // Global (IMF / OECD series served by FRED)
  { id: 'CPGRLE01DEM657N', label: 'Germany Core CPI YoY',    unit: '%', obs: 120 },
  { id: 'LRHUTTTTEZQ156S', label: 'Euro Area Unemployment',  unit: '%', obs: 60  }
];

async function fetchFREDSeries(id, apiKey, limit = 120) {
  const url = `https://api.stlouisfed.org/fred/series/observations`
    + `?series_id=${id}&api_key=${apiKey}&file_type=json`
    + `&sort_order=desc&limit=${limit}`;
  const data = await fetchJSON(url, { retries: 2, timeout: 12000 });
  if (!Array.isArray(data?.observations)) {
    throw new Error('No observations');
  }
  // observations arrive newest-first; filter out '.' (FRED missing marker)
  const points = data.observations
    .filter(o => o.value && o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .filter(p => Number.isFinite(p.value))
    .reverse();
  return points;
}

async function cacheFRED() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.log('  [fred] skipped — no FRED_API_KEY env var set');
    return { skipped: true };
  }
  console.log('  [fred] Fetching FRED economic indicators...');

  const series = {};
  let successCount = 0;
  for (const s of FRED_SERIES) {
    try {
      const history = await fetchFREDSeries(s.id, apiKey, s.obs);
      if (history.length === 0) {
        console.log(`    ${s.id}: no usable observations`);
        continue;
      }
      const latest = history[history.length - 1];
      series[s.id] = {
        label: s.label,
        unit: s.unit,
        latest: { value: latest.value, date: latest.date },
        history
      };
      successCount++;
      console.log(`    ${s.id} = ${latest.value}${s.unit} (${latest.date})`);
    } catch (err) {
      console.log(`    ${s.id}: failed (${err.message})`);
    }
  }

  if (successCount === 0) {
    throw new Error('All FRED series failed');
  }

  // Computed indicators worth surfacing
  const derived = {};
  const fed = series.FEDFUNDS?.latest?.value;
  const cpi10 = series.CPIAUCSL?.history?.slice(-13); // 13 months for YoY
  if (cpi10?.length >= 13) {
    const yoy = ((cpi10[cpi10.length - 1].value / cpi10[0].value) - 1) * 100;
    derived.us_inflation_yoy = {
      value: Math.round(yoy * 100) / 100,
      unit: '%',
      source: 'FRED CPIAUCSL (YoY calc)'
    };
  }
  if (fed != null) {
    derived.fed_funds_rate = {
      value: fed, unit: '%', source: 'FRED FEDFUNDS'
    };
  }
  const spread = series.T10Y2Y?.latest?.value;
  if (spread != null) {
    derived.yield_curve_spread = {
      value: spread,
      unit: '%',
      signal: spread < 0 ? 'inverted (recession signal)' : 'normal',
      source: 'FRED T10Y2Y'
    };
  }

  saveCache('fred.json', { series, derived });
  console.log(`  [fred] ${successCount}/${FRED_SERIES.length} series cached`);
  return { successCount };
}

// ──────────────────────────────────────────────────────────────
// 2. WAQI — World Air Quality Index (official station data)
// ──────────────────────────────────────────────────────────────

async function cacheWAQI() {
  const token = process.env.WAQI_TOKEN;
  if (!token) {
    console.log('  [waqi] skipped — no WAQI_TOKEN env var set');
    return { skipped: true };
  }
  console.log('  [waqi] Fetching WAQI station data for major cities...');

  const stations = [];
  const errors = [];
  for (const city of CITIES) {
    try {
      const url = `https://api.waqi.info/feed/geo:${city.lat};${city.lon}/?token=${token}`;
      const r = await fetchJSON(url, { retries: 1, timeout: 10000 });
      if (r?.status !== 'ok' || !r.data || typeof r.data.aqi !== 'number') {
        errors.push(`${city.name}: ${r?.status || 'bad response'}`);
        continue;
      }
      const d = r.data;
      stations.push({
        name: city.name,
        country: city.country,
        station: d.city?.name || null,
        aqi: d.aqi,
        dominant_pollutant: d.dominentpol || null,
        pm25: d.iaqi?.pm25?.v ?? null,
        pm10: d.iaqi?.pm10?.v ?? null,
        o3: d.iaqi?.o3?.v ?? null,
        no2: d.iaqi?.no2?.v ?? null,
        so2: d.iaqi?.so2?.v ?? null,
        co: d.iaqi?.co?.v ?? null,
        time: d.time?.iso || null
      });
    } catch (err) {
      errors.push(`${city.name}: ${err.message}`);
    }
  }

  if (stations.length === 0) {
    throw new Error(`All WAQI fetches failed (${errors.length} errors, first: ${errors[0]})`);
  }

  stations.sort((a, b) => a.aqi - b.aqi);
  const avg = Math.round(stations.reduce((s, c) => s + c.aqi, 0) / stations.length);
  const cleanest = stations.slice(0, 5);
  const worst = [...stations].reverse().slice(0, 5);

  const payload = {
    global_aqi: {
      value: avg,
      unit: 'US AQI (WAQI)',
      year: new Date().getFullYear(),
      source: `WAQI official stations (${stations.length} cities)`
    },
    cleanest,
    worst,
    stations
  };
  saveCache('waqi.json', payload);
  console.log(`  [waqi] ${stations.length} stations, avg AQI=${avg}, errors=${errors.length}`);
  return { successCount: stations.length };
}

// ──────────────────────────────────────────────────────────────
// 3. NewsAPI — world / climate / conflict headlines
// ──────────────────────────────────────────────────────────────

const NEWS_QUERIES = [
  { key: 'world',    q: 'world OR international',              max: 10 },
  { key: 'climate',  q: 'climate OR "global warming"',         max: 10 },
  { key: 'conflict', q: 'conflict OR war OR "military strike"', max: 10 },
  { key: 'economy',  q: 'inflation OR recession OR "interest rate"', max: 10 }
];

async function fetchNewsQuery(q, max, apiKey) {
  const fromIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const url = `https://newsapi.org/v2/everything`
    + `?q=${encodeURIComponent(q)}`
    + `&from=${fromIso}`
    + `&sortBy=publishedAt&language=en&pageSize=${max}`
    + `&apiKey=${apiKey}`;
  const data = await fetchJSON(url, { retries: 1, timeout: 12000 });
  if (data?.status !== 'ok') {
    throw new Error(data?.message || `status=${data?.status}`);
  }
  return (data.articles || []).map(a => ({
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source?.name,
    published_at: a.publishedAt
  }));
}

async function cacheNews() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.log('  [news] skipped — no NEWS_API_KEY env var set');
    return { skipped: true };
  }
  console.log('  [news] Fetching NewsAPI headlines...');

  const buckets = {};
  let totalArticles = 0;
  for (const q of NEWS_QUERIES) {
    try {
      const articles = await fetchNewsQuery(q.q, q.max, apiKey);
      buckets[q.key] = articles;
      totalArticles += articles.length;
      console.log(`    ${q.key.padEnd(10)} ${articles.length} articles`);
    } catch (err) {
      console.log(`    ${q.key}: failed (${err.message})`);
      buckets[q.key] = [];
    }
  }

  if (totalArticles === 0) {
    throw new Error('All NewsAPI queries returned 0 articles');
  }

  saveCache('news.json', {
    categories: buckets,
    total_articles: totalArticles,
    generated_at: new Date().toISOString()
  });
  console.log(`  [news] ${totalArticles} total articles across ${NEWS_QUERIES.length} categories`);
  return { successCount: totalArticles };
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

const TASKS = [
  ['fred', cacheFRED],
  ['waqi', cacheWAQI],
  ['news', cacheNews]
];

async function main() {
  console.log('=== update-premium-sources ===');
  const outcomes = [];
  for (const [name, fn] of TASKS) {
    try {
      const r = await fn();
      outcomes.push({ name, status: r?.skipped ? 'skipped' : 'ok' });
    } catch (err) {
      console.error(`  ERROR ${name}: ${err.message}`);
      outcomes.push({ name, status: 'error', error: err.message });
    }
  }

  const ok      = outcomes.filter(o => o.status === 'ok').length;
  const skipped = outcomes.filter(o => o.status === 'skipped').length;
  const errors  = outcomes.filter(o => o.status === 'error').length;

  console.log(`\nDone: ${ok} ok, ${skipped} skipped (no token), ${errors} errors`);
  if (skipped === TASKS.length) {
    console.log('No tokens configured — nothing to do.');
    process.exit(0);
  }
  // Fail only if every configured source failed
  const configured = TASKS.length - skipped;
  if (configured > 0 && errors === configured) {
    console.error('FATAL: All configured sources failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
