# External Integrations

**Analysis Date:** 2026-03-21

## APIs & External Services

**Environmental Data:**
- USGS Earthquake Hazards - Real-time earthquake feeds M2.5+
  - Endpoint: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson`
  - No auth required
  - Client: Fetch API
  - File: `scripts/collect-data.js` line 105

- NASA GISTEMP - Global temperature anomaly historical data (CSV)
  - Endpoint: `https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv`
  - No auth required
  - File: `scripts/collect-data.js` line 121

- NOAA Global Monitoring Lab - Atmospheric CO2 monthly averages (Mauna Loa)
  - Endpoint: `https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv`
  - No auth required
  - File: `scripts/collect-data.js` line 143

- Open-Meteo Weather API - Current global weather for 8 cities
  - Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current=...`
  - No auth required (free tier unlimited)
  - Cities: Berlin, New York, Tokyo, Sydney, São Paulo, Lagos, Mumbai, London
  - File: `scripts/collect-data.js` line 186

- Open-Meteo Air Quality API - PM2.5, PM10, NO2, O3, SO2, CO for 12 cities
  - Endpoint: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=X&longitude=Y&current=...`
  - No auth required
  - Replaces OpenAQ (deprecated since Jan 2025)
  - File: `scripts/collect-data.js` line 214

**Socioeconomic Data:**
- World Bank Open Data API - 30+ indicators (forests, renewable energy, poverty, GDP, population, etc.)
  - Endpoint: `https://api.worldbank.org/v2/country/WLD/indicator/{INDICATOR_ID}?format=json&per_page=30&date=YEAR_RANGE`
  - No auth required (free public API)
  - Indicators used: AG.LND.FRST.ZS, EG.FEC.RNEW.ZS, SI.POV.DDAY, SP.DYN.LE00.IN, SH.DYN.MORT, SP.POP.TOTL, EG.ELC.ACCS.ZS, SH.H2O.SMDW.ZS, NY.GDP.MKTP.KD.ZG, SI.POV.GINI, FP.CPI.TOTL.ZG, SL.UEM.TOTL.ZS, NY.GDP.PCAP.CD, NE.TRD.GNFS.ZS, IT.NET.USER.ZS, IT.CEL.SETS.P2, GB.XPD.RSDV.GD.ZS, IP.PAT.RESD
  - File: `scripts/collect-data.js` lines 241-509 (18 separate fetch calls)

- disease.sh - COVID-19 & disease tracking (cases, deaths, active, recovered)
  - Endpoint: `https://disease.sh/v3/covid-19/all`
  - No auth required
  - File: `scripts/collect-data.js` line 352

**Economic Data:**
- Alternative.me Crypto Fear & Greed Index - Daily sentiment index (0-100)
  - Endpoint: `https://api.alternative.me/fng/?limit=30`
  - No auth required
  - File: `scripts/collect-data.js` line 415

- Open Exchange Rates API - Currency conversion rates (USD base)
  - Endpoint: `https://open.er-api.com/v6/latest/USD`
  - No auth required
  - Major pairs: EUR, GBP, JPY, CNY, INR, BRL, RUB, KRW, CHF
  - File: `scripts/collect-data.js` line 427

**Technology & Science:**
- GitHub REST API - Top 10 trending repositories by stars
  - Endpoint: `https://api.github.com/search/repositories?q=stars:>50000&sort=stars&per_page=10`
  - Optional auth: `GITHUB_TOKEN` env var for rate limits (conditional)
  - File: `scripts/collect-data.js` line 464

- arXiv API - Latest 20 scientific papers by submission date
  - Endpoint: `http://export.arxiv.org/api/query?search_query=all&sortBy=submittedDate&sortOrder=descending&max_results=20`
  - No auth required
  - Returns XML, parsed with regex
  - File: `scripts/collect-data.js` line 495

- Spaceflight News API - Latest 10 space/aerospace articles
  - Endpoint: `https://api.spaceflightnewsapi.net/v4/articles/?limit=10&ordering=-published_at`
  - No auth required
  - File: `scripts/collect-data.js` line 516

**News & Real-Time Data:**
- GDELT Project API - Global events, articles, and sentiment analysis
  - Article search: `https://api.gdeltproject.org/api/v2/doc/doc?query=world+crisis+climate+conflict&mode=artlist&maxrecords=15&format=json`
  - Tone analysis: `https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=tonechart&format=json&timespan=24h`
  - No auth required
  - File: `scripts/collect-data.js` line 535 & 547

- RSS Feeds (11 sources, parsed with `rss-parser`):
  - UN News: `https://news.un.org/feed/subscribe/en/news/all/rss.xml`
  - WHO: `https://www.who.int/rss-feeds/news-english.xml`
  - UNHCR: `https://www.unhcr.org/rss/news.xml`
  - ReliefWeb: `https://reliefweb.int/updates/rss.xml`
  - NASA: `https://www.nasa.gov/rss/dyn/breaking_news.rss`
  - NASA Earth Observatory: `https://earthobservatory.nasa.gov/feeds/earth-observatory.rss`
  - ESA: `https://www.esa.int/rssfeed/Our_Activities/Space_Science`
  - BBC News: `https://feeds.bbc.co.uk/news/world/rss.xml`
  - DW News: `https://www.dw.com/en/top-stories/rss`
  - Guardian: `https://www.theguardian.com/world/rss`
  - Reuters: `https://feeds.reuters.com/world`
  - File: `scripts/collect-data.js` line 557-570

**Data Sources Fallback:**
- Our World in Data GitHub - CO2 emissions per capita historical data (fallback source)
  - Endpoint: `https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv`
  - Used when World Bank CO2 endpoints are unavailable
  - File: `scripts/collect-data.js` line 279

## Data Storage

**Local Storage:**
- **Browser LocalStorage** - Client-side JSON caching
  - Cache key: `world-one-data`
  - TTL: 6 hours (configurable in `DataLoader`)
  - Stores: Complete processed world-state.json with timestamp
  - Location: `js/data-loader.js` lines 59-86
  - Fallback chain: Fresh data → cached (non-expired) → stale cache → error

**File System (Development):**
- Raw data directory: `data/raw/[category]/` (generated by collect-data.js)
  - Categories: environment, society, economy, tech, realtime
  - Not committed to git (generated by pipeline)

- Processed data: `data/processed/world-state.json`
  - Output of process-data.js script
  - Single source of truth for frontend

## Authentication & Identity

**Auth Provider:**
- None - This is a read-only public data dashboard
- All APIs are free and public (no credentials required)
- Optional: GitHub Personal Access Token for higher rate limits (GITHUB_TOKEN env var)

## Caching & Offline Support

**Service Worker Strategy:** (`service-worker.js`)
- **Network-first for data** - Always fetch fresh world-state.json, manifest.json
  - Falls back to cache if network fails
  - Stores successful responses in cache
  - File: `service-worker.js` lines 46-66

- **Cache-first for assets** - Serve from cache if available
  - Falls back to network for CSS, JS, images
  - Only caches same-origin responses
  - File: `service-worker.js` lines 68-82

**Precached Assets:** 22 core files hardcoded in PRECACHE_ASSETS
- HTML/manifest: index.html, manifest.json
- CSS: core.css, components.css, sections.css, animations.css
- JS: app.js, data-loader.js, scroll-engine.js, i18n.js
- Utils: math.js, dom.js
- Visualizations: particles.js, charts.js, maps.js, counters.js, cinematic.js
- Icons: icon-192.png, icon-512.png

**Cache Versioning:** Single version `worldone-v1`, cleaned on service worker activation

## Monitoring & Observability

**Error Tracking:**
- Built-in try/catch in data collection and processing
- Validation in DataLoader with error logging to console (`js/data-loader.js` line 37)
- Self-healing mechanism in `scripts/self-heal.js`
- None detected: No external error tracking service (Sentry, Rollbar, etc.)

**Logs:**
- Console logging in browser (console.warn, console.error)
- stdout logging in Node.js scripts (console.log, console.error)
- No persistent logging infrastructure

## CI/CD & Deployment

**Hosting:**
- Static file hosting (GitHub Pages or similar)
- Manifest scope: `/World_report/` (relative path deployment)
- No backend server runtime needed

**CI Pipeline:**
- None detected in current codebase
- Manual data collection via `npm run pipeline` command
- Could be automated with cron job or CI/CD action

**Data Update Cycle:**
- Designed for 6-hour updates (matching LocalStorage TTL)
- Fetch timeout: 15 seconds per request with 2 retries
- Update-cycle displayed in UI: "6h"

## Environment Configuration

**Required env vars:**
- None (all APIs are free and public)

**Optional env vars:**
- `GITHUB_TOKEN` - For GitHub API authentication (higher rate limits)
  - Used in `scripts/collect-data.js` line 465

**Secrets location:**
- None required (read-only public APIs)
- No `.env` file in repository

## Error Handling

**API Failure Strategy:**
- Retry logic: Up to 2 retries with 1-2 second exponential backoff (`fetchJSON` in collect-data.js)
- Timeout: 15 seconds per request (configurable via TIMEOUT constant)
- Fallback sources: CO2 emissions has 3-tier fallback (World Bank → Legacy WB → Our World in Data GitHub)
- Partial failure accepted: Individual data source failures don't block entire pipeline
- Results tracking: `results = { success: [], failed: [] }` array for reporting

**Frontend Failure Strategy:**
- Cache fallback: Expired cache acceptable if fetch fails
- Stale cache fallback: Works with 24+ hour old data if both fresh and recent cache unavailable
- Error display: Updates loading screen with error message if all data sources fail
- File: `js/data-loader.js` lines 35-52

---

*Integration audit: 2026-03-21*
