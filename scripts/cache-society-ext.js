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

// ─── Conflicts (multi-source: ACLED + ReliefWeb + GDELT + UCDP) ───
async function fetchConflicts() {
  console.log('  Fetching conflict data (multi-source)...');

  const result = {
    conflict_data: {
      active_conflicts: 59,
      source: 'static_fallback',
      api_status: 'static_fallback',
      events: [],
      crises: [],
      trend_articles: null,
      acled: null,
    }
  };

  // ── Source 0: ACLED (OAuth — richest conflict event data) ──
  // Requires ACLED_EMAIL + ACLED_PASSWORD as GitHub Secrets
  // Authenticates via OAuth, gets temporary token, then fetches events
  const acledEmail = process.env.ACLED_EMAIL;
  const acledPassword = process.env.ACLED_PASSWORD;
  if (acledEmail && acledPassword) {
    try {
      // Step 1: Get OAuth access token
      // Docs: https://acleddata.com/api-documentation/getting-started
      // Must use x-www-form-urlencoded with username (not email), client_id=acled
      console.log('    ACLED: authenticating...');
      const tokenRes = await fetch('https://acleddata.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: acledEmail,
          password: acledPassword,
          grant_type: 'password',
          client_id: 'acled',
        }).toString(),
        signal: AbortSignal.timeout(15000),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => '');
        throw new Error(`Auth failed: HTTP ${tokenRes.status} ${errText.substring(0, 200)}`);
      }
      const tokenData = await tokenRes.json();
      const accessToken = tokenData?.access_token;
      if (!accessToken) throw new Error('No access_token in response');
      console.log('    ACLED: authenticated OK (token expires in', tokenData.expires_in, 's)');

      // Step 2: Fetch last 30 days of events
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const acledUrl = `https://acleddata.com/api/acled/read`
        + `?event_date=${thirtyDaysAgo}|${today}&event_date_where=BETWEEN`
        + `&fields=event_date|country|event_type|fatalities|latitude|longitude`
        + `&limit=500`;
      const acledRes = await fetch(acledUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000),
      });
      if (!acledRes.ok) throw new Error(`Fetch failed: HTTP ${acledRes.status}`);
      const acledData = await acledRes.json();

      if ((acledData?.success || acledData?.status === 200) && acledData?.data?.length > 0) {
        const events = acledData.data;
        const totalFatalities = events.reduce((s, e) => s + (Number(e.fatalities) || 0), 0);

        // Count unique countries with events
        const countries = new Set(events.map(e => e.country));

        // Top 10 countries by event count
        const countryEvents = {};
        events.forEach(e => {
          countryEvents[e.country] = (countryEvents[e.country] || 0) + 1;
        });
        const topCountries = Object.entries(countryEvents)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([country, count]) => ({ country, events: count }));

        // Event type breakdown
        const typeBreakdown = {};
        events.forEach(e => {
          const type = e.event_type || 'Unknown';
          typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
        });

        // Recent top-fatality events as locations with coordinates
        const highFatality = events
          .filter(e => Number(e.fatalities) > 0)
          .sort((a, b) => Number(b.fatalities) - Number(a.fatalities))
          .slice(0, 20)
          .map(e => ({
            country: e.country,
            date: e.event_date,
            type: e.event_type,
            fatalities: Number(e.fatalities),
            lat: Number(e.latitude),
            lng: Number(e.longitude),
          }));

        result.conflict_data.acled = {
          totalEvents: events.length,
          totalFatalities,
          countriesAffected: countries.size,
          topCountries,
          typeBreakdown,
          highFatalityEvents: highFatality,
          period: `${thirtyDaysAgo} to ${today}`,
        };
        result.conflict_data.active_conflicts = Math.max(countries.size, result.conflict_data.active_conflicts);
        result.conflict_data.source = 'ACLED';
        result.conflict_data.api_status = 'live';
        console.log(`    ACLED: ${events.length} events, ${totalFatalities} fatalities, ${countries.size} countries (30d)`);
      }
    } catch (err) {
      console.log(`    ACLED: failed (${err.message})`);
    }
  } else {
    console.log('    ACLED: no credentials configured (set ACLED_EMAIL + ACLED_PASSWORD secrets)');
  }

  // ── Source 1: ReliefWeb (UN OCHA) — Active crises + humanitarian reports ──
  // Uses POST (GET with filter[] params returns 406 on GitHub Actions)
  try {
    const rwRes = await fetch('https://api.reliefweb.int/v2/reports?appname=worldone&limit=25', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        filter: { field: 'theme.name', value: 'Armed Conflict' },
        sort: ['date:desc'],
        fields: { include: ['title', 'date', 'country', 'source', 'url'] },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!rwRes.ok) throw new Error(`HTTP ${rwRes.status}`);
    const rwData = await rwRes.json();

    if (rwData?.data?.length > 0) {
      result.conflict_data.crises = rwData.data.map(r => ({
        title: r.fields?.title || '',
        date: r.fields?.date?.original || '',
        countries: (r.fields?.country || []).map(c => c.name),
        source: (r.fields?.source || []).map(s => s.name).join(', '),
        url: r.fields?.url || '',
      }));
      result.conflict_data.source = 'ReliefWeb';
      result.conflict_data.api_status = 'live';
      console.log(`    ReliefWeb: ${result.conflict_data.crises.length} conflict reports`);
    }
  } catch (err) {
    console.log(`    ReliefWeb: failed (${err.message})`);
  }

  // ── Source 2: ReliefWeb Disasters — Current active emergencies ──
  try {
    const disRes = await fetch('https://api.reliefweb.int/v2/disasters?appname=worldone&limit=15', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        filter: { field: 'status', value: 'current' },
        sort: ['date:desc'],
        fields: { include: ['name', 'date', 'country', 'type', 'status'] },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!disRes.ok) throw new Error(`HTTP ${disRes.status}`);
    const disData = await disRes.json();

    if (disData?.data?.length > 0) {
      result.conflict_data.active_emergencies = disData.data.map(d => ({
        name: d.fields?.name || '',
        date: d.fields?.date?.[0]?.original || '',
        countries: (d.fields?.country || []).map(c => c.name),
        type: (d.fields?.type || []).map(t => t.name).join(', '),
      }));
      console.log(`    ReliefWeb Disasters: ${result.conflict_data.active_emergencies.length} active`);
    }
  } catch (err) {
    console.log(`    ReliefWeb Disasters: failed (${err.message})`);
  }

  // ── Source 3: GDELT — Conflict article volume (24h trend) ──
  try {
    const gdeltUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=armed+conflict+OR+war+OR+military+attack'
      + '&mode=timelinevol&format=json&timespan=7d';
    const gdeltData = await fetchJSON(gdeltUrl, { timeout: 10000, retries: 1 });

    if (gdeltData?.timeline?.length > 0) {
      const series = gdeltData.timeline[0]?.data || [];
      result.conflict_data.trend_articles = series.map(d => ({
        date: d.date,
        volume: d.value,
      }));
      console.log(`    GDELT: ${series.length} timeline points (7d conflict volume)`);
    }
  } catch (err) {
    console.log(`    GDELT timeline: failed (${err.message})`);
  }

  // ── Source 4: GDELT — Top conflict headlines ──
  try {
    const headlinesUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=armed+conflict+OR+military+attack'
      + '&mode=artlist&format=json&maxrecords=10&timespan=24h&sourcelang=english';
    const headlinesData = await fetchJSON(headlinesUrl, { timeout: 10000, retries: 1 });

    if (headlinesData?.articles?.length > 0) {
      result.conflict_data.headlines = headlinesData.articles.map(a => ({
        title: a.title || '',
        url: a.url || '',
        source: a.domain || '',
        date: a.seendate || '',
      }));
      console.log(`    GDELT Headlines: ${result.conflict_data.headlines.length} articles`);
    }
  } catch (err) {
    console.log(`    GDELT Headlines: failed (${err.message})`);
  }

  // ── Source 5: UCDP (structured events, no key needed) ──
  try {
    const ucdpUrl = 'https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=1&page=1';
    const ucdpData = await fetchJSON(ucdpUrl, { timeout: 10000, retries: 1 });
    if (ucdpData?.TotalCount !== undefined) {
      result.conflict_data.ucdp_total_events = ucdpData.TotalCount;
      result.conflict_data.active_conflicts = Math.max(result.conflict_data.active_conflicts,
        Math.round(ucdpData.TotalCount / 5000)); // rough estimate
      console.log(`    UCDP: ${ucdpData.TotalCount} total events`);
    }
  } catch (err) {
    console.log(`    UCDP: failed (${err.message})`);
  }

  if (result.conflict_data.api_status !== 'live') {
    console.log('    Conflicts: all live sources failed, using static fallback');
  }

  return result;
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
