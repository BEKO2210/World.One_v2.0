#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Society Extended Cache Generator
   Fetches population, freedom index, conflict and refugee data
   Output: data/cache/population.json, freedom.json, conflicts.json,
           refugees.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, fetchText, extractWorldBankEntries, saveCache } from './cache-utils.js';

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

// ─── Freedom (Freedom House via Our World in Data) ───
// Freedom House hat keine API. OWID veröffentlicht die Einstufungen
// (frei / teilweise frei / nicht frei) aller Länder und Gebiete seit 1972
// und die Bevölkerung je Status. Die frühere „globale Punktzahl“ 47 → 42,3
// gab es bei Freedom House nicht; sie ist entfernt.
const OWID_FH = {
  status: 'https://ourworldindata.org/grapher/free-countries-fh.csv?useColumnShortNames=true',
  people: 'https://ourworldindata.org/grapher/people-living-in-free-countries-fh.csv?useColumnShortNames=true',
  regime: 'https://ourworldindata.org/grapher/political-regime-fh.csv?useColumnShortNames=true',   // 0 nicht frei, 1 teilweise, 2 frei
  score: 'https://ourworldindata.org/grapher/freedom-score-fh.csv?useColumnShortNames=true',       // Gesamtpunktzahl 0–100
};

// Neuestes Jahr je Land: ISO3 → { year, [col]: Zahl }
function latestByCountry(csv, col) {
  const [header, ...lines] = csv.trim().split('\n');
  const cols = header.split(',');
  const iCode = cols.indexOf('code'), iYear = cols.indexOf('year'), iVal = cols.indexOf(col);
  const out = {};
  for (const l of lines) {
    const f = l.split(',');
    const code = f[iCode], year = Number(f[iYear]), val = Number(f[iVal]);
    if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(val) || f[iVal] === '') continue;
    if (!out[code] || out[code].year < year) out[code] = { year, value: val };
  }
  return out;
}

function worldRows(csv) {
  const [header, ...lines] = csv.trim().split('\n');
  const cols = header.split(',');
  return lines
    .filter(l => l.startsWith('World,OWID_WRL,'))
    .map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}

async function getFreedomData() {
  console.log('  Fetching freedom data (Freedom House via OWID)...');
  const [statusCsv, peopleCsv, regimeCsv, scoreCsv, wbCountries] = await Promise.all([
    fetchText(OWID_FH.status), fetchText(OWID_FH.people), fetchText(OWID_FH.regime), fetchText(OWID_FH.score),
    fetchJSON('https://api.worldbank.org/v2/country?format=json&per_page=400', { timeout: 20000, retries: 1 }),
  ]);

  const status_trend = worldRows(statusCsv).map(r => ({
    year: Number(r.year),
    free: Number(r.num_regime__category_free),
    partlyFree: Number(r.num_regime__category_partly_free),
    notFree: Number(r.num_regime__category_not_free),
  })).filter(r => [r.year, r.free, r.partlyFree, r.notFree].every(Number.isFinite));

  // Anteil der Weltbevölkerung in freien Ländern (alle Kategorien im Nenner)
  const pop_free_share = worldRows(peopleCsv).map(r => {
    const total = Object.entries(r).filter(([k]) => k.startsWith('pop_regime')).reduce((s, [, v]) => s + (Number(v) || 0), 0);
    return { year: Number(r.year), value: Math.round(Number(r.pop_regime__category_free) / total * 1000) / 10 };
  }).filter(r => Number.isFinite(r.value) && r.value > 0);

  // Status + Punktzahl je Land für die Karte (ISO2, Karte arbeitet mit ISO2)
  const iso2 = Object.fromEntries((wbCountries?.[1] || []).map(c => [c.id, c.iso2Code]));
  const regime = latestByCountry(regimeCsv, 'regime');
  const score = latestByCountry(scoreCsv, 'total_score');
  const countries = {};
  for (const [iso3, r] of Object.entries(regime)) {
    if (!iso2[iso3]) continue;
    countries[iso2[iso3]] = { status: r.value, score: score[iso3]?.value ?? null, year: r.year };
  }

  if (status_trend.length < 20 || pop_free_share.length < 20 || Object.keys(countries).length < 150) {
    throw new Error(`OWID Freedom House: zu wenig Daten (${status_trend.length}/${pop_free_share.length}/${Object.keys(countries).length})`);
  }
  const last = status_trend.at(-1);
  console.log(`  Freedom: ${status_trend[0].year}–${last.year}, ${last.year}: ${last.free}/${last.partlyFree}/${last.notFree}, Bevölkerung frei ${pop_free_share.at(-1).value} %`);

  // Kennzahlen aus „Freedom in the World 2026“ (Berichtsjahr 2025), wörtlich:
  // „Global freedom declined for the 20th consecutive year in 2025.“
  // „Today, 88 of the world's 195 countries are rated Free.“
  // „In 2005, 45 countries were rated Not Free; today that number is 59.“
  // „A total of 54 countries experienced deterioration … while only 35
  //  countries registered improvements.“
  // https://freedomhouse.org/report/freedom-world/2026/growing-shadow-autocracy
  const report = {
    edition: 2026, dataYear: 2025, declineYears: 20,
    free: 88, partlyFree: 195 - 88 - 59, notFree: 59, declined: 54, improved: 35,
  };
  console.log(`  Freedom: ${Object.keys(countries).length} Länder mit Status für die Karte`);
  return {
    status_trend,
    pop_free_share,
    countries,
    report,
    source: 'Freedom House – Freedom in the World (via Our World in Data)',
    note: 'status_trend zählt Länder und Gebiete, report nur die 195 Staaten',
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
    const gdeltUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=(armed%20conflict%20OR%20war%20OR%20military%20attack)'
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
    const headlinesUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=(armed%20conflict%20OR%20military%20OR%20war%20OR%20crisis)'
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

// ─── Refugees / Forcibly Displaced (UNHCR Refugee Data Finder API) ───
// Keyless. Liefert globale Jahreswerte; das laufende Jahr ist oft noch leer,
// daher rückwärts suchen bis ein Jahr mit Daten kommt.
async function fetchRefugees() {
  console.log('  Fetching refugee data (UNHCR)...');
  const thisYear = new Date().getUTCFullYear();
  for (let year = thisYear; year >= thisYear - 3; year--) {
    const res = await fetchJSON(
      `https://api.unhcr.org/population/v1/population/?year=${year}&limit=1`,
      { timeout: 20000, retries: 1 }
    );
    const it = Array.isArray(res?.items) ? res.items[0] : null;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    if (!it || num(it.refugees) <= 0) continue;
    const refugees = num(it.refugees);
    const asylumSeekers = num(it.asylum_seekers);
    const idps = num(it.idps);
    const oip = num(it.oip);
    // Summe der UNHCR-Kategorien (ohne UNRWA-Palästina-Flüchtlinge, die die
    // API nicht führt) — daher etwas niedriger als die Global-Trends-Zahl.
    const total = refugees + asylumSeekers + idps + oip;
    console.log(`  Refugees: ${year} total ${(total / 1e6).toFixed(1)}M`);
    let bilateral = {};
    try {
      bilateral = await fetchRefugeeFlows(year);
    } catch (err) {
      console.warn(`  WARN refugee flows: ${err.message}`);
    }
    return {
      ...bilateral,
      year,
      total,
      refugees,
      asylum_seekers: asylumSeekers,
      idps,
      other_in_need: oip,
      stateless: num(it.stateless),
      api_status: 'live',
      source: `UNHCR Refugee Data Finder (${year})`,
      note: 'Summe aus Flüchtlingen, Asylsuchenden, Binnenvertriebenen und weiteren Schutzbedürftigen, ohne UNRWA'
    };
  }
  throw new Error('UNHCR returned no data for the last 4 years');
}

// Herkunft → Aufnahmeland (Flüchtlinge + Asylsuchende + weitere Schutz-
// bedürftige „oip“, z. B. Venezolaner in Kolumbien). Binnenvertriebene
// zählen nicht als grenzüberschreitende Bewegung. ISO2 für Karte + Namen.
async function fetchRefugeeFlows(year) {
  const [pairs, hosts, countries, wbCountries] = await Promise.all([
    fetchJSON(`https://api.unhcr.org/population/v1/population/?year=${year}&coo_all=true&coa_all=true&limit=10000`, { timeout: 30000, retries: 1 }),
    fetchJSON(`https://api.unhcr.org/population/v1/population/?year=${year}&coa_all=true&limit=400`, { timeout: 20000, retries: 1 }),
    fetchJSON('https://api.unhcr.org/population/v1/countries/?limit=400', { timeout: 20000, retries: 1 }),
    // Hauptstadt-Koordinaten für die Kartenbögen (World Bank Länderliste)
    fetchJSON('https://api.worldbank.org/v2/country?format=json&per_page=400', { timeout: 20000, retries: 1 }).catch(() => null),
  ]);
  const capital = Object.fromEntries((wbCountries?.[1] || [])
    .filter(c => c.latitude && c.longitude)
    .map(c => [c.iso2Code, [Number(c.latitude), Number(c.longitude)]]));
  const iso2 = Object.fromEntries((countries?.items || []).map(c => [c.iso, c.iso2]));
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const known = (iso) => iso && iso !== '-' && iso !== 'UNK' && iso2[iso];
  const moves = (pairs?.items || [])
    .filter(it => it.coo_iso !== it.coa_iso && known(it.coo_iso) && known(it.coa_iso))
    .map(it => ({
      from: it.coo_name.trim(), fromIso2: iso2[it.coo_iso],
      to: it.coa_name.trim(), toIso2: iso2[it.coa_iso],
      count: num(it.refugees) + num(it.asylum_seekers) + num(it.oip),
    }))
    .filter(f => f.count > 0);
  if (moves.length < 20) throw new Error(`nur ${moves.length} Paare`);
  // Aufnahmeländer: UNHCR-Summe je Land (inkl. unbekannter Herkunft)
  const hostList = (hosts?.items || [])
    .filter(it => known(it.coa_iso))
    .map(it => ({ name: it.coa_name.trim(), iso2: iso2[it.coa_iso], count: num(it.refugees) + num(it.asylum_seekers) + num(it.oip) }));
  const crossBorder = hostList.reduce((s, h) => s + h.count, 0);
  const flows = [...moves].sort((a, b) => b.count - a.count).slice(0, 10)
    .map(f => ({ ...f, fromLatLng: capital[f.fromIso2] || null, toLatLng: capital[f.toIso2] || null }));
  const top_hosts = hostList.sort((a, b) => b.count - a.count).slice(0, 5);
  console.log(`  Refugee flows: ${moves.length} Paare, größter ${flows[0].from} → ${flows[0].to}`);
  return { flows, top_hosts, cross_border_total: crossBorder };
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
    const freedomData = await getFreedomData();
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

  // Refugees
  try {
    const refugeeData = await fetchRefugees();
    saveCache('refugees.json', refugeeData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR refugees: ${err.message}`);
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
