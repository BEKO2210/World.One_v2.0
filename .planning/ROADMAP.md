# Roadmap: World.One Detail Pages & Data Expansion

## Overview

This roadmap transforms World.One from a scroll-driven dashboard into an explorable data platform. The build follows a layered strategy: shared infrastructure first (data loader, badges, Chart.js lifecycle, detail page shell), then a single topic (CO2) to prove the full pattern end-to-end, then scaling across all 28 topics grouped by their main-page acts. The main page extends last (clickable data points, new acts 12+13) to avoid touching production until all detail pages are proven. Every phase delivers verifiable capability -- a user can test each phase completion by visiting real URLs and observing real behavior.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Layer & Utilities** - 3-tier data fallback, badge renderer, static fallback values, and Chart.js lifecycle management
- [x] **Phase 2: Detail Page Shell** - Single-page router, topic module loader, base layout, navigation, sharing, print, lazy-loading, error states, i18n, time range selector, and design system (completed 2026-03-21)
- [ ] **Phase 3: GitHub Actions Pipeline** - Extended cron workflows for all cache file groups, pipeline health monitoring via meta.json
- [ ] **Phase 4: First Topics -- CO2, Temperature, Earthquakes, Population, Conflicts** - Prove the topic module pattern across 5 diverse topics spanning environment, realtime, and society
- [ ] **Phase 5: Environment & Forests Topics** - Biodiversity, air quality, forests, renewables -- complete the environment topic set with SVG choropleth maps
- [x] **Phase 6: Society & Economy Core** - Health, freedom, inequality, poverty -- complete society and economy coverage (completed 2026-03-21)
- [ ] **Phase 7: Economy, Progress & Weather** - Currencies, science, internet, space, weather -- mixed-domain topics with live data and interactive elements
- [ ] **Phase 8: Remaining Topics** - Solar, crypto sentiment, momentum dashboard, hunger, disasters -- complete all 28 topic pages (gap closure in progress)
- [x] **Phase 9: Main Page Clickable Data Points** - All existing tiles/charts become clickable links to detail pages with hover states and tooltips (completed 2026-03-21)
- [x] **Phase 10: New Acts & Biodiversity/Ocean Topics** - Acts 12+13 as new main page scroll sections, plus their dedicated detail topic pages (completed 2026-03-21)

## Phase Details

### Phase 1: Data Layer & Utilities
**Goal**: Users never see broken or missing data -- every data request resolves through live API, cached JSON, or static fallback, with a visible badge showing which tier served the data
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A data request with a working API returns live data and displays a pulsing LIVE badge
  2. A data request with a failing API falls back to cached JSON and displays a Cache badge (orange if >24h stale)
  3. A data request with no API and no cache falls back to static values and displays a Static badge with reference year
  4. Chart.js loads from CDN with dark-theme defaults and every chart instance is tracked for mandatory destroy() cleanup
  5. Static fallback file contains value, year, and source for every data point used across all planned topics
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md -- Data loader with 3-tier fallback and static fallback values file
- [ ] 01-02-PLAN.md -- Badge renderer with CSS styles and i18n translations
- [ ] 01-03-PLAN.md -- Chart.js CDN loader, dark-theme defaults, and instance registry

### Phase 2: Detail Page Shell
**Goal**: Users can navigate to detail/index.html?topic=X and see a fully structured page with loading states, error handling, navigation, and consistent design -- even before any real topic content exists
**Depends on**: Phase 1
**Requirements**: DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, DETAIL-06, DETAIL-07, DETAIL-08, DETAIL-09, DETAIL-10, DETAIL-11, DETAIL-12
**Success Criteria** (what must be TRUE):
  1. Navigating to detail/?topic=co2 loads the page shell with skeleton loaders, then dynamically imports the topic module
  2. Navigating to detail/?topic=nonexistent shows a graceful error page with back-navigation (never a blank screen)
  3. The page renders all 7 layout blocks (hero, primary chart, trend, tiles, explanation, comparison, sources) in the correct order
  4. User can navigate back (fixed top-left button), scroll to top, share via Web Share API (or clipboard fallback), and print a clean light-background version
  5. Switching language (?lang=de/en) translates all UI chrome and the time range selector (1Y/5Y/20Y/Max) updates chart data ranges
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- HTML shell with 7 layout blocks, CSS styles (layout, skeleton, print, nav), and i18n translation keys
- [ ] 02-02-PLAN.md -- Application logic: URL routing, dynamic module loader, error states, nav controls, share, time range, stub topic module

### Phase 3: GitHub Actions Pipeline
**Goal**: Every detail page topic has fresh cached data updated automatically via staggered GitHub Actions jobs, with pipeline health visible in meta.json
**Depends on**: Phase 1
**Requirements**: ACTIONS-01, ACTIONS-02, ACTIONS-03, ACTIONS-04, ACTIONS-05, ACTIONS-06, ACTIONS-07, ACTIONS-08, ACTIONS-09, INFRA-07
**Success Criteria** (what must be TRUE):
  1. GitHub Actions workflow runs staggered cron jobs at 30-minute intervals (03:00, 03:30, 04:00, 04:30, 05:00, 05:30 UTC) producing per-group cache JSON files
  2. Every job has a 10-minute timeout and continue-on-error: true -- a single failing API never blocks the deployment or other jobs
  3. data/cache/meta.json is updated after each run with last_full_update timestamp, jobs_ok/jobs_failed counts, total_cache_files, and total_data_points
  4. Service worker is updated with versioned cache name and correctly routes data/cache/ requests through its caching strategy
  5. Cache files written to data/cache/ match the schema expected by the data-loader's cache tier (valid JSON, expected field names)
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Shared cache utilities (cache-utils.js) and first 3 cache scripts (biodiversity, environment-ext, society-ext)
- [ ] 03-02-PLAN.md -- Remaining 3 cache scripts (economy-ext, progress-ext, disasters) and cache validation utility
- [ ] 03-03-PLAN.md -- GitHub Actions workflow (cache-pipeline.yml), meta.json generator, and service worker update

### Phase 4: First Topics -- CO2, Temperature, Earthquakes, Population, Conflicts
**Goal**: Five diverse topic pages are fully functional end-to-end, proving the topic module pattern works across different data sources, chart types, and content structures
**Depends on**: Phase 2, Phase 3
**Requirements**: ENV-01, ENV-02, SOC-01, SOC-02, RT-01
**Success Criteria** (what must be TRUE):
  1. User visits detail/?topic=co2 and sees current ppm value, Keeling Curve chart (1958-today), emissions-by-country breakdown, and greenhouse effect infographic
  2. User visits detail/?topic=temperature and sees anomaly hero, interactive warming stripes with event tooltips, regional warming choropleth, and 9 tipping points timeline
  3. User visits detail/?topic=earthquakes and sees an interactive SVG map of USGS 24h earthquakes (magnitude=size, depth=color, click popup) and a 7-day magnitude histogram
  4. User visits detail/?topic=population and sees a live counter, births/deaths clock, toggleable population pyramid (1960/2000/2026/2050), and urbanization chart
  5. User visits detail/?topic=conflicts and sees active conflict count, SVG conflict map with intensity dots, 1946-today trend with event markers, and refugees doughnut chart
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md -- Fix data-loader path resolution, add all Phase 4 i18n keys, and implement CO2 topic module
- [ ] 04-02-PLAN.md -- Temperature topic module (warming stripes, tipping points) and Population topic module (live counter, pyramid)
- [ ] 04-03-PLAN.md -- Earthquakes topic module (USGS live SVG map) and Conflicts topic module (conflict map, trend, refugees)

### Phase 5: Environment & Forests Topics
**Goal**: Users can explore the full environment topic set -- biodiversity, air quality, forests, and renewables -- with SVG choropleths and interactive rankings
**Depends on**: Phase 4
**Requirements**: ENV-03, ENV-04, ENV-05, ENV-06, INFRA-06
**Success Criteria** (what must be TRUE):
  1. User visits detail/?topic=biodiversity and sees threatened species count, Living Planet Index trend, and IUCN category browser with critically endangered species list
  2. User visits detail/?topic=airquality and sees global AQI, city rankings, AQI-vs-GDP scatter plot, and PM2.5/PM10/NO2 pollutant explainer
  3. User visits detail/?topic=forests and sees forest cover %, annual loss since 2000, and deforestation causes as stacked bar chart
  4. User visits detail/?topic=renewables and sees renewable energy %, live carbon intensity for DE, country ranking, and solar+wind growth curves
  5. Reusable SVG choropleth component works across biodiversity, air quality, and renewables maps extending the existing maps.js
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md -- Reusable SVG choropleth component (INFRA-06), Phase 5 i18n keys + static fallbacks, and biodiversity topic module
- [ ] 05-02-PLAN.md -- Air quality topic module (AQI, scatter, city rankings) and forests topic module (loss chart, deforestation causes)
- [ ] 05-03-PLAN.md -- Renewables topic module (carbon intensity, country ranking, solar+wind growth, choropleth map)

### Phase 6: Society & Economy Core
**Goal**: Users can explore health, political freedom, inequality, and poverty -- completing the society and core economy topic coverage
**Depends on**: Phase 4
**Requirements**: SOC-03, SOC-04, ECON-01, ECON-02
**Success Criteria** (what must be TRUE):
  1. User visits detail/?topic=health and sees life expectancy hero, causes-of-death treemap, health spending vs life expectancy scatter (bubble=population), and vaccination choropleth
  2. User visits detail/?topic=freedom and sees Freedom House score, green/yellow/red SVG choropleth, and 18-year decline trend chart
  3. User visits detail/?topic=inequality and sees Gini index, 100-person wealth distribution animation, country Gini ranking (toggle income/wealth), and billionaire counter
  4. User visits detail/?topic=poverty and sees extreme poverty % ($2.15/day), animated 38%-to-8% trend line, and regional stacked area chart
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md -- Phase 6 i18n keys + static fallbacks, and health topic module (treemap, bubble chart, vaccination choropleth)
- [ ] 06-02-PLAN.md -- Freedom topic module (choropleth, trend chart) and poverty topic module (animated trend, stacked area)
- [ ] 06-03-PLAN.md -- Inequality topic module (wealth distribution grid, income/wealth toggle, billionaire counter)

### Phase 7: Economy, Progress & Weather
**Goal**: Users can explore currencies, scientific progress, internet usage, space exploration, and global weather -- topics with live data feeds and interactive elements
**Depends on**: Phase 5, Phase 6
**Requirements**: ECON-03, PROG-01, PROG-02, PROG-03, RT-02
**Success Criteria** (what must be TRUE):
  1. User visits detail/?topic=currencies and sees key exchange rates, a working client-side currency converter (from cache), 12-month EUR/USD and USD/CNY charts, and hyperinflation countries highlighted
  2. User visits detail/?topic=science and sees total arXiv papers, animated exponential growth curve, hot research fields bar chart, and Nobel prizes by country bubble chart
  3. User visits detail/?topic=internet and sees internet users %, real-time calculated counters (emails/YouTube/Google sent today), and digital divide SVG choropleth
  4. User visits detail/?topic=space and sees ISS position live on SVG map (10s refresh, orbit trail), crew list, spaceflight news feed, and satellite count visualization
  5. User visits detail/?topic=weather and sees 24 cities across all continents with hourly sparklines and extreme weather warnings (color-coded by severity)
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md -- Phase 7 i18n keys + static fallbacks, and currencies topic module (converter, 12-month charts, hyperinflation)
- [ ] 07-02-PLAN.md -- Science topic module (growth curve, fields bar, Nobel bubble) and internet topic module (real-time counters, digital divide choropleth)
- [ ] 07-03-PLAN.md -- Space topic module (ISS live tracker, crew, news feed) and weather topic module (24 cities, SVG sparklines, warnings)

### Phase 8: Remaining Topics
**Goal**: All 28 topic pages are complete -- solar activity, crypto sentiment, world momentum dashboard, hunger, and disasters fill the final gaps
**Depends on**: Phase 7
**Requirements**: RT-03, RT-04, MOM-01, CRISIS-01, CRISIS-02
**Success Criteria** (what must be TRUE):
  1. User visits detail/?topic=solar and sees solar activity hero, solar cycle 25 chart with sunspot count, and aurora Kp-index map with visibility latitude bands
  2. User visits detail/?topic=crypto_sentiment and sees 30-day Fear & Greed history chart with color zones (red=fear, green=greed)
  3. User visits detail/?topic=momentum_detail and sees all 20 indicators as mini-cards with value, trend arrow, % change, 10-year sparkline, and improvement/stagnation/decline assessment
  4. User visits detail/?topic=hunger and sees hunger index, SVG choropleth by malnutrition rate with click popups, and FAO Food Price Index trend with correlation visualization
  5. User visits detail/?topic=disasters and sees 2026 natural disaster timeline (type/country/affected/damage), and historical trend dual-axis chart (frequency + economic cost)
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md -- Phase 8 i18n keys + static fallbacks, and solar topic module (NOAA live data, cycle 25 chart, aurora Kp map) (completed 2026-03-21)
- [x] 08-02-PLAN.md -- Crypto sentiment topic module (30-day F&G chart with color zones) and momentum detail topic module (24 indicator mini-cards with SVG sparklines) (completed 2026-03-21)
- [x] 08-03-PLAN.md -- Hunger topic module (choropleth, FAO trend) and disasters topic module (timeline, dual-axis trend chart) (completed 2026-03-21)
- [ ] 08-04-PLAN.md -- Gap closure: Add % change display and click-to-topic navigation to momentum mini-cards (MOM-01)

### Phase 9: Main Page Clickable Data Points
**Goal**: Every data point, tile, and chart section on the existing main page becomes a gateway to its detail page -- users discover the detail system through natural interaction with the dashboard they already know
**Depends on**: Phase 8
**Requirements**: MAIN-01, MAIN-02
**Success Criteria** (what must be TRUE):
  1. Clicking any data tile, counter, or chart section on the main page navigates to the corresponding detail page (detail/?topic={id})
  2. Hovering over a clickable element shows +10% brightness, border glow, pointer cursor, and a tooltip reading "Klicken fur Details" (DE) / "Click for details" (EN)
  3. All existing main page behavior remains identical -- no visual changes, no performance regression, no broken scroll-driven animations
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md -- CSS .detail-link hover styles, i18n tooltip key, and _initDetailLinks() for static elements (Acts 1-6) (completed 2026-03-21)
- [x] 09-02-PLAN.md -- Dynamic element wiring (momentum items, comparison grid), tooltip refresh on language toggle, and full verification checkpoint (completed 2026-03-21)

### Phase 10: New Acts & Biodiversity/Ocean Topics
**Goal**: The main page gains two new scroll-driven acts (Biodiversity and Oceans) and users can drill from these new sections into five dedicated detail topic pages
**Depends on**: Phase 9
**Requirements**: MAIN-03, MAIN-04, MAIN-05, OCEAN-01, OCEAN-02, OCEAN-03, BIO-01, BIO-02
**Success Criteria** (what must be TRUE):
  1. Scrolling past Act 11 reveals Act 12 "Das Schweigen der Arten" with biodiversity tiles (extinction rate, endangered species count) matching the existing act design language
  2. Scrolling past Act 12 reveals Act 13 "Die Ozeane" with ocean tiles (SST anomaly, pH trend, plastic estimate) matching the existing act design language
  3. Tiles in Acts 12 and 13 are clickable and navigate to their respective detail pages (extinction, endangered, ocean_temp, ocean_ph, ocean_plastic)
  4. User visits detail/?topic=ocean_temp and sees SST anomaly, SVG heatmap choropleth, and coral bleaching threshold explainer
  5. User visits detail/?topic=ocean_plastic and sees ocean plastic estimate, animated daily counter, 5 garbage patches SVG map, and decomposition time animation (bottle: 450 years)
**Plans**: 3 plans

Plans:
- [x] 10-01-PLAN.md -- Main page Acts 12+13 HTML sections, all 7 registration points (scroll engine, nav dots, particle colors, cinematic, detail links), Phase 10 i18n keys + static fallbacks (completed 2026-03-21)
- [ ] 10-02-PLAN.md -- Ocean topic modules: ocean_temp (SST timeline, choropleth, coral explainer), ocean_ph (pH trend, scale, acidification), ocean_plastic (daily counter, garbage patches SVG, decomposition)
- [ ] 10-03-PLAN.md -- Biodiversity topic modules: extinction (Big Five timeline, current rate comparison, taxonomic groups) and endangered (IUCN category doughnut, species examples)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer & Utilities | 0/3 | Not started | - |
| 2. Detail Page Shell | 2/2 | Complete   | 2026-03-21 |
| 3. GitHub Actions Pipeline | 1/3 | In Progress | - |
| 4. First Topics (CO2, Temp, Quakes, Pop, Conflicts) | 0/3 | Not started | - |
| 5. Environment & Forests Topics | 2/3 | In Progress|  |
| 6. Society & Economy Core | 3/3 | Complete   | 2026-03-21 |
| 7. Economy, Progress & Weather | 1/3 | In Progress|  |
| 8. Remaining Topics | 3/4 | Gap closure | - |
| 9. Main Page Clickable Data Points | 2/2 | Complete | 2026-03-21 |
| 10. New Acts & Bio/Ocean Topics | 3/3 | Complete    | 2026-03-21 |
