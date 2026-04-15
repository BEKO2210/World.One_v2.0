#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Live Data Cache Generator
   Fills the cache gap for detail topics that previously dropped
   straight to static fallback because no cache file existed.

   Generates:
     - data/cache/temperature.json   (NASA GISTEMP annual anomalies)
     - data/cache/forests.json       (World Bank forest area % history)
     - data/cache/renewables.json    (World Bank renewable share history)
     - data/cache/airquality.json    (Open-Meteo multi-city AQI snapshot)
     - data/cache/weather.json       (Open-Meteo major cities snapshot)
     - data/cache/earthquakes.json   (USGS 24h + 7d events)
     - data/cache/crypto_sentiment.json (alternative.me Fear & Greed history)
     - data/cache/science.json       (arXiv AI papers — topic-keyed alias)
     - data/cache/space.json         (Spaceflight News — topic-keyed alias)
     - data/cache/health.json        (World Bank life expectancy + mortality + DTP3)

   Every sub-task is wrapped in try/catch so an outage on one source
   does not block the others.
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, fetchText, extractWorldBankEntries, saveCache } from './cache-utils.js';

const CURRENT_YEAR = new Date().getFullYear();

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

// ─── 1. Temperature anomalies (NASA GISTEMP with NOAA fallback) ──
async function cacheTemperature() {
  console.log('  [temperature] Fetching NASA GISTEMP annual anomalies...');
  let history = [];
  let sourceLabel = 'NASA GISTEMP v4 (base 1951-1980)';

  // Primary: NASA GISTEMP
  try {
    const csv = await fetchText('https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv', { retries: 1, timeout: 15000 });
    for (const line of csv.split('\n')) {
      const cols = line.split(',').map(s => s.trim());
      const year = parseInt(cols[0]);
      const annual = parseFloat(cols[13]); // J-D column
      if (!isNaN(year) && year >= 1880 && year <= CURRENT_YEAR && Number.isFinite(annual)) {
        history.push({ year, value: Math.round(annual * 100) / 100 });
      }
    }
  } catch (err) {
    console.log(`  [temperature] NASA unavailable (${err.message}), trying NOAA fallback`);
  }

  // Fallback: NOAA Climate-at-a-Glance land+ocean
  if (history.length === 0) {
    try {
      const noaa = await fetchJSON(
        `https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/land_ocean/ytd/12/1880-${CURRENT_YEAR}.json`,
        { retries: 1, timeout: 15000 }
      );
      if (noaa?.data) {
        for (const [yearStr, val] of Object.entries(noaa.data)) {
          const year = parseInt(yearStr);
          const anomaly = typeof val === 'object' && val !== null
            ? parseFloat(val.anomaly)
            : parseFloat(val);
          if (!isNaN(year) && Number.isFinite(anomaly)) {
            history.push({ year, value: Math.round(anomaly * 100) / 100 });
          }
        }
        sourceLabel = 'NOAA NCEI Climate-at-a-Glance (land+ocean)';
      }
    } catch (err) {
      console.log(`  [temperature] NOAA fallback also failed: ${err.message}`);
    }
  }

  if (history.length === 0) {
    throw new Error('Both NASA and NOAA temperature sources unavailable');
  }

  history.sort((a, b) => a.year - b.year);
  const latest = history[history.length - 1];

  const data = {
    anomaly: {
      value: latest.value,
      year: latest.year,
      source: sourceLabel,
      unit: '°C'
    },
    history
  };
  saveCache('temperature.json', data);
  console.log(`  [temperature] ${history.length} annual points, latest=${latest.value}°C (${latest.year}) [${sourceLabel}]`);
}

// ─── 2. Forests (World Bank forest area % of land) ────────────────
async function cacheForests() {
  console.log('  [forests] Fetching World Bank forest area...');
  const data = await fetchJSON(`https://api.worldbank.org/v2/country/WLD/indicator/AG.LND.FRST.ZS?format=json&per_page=60&date=1990:${CURRENT_YEAR}`);
  const history = extractWorldBankEntries(data, { roundDigits: 2 });
  const latest = history.length ? history[history.length - 1] : null;

  const payload = {
    forest_cover_pct: {
      value: latest?.value ?? null,
      year: latest?.year ?? null,
      unit: '%',
      source: 'World Bank / FAO (AG.LND.FRST.ZS)'
    },
    history
  };
  saveCache('forests.json', payload);
  console.log(`  [forests] ${history.length} years, latest=${latest?.value}% (${latest?.year})`);
}

// ─── 3. Renewables (World Bank renewable share) ────────────────────
async function cacheRenewables() {
  console.log('  [renewables] Fetching World Bank renewable energy share...');
  const data = await fetchJSON(`https://api.worldbank.org/v2/country/WLD/indicator/EG.FEC.RNEW.ZS?format=json&per_page=60&date=1990:${CURRENT_YEAR}`);
  const history = extractWorldBankEntries(data, { roundDigits: 2 });
  const latest = history.length ? history[history.length - 1] : null;

  const payload = {
    renewableEnergy: {
      current: latest?.value ?? null,
      year: latest?.year ?? null,
      unit: '%',
      source: 'World Bank (EG.FEC.RNEW.ZS)'
    },
    share_pct: {
      value: latest?.value ?? null,
      year: latest?.year ?? null,
      unit: '%',
      source: 'World Bank (EG.FEC.RNEW.ZS)'
    },
    history
  };
  saveCache('renewables.json', payload);
  console.log(`  [renewables] ${history.length} years, latest=${latest?.value}% (${latest?.year})`);
}

// ─── 4. Air quality snapshot (Open-Meteo, multi-city) ─────────────
async function cacheAirQuality() {
  console.log('  [airquality] Fetching Open-Meteo AQI for major cities...');
  const cityResults = [];
  const errors = [];
  for (const city of CITIES) {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=pm10,pm2_5,european_aqi`;
      const r = await fetchJSON(url, { retries: 1, timeout: 12000 });
      const c = r?.current;
      if (c && Number.isFinite(c.european_aqi)) {
        cityResults.push({
          name: city.name,
          country: city.country,
          aqi: Math.round(c.european_aqi),
          pm25: c.pm2_5 ?? null,
          pm10: c.pm10 ?? null
        });
      }
    } catch (err) {
      errors.push(`${city.name}: ${err.message}`);
    }
  }
  if (cityResults.length === 0) {
    throw new Error(`No city AQI readings (${errors.length} errors)`);
  }
  cityResults.sort((a, b) => a.aqi - b.aqi);

  const avg = Math.round(cityResults.reduce((s, c) => s + c.aqi, 0) / cityResults.length);
  const payload = {
    global_aqi: {
      value: avg,
      unit: 'European AQI',
      year: CURRENT_YEAR,
      source: `Open-Meteo (${cityResults.length} cities avg)`
    },
    cities: cityResults,
    // Back-compat flat key read by detail topic legacy paths
    value: avg
  };
  saveCache('airquality.json', payload);
  console.log(`  [airquality] ${cityResults.length} cities, global avg AQI=${avg}`);
}

// ─── 5. Weather snapshot (Open-Meteo current conditions) ──────────
async function cacheWeather() {
  console.log('  [weather] Fetching Open-Meteo current weather for major cities...');
  const cityResults = [];
  for (const city of CITIES) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
      const r = await fetchJSON(url, { retries: 1, timeout: 12000 });
      const c = r?.current;
      if (c && Number.isFinite(c.temperature_2m)) {
        cityResults.push({
          name: city.name,
          country: city.country,
          lat: city.lat,
          lon: city.lon,
          temp_c: Math.round(c.temperature_2m * 10) / 10,
          humidity: c.relative_humidity_2m ?? null,
          wind_kmh: c.wind_speed_10m ?? null,
          weather_code: c.weather_code ?? null
        });
      }
    } catch (_err) { /* skip city on error */ }
  }
  if (cityResults.length === 0) {
    throw new Error('No city weather readings collected');
  }

  const payload = {
    cities: cityResults,
    cities_tracked: {
      value: cityResults.length,
      year: CURRENT_YEAR,
      source: 'Open-Meteo'
    }
  };
  saveCache('weather.json', payload);
  console.log(`  [weather] ${cityResults.length} cities tracked`);
}

// ─── 6. Earthquakes (USGS 24h + 7d feeds) ──────────────────────────
async function cacheEarthquakes() {
  console.log('  [earthquakes] Fetching USGS significant + M2.5+ feeds...');
  const [day, week, significantWeek] = await Promise.all([
    fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', { retries: 1, timeout: 12000 })
      .catch(() => ({ features: [] })),
    fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson', { retries: 1, timeout: 12000 })
      .catch(() => ({ features: [] })),
    fetchJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson', { retries: 1, timeout: 12000 })
      .catch(() => ({ features: [] }))
  ]);

  const mapEvent = (f) => ({
    id: f.id,
    mag: f.properties?.mag ?? null,
    place: f.properties?.place ?? null,
    time: f.properties?.time ? new Date(f.properties.time).toISOString() : null,
    url: f.properties?.url ?? null,
    tsunami: !!f.properties?.tsunami,
    depth_km: f.geometry?.coordinates?.[2] ?? null,
    lon: f.geometry?.coordinates?.[0] ?? null,
    lat: f.geometry?.coordinates?.[1] ?? null
  });

  const significant24h = (day.features || []).filter(f => (f.properties?.mag ?? 0) >= 4.5).map(mapEvent);
  const mag5plus7d = (week.features || []).filter(f => (f.properties?.mag ?? 0) >= 5).map(mapEvent);
  const bigEvents = (significantWeek.features || []).map(mapEvent);

  const payload = {
    significant_24h: {
      value: significant24h.length,
      year: CURRENT_YEAR,
      source: 'USGS (M4.5+ last 24h)'
    },
    magnitude_5_plus_7d: {
      value: mag5plus7d.length,
      year: CURRENT_YEAR,
      source: 'USGS (M5+ last 7d)'
    },
    significant_24h_events: significant24h.slice(0, 20),
    significant_week_events: bigEvents.slice(0, 20)
  };
  saveCache('earthquakes.json', payload);
  console.log(`  [earthquakes] M4.5+/24h=${significant24h.length}, M5+/7d=${mag5plus7d.length}, sig/7d=${bigEvents.length}`);
}

// ─── 7. Crypto Fear & Greed ────────────────────────────────────────
async function cacheCryptoSentiment() {
  console.log('  [crypto_sentiment] Fetching alternative.me Fear & Greed...');
  const data = await fetchJSON('https://api.alternative.me/fng/?limit=30');
  if (!data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error('Empty Fear & Greed response');
  }
  const history = data.data
    .map(d => ({
      value: parseInt(d.value),
      label: d.value_classification,
      time: d.timestamp ? new Date(parseInt(d.timestamp) * 1000).toISOString() : null
    }))
    .filter(d => Number.isFinite(d.value))
    .reverse();
  const latest = history[history.length - 1];

  const payload = {
    fear_greed: {
      value: latest.value,
      label: latest.label,
      year: CURRENT_YEAR,
      source: 'alternative.me'
    },
    history
  };
  saveCache('crypto_sentiment.json', payload);
  console.log(`  [crypto_sentiment] latest=${latest.value} (${latest.label}), history=${history.length}`);
}

// ─── 8. Science alias (arXiv AI papers, matches topic='science') ──
async function cacheScience() {
  console.log('  [science] Fetching arXiv AI/ML papers...');
  const url = 'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20';
  const xml = await fetchText(url);
  const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  const total_results = totalMatch ? parseInt(totalMatch[1]) : 0;
  const entryBlocks = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  const papers = entryBlocks.map(block => {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const publishedMatch = block.match(/<published>([\s\S]*?)<\/published>/);
    const summaryMatch = block.match(/<summary>([\s\S]*?)<\/summary>/);
    const linkMatch = block.match(/<link[^>]*href="(https:\/\/arxiv\.org\/abs\/[^"]+)"[^>]*\/>/);
    return {
      title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled',
      published: publishedMatch ? publishedMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim().slice(0, 240) : '',
      url: linkMatch ? linkMatch[1] : ''
    };
  });

  const payload = {
    papers,
    total_results,
    total_papers: {
      value: total_results,
      year: CURRENT_YEAR,
      source: 'arXiv (cs.AI + cs.LG)'
    }
  };
  saveCache('science.json', payload);
  console.log(`  [science] ${papers.length} papers (total=${total_results})`);
}

// ─── 9. Space alias (Spaceflight News) ─────────────────────────────
async function cacheSpace() {
  console.log('  [space] Fetching Spaceflight News articles...');
  const data = await fetchJSON('https://api.spaceflightnewsapi.net/v4/articles/?limit=12&ordering=-published_at');
  if (!data || !Array.isArray(data.results)) {
    throw new Error('No results in Spaceflight News');
  }
  const articles = data.results.map(a => ({
    title: a.title,
    url: a.url,
    image_url: a.image_url,
    news_site: a.news_site,
    published_at: a.published_at,
    summary: a.summary
  }));

  // Supplement with ISS data (best-effort)
  let iss_altitude_km = null;
  try {
    const astros = await fetchJSON('http://api.open-notify.org/astros.json', { retries: 1, timeout: 6000 });
    if (astros && Number.isFinite(astros.number)) {
      iss_altitude_km = 408;
    }
  } catch (_err) { /* ignore */ }

  const payload = {
    articles,
    iss_altitude_km: {
      value: iss_altitude_km ?? 408,
      year: CURRENT_YEAR,
      source: 'NASA (nominal ISS orbit)'
    }
  };
  saveCache('space.json', payload);
  console.log(`  [space] ${articles.length} articles`);
}

// ─── 10. Health (World Bank life expectancy + mortality + DTP3) ───
async function cacheHealth() {
  console.log('  [health] Fetching World Bank health indicators...');
  const [le, mort, dtp3] = await Promise.all([
    fetchJSON(`https://api.worldbank.org/v2/country/WLD/indicator/SP.DYN.LE00.IN?format=json&per_page=60&date=1990:${CURRENT_YEAR}`)
      .catch(() => null),
    fetchJSON(`https://api.worldbank.org/v2/country/WLD/indicator/SH.DYN.MORT?format=json&per_page=60&date=1990:${CURRENT_YEAR}`)
      .catch(() => null),
    fetchJSON(`https://api.worldbank.org/v2/country/WLD/indicator/SH.IMM.IDPT?format=json&per_page=60&date=1990:${CURRENT_YEAR}`)
      .catch(() => null)
  ]);

  const leHistory = extractWorldBankEntries(le, { roundDigits: 2 });
  const mortHistory = extractWorldBankEntries(mort, { roundDigits: 1 });
  const dtp3History = extractWorldBankEntries(dtp3, { roundDigits: 1 });

  const latestLE = leHistory.length ? leHistory[leHistory.length - 1] : null;
  const latestMort = mortHistory.length ? mortHistory[mortHistory.length - 1] : null;
  const latestDtp3 = dtp3History.length ? dtp3History[dtp3History.length - 1] : null;

  if (!latestLE && !latestMort && !latestDtp3) {
    throw new Error('No World Bank health indicator data retrieved');
  }

  const payload = {
    life_expectancy: latestLE ? {
      value: latestLE.value, year: latestLE.year, unit: 'years', source: 'World Bank (SP.DYN.LE00.IN)'
    } : null,
    child_mortality: latestMort ? {
      value: latestMort.value, year: latestMort.year, unit: 'per 1000', source: 'World Bank (SH.DYN.MORT)'
    } : null,
    dtp3_coverage: latestDtp3 ? {
      value: latestDtp3.value, year: latestDtp3.year, unit: '%', source: 'World Bank (SH.IMM.IDPT)'
    } : null,
    history: {
      life_expectancy: leHistory,
      child_mortality: mortHistory,
      dtp3_coverage: dtp3History
    }
  };
  saveCache('health.json', payload);
  console.log(`  [health] LE=${latestLE?.value} mort=${latestMort?.value} DTP3=${latestDtp3?.value}%`);
}

// ─── Main ─────────────────────────────────────────────────────────
const TASKS = [
  ['temperature', cacheTemperature],
  ['forests', cacheForests],
  ['renewables', cacheRenewables],
  ['airquality', cacheAirQuality],
  ['weather', cacheWeather],
  ['earthquakes', cacheEarthquakes],
  ['crypto_sentiment', cacheCryptoSentiment],
  ['science', cacheScience],
  ['space', cacheSpace],
  ['health', cacheHealth]
];

async function main() {
  console.log('=== update-live-data (10 topics) ===');
  const success = [];
  const failed = [];

  for (const [name, fn] of TASKS) {
    try {
      await fn();
      success.push(name);
    } catch (err) {
      console.error(`  ERROR ${name}: ${err.message}`);
      failed.push(name);
    }
  }

  console.log(`\nDone: ${success.length}/${TASKS.length} caches written`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.join(', ')}`);
  }
  // Only fatal if nothing succeeded; individual outages should not block deploys.
  if (success.length === 0) {
    console.error('FATAL: No caches written');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
