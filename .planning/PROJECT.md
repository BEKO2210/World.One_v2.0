# World.One — Detail Pages & Data Expansion

## What This Is

A comprehensive expansion of the World.One global dashboard (beko2210.github.io/World_report/) — adding deep-dive detail pages for every data point, a universal 3-tier data fallback system, new acts (Biodiversity, Oceans), and extended GitHub Actions caching. The site serves 1M+ visitors with real-time global indicators and a world index of 64.3/100.

## Core Value

Every number on the dashboard becomes explorable — users click any data point and get rich, interactive context with live data, historical trends, and visual explanations. No data point is ever invisible or broken (3-tier fallback guarantees this).

## Requirements

### Validated

<!-- Existing capabilities from codebase analysis -->

- ✓ Scroll-driven dashboard with 13 semantic sections (acts) — existing
- ✓ 40+ API data sources collected every 6 hours via GitHub Actions — existing
- ✓ World index calculation (0-100) with 5 sub-scores — existing
- ✓ Custom SVG charts (warming stripes, line, gauge, inequity bars) — existing
- ✓ Interactive SVG maps with 5 map layers — existing
- ✓ Animated counters with typewriter effect — existing
- ✓ Canvas particle system background — existing
- ✓ PWA with service worker (network-first data, cache-first assets) — existing
- ✓ Full DE/EN i18n system — existing
- ✓ localStorage caching with 6h TTL — existing
- ✓ Data pipeline: collect → process → self-heal → world-state.json — existing
- ✓ Responsive design, ARIA accessibility, keyboard navigation — existing

### Active

<!-- Current scope — building toward these -->

- [ ] Universal detail page system (detail/index.html with URL parameter routing)
- [ ] Dynamic topic module loader (detail/topics/{topic}.js)
- [ ] 3-tier data fallback system (live → cache → static) with badge renderer
- [ ] Central data-loader utility (utils/data-loader.js) with fetchWithTimeout
- [ ] Badge system (utils/badge.js) — LIVE/Cache/Static visual indicators
- [ ] Static fallback values (data/fallback/static-values.json)
- [ ] Chart.js integration via CDN (defer-loaded, shared across detail pages)
- [ ] Detail page base layout (hero, charts, context tiles, explanation, comparison, sources)
- [ ] Back navigation, Back-to-Top, Web Share API, print CSS
- [ ] Clickable data points on main page (cursor, hover, tooltip, onclick → detail)
- [ ] Extended GitHub Actions workflows for individual cache files
- [ ] data/cache/meta.json for pipeline health monitoring
- [ ] Reusable SVG world map choropleth (extending existing maps.js)
- [ ] Lazy-load charts via IntersectionObserver with skeleton loaders
- [ ] Full i18n support on all detail pages (DE/EN)
- [ ] Act 12: "Das Schweigen der Arten" (Biodiversity) — new main page section
- [ ] Act 13: "Die Ozeane" (Oceans) — new main page section
- [ ] Topic: co2 (NOAA Mauna Loa, Keeling Curve, emissions by country)
- [ ] Topic: temperature (NASA GISTEMP, warming stripes interactive, tipping points)
- [ ] Topic: biodiversity (GBIF, Living Planet Index, IUCN categories)
- [ ] Topic: airquality (OpenAQ, city rankings, pollutant explainer)
- [ ] Topic: forests (World Bank forest cover, deforestation trends)
- [ ] Topic: renewables (World Bank, Electricity Maps, growth curves)
- [ ] Topic: population (live counter, population pyramid, urbanization)
- [ ] Topic: conflicts (UCDP, conflict map, refugees/displaced)
- [ ] Topic: health (life expectancy, causes of death, health spending scatter)
- [ ] Topic: freedom (Freedom House, freedom map, 18-year decline trend)
- [ ] Topic: inequality (Gini, wealth distribution animation, billionaire counter)
- [ ] Topic: poverty (extreme poverty trend, regional differences)
- [ ] Topic: currencies (exchange rates, currency converter, crisis indicator)
- [ ] Topic: science (arXiv, publication explosion, hot research fields)
- [ ] Topic: internet (live stats counters, digital divide map)
- [ ] Topic: space (ISS tracker live, spaceflight news, satellite count)
- [ ] Topic: earthquakes (USGS interactive map, magnitude histogram)
- [ ] Topic: weather (24 cities, hourly sparklines, extreme weather warnings)
- [ ] Topic: solar (solar cycle chart, aurora probability, Kp-index)
- [ ] Topic: crypto_sentiment (Fear & Greed 30-day chart)
- [ ] Topic: momentum_detail (all 20 indicators expanded with sparklines)
- [ ] Topic: hunger (hunger map, food price index correlation)
- [ ] Topic: disasters (2026 timeline, historical trend + economic damage)
- [ ] Topic: ocean_temp (SST anomaly, coral bleaching explainer)
- [ ] Topic: ocean_ph (acidification, pH scale visualization)
- [ ] Topic: ocean_plastic (daily counter, 5 garbage patches map, decomposition times)
- [ ] Topic: extinction (species extinction detail)
- [ ] Topic: endangered (endangered species detail)

### Out of Scope

- Design changes to existing main page — zero breaking changes, only extend
- Leaflet or Mapbox — too heavy, use SVG maps extending existing maps.js
- New fonts or icon libraries — use emojis, no Font Awesome / Heroicons
- Backend server — stays static GitHub Pages
- User accounts or authentication — public dashboard only
- Real-time WebSocket connections — use polling / cached data
- D3.js — avoid unless absolutely needed (Sankey fallback: stacked bar chart)
- Migration of main page data pipeline — world-state.json stays as-is
- Mobile native app — web-only (PWA handles mobile)

## Context

- **Production URL**: beko2210.github.io/World_report/
- **Hosting**: GitHub Pages (static files only)
- **CI/CD**: GitHub Actions with 6-hour data collection cycle
- **Visitors**: 1M+ — performance, stability, and fault tolerance are absolute priority
- **Current architecture**: Vanilla JS ES6 modules, no framework, no bundler
- **Data pipeline**: Node.js scripts (collect → process → self-heal) → world-state.json
- **Existing acts**: 13 semantic sections (Prolog through Epilog)
- **Charts**: Custom SVG via js/visualizations/charts.js (main page stays SVG)
- **Maps**: Interactive SVG via js/visualizations/maps.js (extend for detail pages)
- **i18n**: Full DE/EN via js/i18n.js with dot-notation keys
- **App class**: BelkisOne singleton in js/app.js

## Constraints

- **Performance**: Lighthouse score must not drop below 80
- **API calls**: Max 3 direct browser API calls on main page load (rest from cache)
- **No new dependencies**: Chart.js via CDN only (no npm install for frontend)
- **Timeout**: Live API calls timeout at 5 seconds → fallback to cache
- **Cache staleness**: Badge turns orange warning after 24h stale cache
- **GitHub Actions**: Each job timeout 10min, continue-on-error: true (never block deployment)
- **Cron stagger**: 30min gaps between Action jobs to avoid rate limits
- **Zero breaking changes**: Existing main page behavior must remain identical
- **Parallel data systems**: Main page keeps world-state.json; detail pages use data/cache/*.json

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chart.js via CDN for detail pages | Rich chart types (line, bar, scatter, treemap) without custom SVG work; 60KB defer-loaded | — Pending |
| Parallel data systems | Main page stability unaffected; detail pages get independent cache files | — Pending |
| Single detail/index.html with URL routing | Avoids 30+ HTML files; topic modules loaded dynamically | — Pending |
| Extend maps.js for choropleths | Reuses existing SVG map infrastructure; no new map library | — Pending |
| Full i18n on detail pages | Consistent with main page bilingual support | — Pending |
| Acts 12+13 as full main page sections | Users discover biodiversity/oceans via scroll, then drill into detail pages | — Pending |
| Emojis for status badges | No icon library dependency; works everywhere | — Pending |
| 3-tier fallback (live → cache → static) | No data point is ever invisible; graceful degradation | — Pending |
| IntersectionObserver lazy-load for charts | Detail pages can have 5+ charts; only render visible ones | — Pending |

---
*Last updated: 2026-03-21 after initialization*
