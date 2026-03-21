# Requirements: World.One Detail Pages & Data Expansion

**Defined:** 2026-03-21
**Core Value:** Every number on the dashboard becomes explorable with live data, historical trends, and visual context -- no data point is ever invisible or broken.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: Central data-loader utility (utils/data-loader.js) with fetchWithTimeout (5s) and 3-tier fallback (live -> cache -> static)
- [x] **INFRA-02**: Badge renderer (utils/badge.js) -- LIVE pulsing red, Cache gray/orange (>24h), Static gray reference
- [x] **INFRA-03**: Static fallback values file (data/fallback/static-values.json) with value, year, source for every data point
- [x] **INFRA-04**: Chart.js 4.x loaded via CDN (jsDelivr primary, cdnjs fallback) with defer and global dark-theme defaults
- [x] **INFRA-05**: Chart instance registry with mandatory destroy() lifecycle to prevent canvas memory leaks
- [x] **INFRA-06**: Reusable SVG choropleth component extending existing maps.js for detail page use
- [x] **INFRA-07**: Service worker updated with versioned cache name and data/cache/ route handling

### Detail Page System

- [x] **DETAIL-01**: Single detail/index.html with URL parameter routing (?topic=co2)
- [x] **DETAIL-02**: Dynamic topic module loader via import() from detail/topics/{topic}.js
- [x] **DETAIL-03**: Topic module interface contract: { meta, render(), getChartConfigs(), cleanup() }
- [x] **DETAIL-04**: Base layout with 7 blocks: hero banner, primary chart, historical trend, context tiles, explanation, comparison, sources footer
- [x] **DETAIL-05**: Back navigation (fixed top-left), Back-to-Top button, breadcrumb trail
- [x] **DETAIL-06**: Web Share API integration with fallback to clipboard copy
- [x] **DETAIL-07**: Print-optimized CSS (@media print: white bg, black text, no animations)
- [x] **DETAIL-08**: Lazy-load charts via IntersectionObserver with CSS skeleton loaders
- [x] **DETAIL-09**: Error states with graceful degradation (never show blank space)
- [x] **DETAIL-10**: Full DE/EN i18n support using existing i18n.js system
- [x] **DETAIL-11**: Time range selector (1Y / 5Y / 20Y / Max) for historical trend charts
- [x] **DETAIL-12**: Consistent design language matching main page (glass-morphism, CSS variables, BEM)

### Main Page Extensions

- [x] **MAIN-01**: All data points, tiles, and chart sections become clickable -> detail/?topic={id}
- [x] **MAIN-02**: Hover state: +10% brightness, border glow, tooltip "Klicken fur Details ->"
- [x] **MAIN-03**: Act 12 "Das Schweigen der Arten" -- new scroll section with biodiversity tiles
- [x] **MAIN-04**: Act 13 "Die Ozeane" -- new scroll section with ocean tiles (temp, pH, plastic)
- [x] **MAIN-05**: New act sections link tiles to their respective detail pages

### GitHub Actions

- [x] **ACTIONS-01**: Extended workflow with staggered cron jobs (30min gaps) for new cache files
- [x] **ACTIONS-02**: Job: update-biodiversity (03:00 UTC) -> data/cache/biodiversity.json
- [x] **ACTIONS-03**: Job: update-environment-ext (03:30 UTC) -> co2-history.json, ocean.json, solar.json
- [x] **ACTIONS-04**: Job: update-society-ext (04:00 UTC) -> population.json, freedom.json, conflicts.json
- [x] **ACTIONS-05**: Job: update-economy-ext (04:30 UTC) -> currencies.json, inequality.json, poverty.json
- [x] **ACTIONS-06**: Job: update-progress-ext (05:00 UTC) -> arxiv-ai.json, space-news.json
- [x] **ACTIONS-07**: Job: update-disasters (05:30 UTC) -> disasters.json, hunger.json
- [x] **ACTIONS-08**: All jobs: timeout 10min, continue-on-error: true, never block deployment
- [x] **ACTIONS-09**: data/cache/meta.json with last_full_update, jobs_ok, jobs_failed, total_cache_files, total_data_points

### Environment Topics (Akt 02)

- [x] **ENV-01**: Topic co2 -- Hero: current ppm (Open-Meteo), Keeling Curve 1958-today, emissions by country (World Bank), greenhouse effect infographic
- [x] **ENV-02**: Topic temperature -- Hero: anomaly (NASA GISTEMP), interactive warming stripes with event tooltips, regional warming SVG choropleth, 9 tipping points timeline
- [x] **ENV-03**: Topic biodiversity -- Hero: threatened species (GBIF), Living Planet Index trend, IUCN category browser with CR species list
- [x] **ENV-04**: Topic airquality -- Hero: global AQI (OpenAQ), cities ranking, AQI vs GDP scatter, PM2.5/PM10/NO2 explainer
- [x] **ENV-05**: Topic forests -- Hero: forest cover % (World Bank), annual loss since 2000, deforestation causes (stacked bar chart)
- [x] **ENV-06**: Topic renewables -- Hero: renewable energy % (World Bank), live carbon intensity (Electricity Maps DE), country ranking, solar+wind growth curves

### Society Topics (Akt 03)

- [x] **SOC-01**: Topic population -- Hero: live counter (calculated), births/deaths clock, population pyramid (1960/2000/2026/2050 toggle, country comparison), urbanization chart
- [x] **SOC-02**: Topic conflicts -- Hero: active conflicts (UCDP cached), SVG conflict map with intensity dots, historical trend 1946-today with event markers, refugees/displaced doughnut chart
- [x] **SOC-03**: Topic health -- Hero: life expectancy (World Bank), causes of death treemap, health spending vs life expectancy scatter (bubble=population), vaccination choropleth
- [x] **SOC-04**: Topic freedom -- Hero: Freedom House score (cached), SVG choropleth (green/yellow/red), 18-year decline trend chart

### Economy Topics (Akt 04)

- [x] **ECON-01**: Topic inequality -- Hero: Gini index (World Bank), 100-person wealth distribution animation, country Gini ranking (toggle income/wealth), billionaire counter
- [x] **ECON-02**: Topic poverty -- Hero: extreme poverty % (World Bank $2.15/day), dramatic trend 38%->8% animated line, regional stacked area chart
- [x] **ECON-03**: Topic currencies -- Hero: key exchange rates (Open ER API), currency converter (client-side from cache), 12-month EUR/USD + USD/CNY charts, hyperinflation countries highlighted

### Progress Topics (Akt 05)

- [x] **PROG-01**: Topic science -- Hero: total arXiv papers, exponential growth curve animated, hot research fields bar chart (daily cached), Nobel prizes by country bubble chart
- [x] **PROG-02**: Topic internet -- Hero: internet users % (World Bank), real-time calculated counters (emails/YouTube/Google today), digital divide SVG choropleth
- [x] **PROG-03**: Topic space -- Hero: ISS position live (10s refresh), SVG map with moving ISS dot + orbit trail, crew list, spaceflight news feed (cached), satellite count visualization

### Realtime Topics (Akt 06)

- [x] **RT-01**: Topic earthquakes -- Extended: interactive SVG map (USGS 24h, magnitude=size, depth=color, click popup), 7-day magnitude histogram
- [x] **RT-02**: Topic weather -- Extended: 24 cities (all continents), hourly sparklines, extreme weather warnings (code>65 rain, >75 blizzard, >95 thunderstorm)
- [x] **RT-03**: Topic solar -- Hero: solar activity (NOAA), solar cycle 25 chart with sunspot count, aurora Kp-index map with visibility latitude
- [x] **RT-04**: Topic crypto_sentiment -- Extended: 30-day Fear & Greed history chart with color zones (red=fear, green=greed)

### Momentum Topics (Akt 07)

- [x] **MOM-01**: Topic momentum_detail -- All 20 indicators as mini-cards: value, trend arrow, % change, 10-year sparkline, improvement/stagnation/decline assessment, clickable to topic detail

### Crisis Topics (Akt 08)

- [x] **CRISIS-01**: Topic hunger -- Hero: hunger index (World Bank), SVG choropleth by malnutrition rate with click popups, FAO Food Price Index trend + correlation visualization
- [x] **CRISIS-02**: Topic disasters -- Hero: natural disasters 2026 (EM-DAT cached), chronological timeline with type/country/affected/damage, historical trend dual-axis chart (frequency + cost)

### Ocean Topics (Akt 13 -- New)

- [ ] **OCEAN-01**: Topic ocean_temp -- Hero: SST anomaly (NOAA cached), SVG heatmap choropleth, coral bleaching threshold explainer infographic
- [ ] **OCEAN-02**: Topic ocean_ph -- Hero: pH value (8.2->8.1 trend), pH scale visualization with ocean position, acidification impact infographic
- [ ] **OCEAN-03**: Topic ocean_plastic -- Hero: ocean plastic estimate (GESAMP cached), daily counter animated, 5 garbage patches SVG map, decomposition time animation (bottle: 450 years)

### Biodiversity Topics (Akt 12 -- New)

- [x] **BIO-01**: Topic extinction -- Species extinction rate detail with historical mass extinctions context
- [x] **BIO-02**: Topic endangered -- Endangered species by IUCN category with GBIF cached species lists

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Interactions

- **ADV-01**: Historical event annotations overlay on timeline charts (Paris Agreement, COVID, etc.)
- **ADV-02**: Before/after comparison sliders for temporal data (temperature, forests, inequality)
- **ADV-03**: Country drill-down on map click -> filter chart data to that country vs global average
- **ADV-04**: Data export CSV/PNG per chart (Chart.js toBase64Image + CSV generation)
- **ADV-05**: Automated trend narration ("CO2 has risen 2.4 ppm this year, continuing...")
- **ADV-06**: Keyboard shortcut navigation (J/K between charts, T toggle range, Esc back)
- **ADV-07**: Sparkline comparison rail showing related indicators at top of detail page
- **ADV-08**: Open Graph meta tags per topic for rich social preview cards

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Static site, no backend |
| Customizable dashboards | 10x complexity, editorial curation is the value |
| Real-time WebSocket streaming | GitHub Pages can't serve WebSockets |
| D3.js / Leaflet / Mapbox | Too heavy, existing SVG maps sufficient |
| Comments / user annotations | Requires moderation, backend, auth |
| AI chat / "Ask about this data" | Requires API keys, hallucination risk, contradicts manifesto |
| Push notifications | Requires backend service |
| Historical time-travel slider | Storage explosion for full snapshots |
| Custom chart theming | One branded dark theme; print CSS for light |
| Multi-axis comparison builder | Misleading correlations, analyst tool not public dashboard |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 5 | Complete |
| INFRA-07 | Phase 3 | Complete |
| DETAIL-01 | Phase 2 | Complete |
| DETAIL-02 | Phase 2 | Complete |
| DETAIL-03 | Phase 2 | Complete |
| DETAIL-04 | Phase 2 | Complete |
| DETAIL-05 | Phase 2 | Complete |
| DETAIL-06 | Phase 2 | Complete |
| DETAIL-07 | Phase 2 | Complete |
| DETAIL-08 | Phase 2 | Complete |
| DETAIL-09 | Phase 2 | Complete |
| DETAIL-10 | Phase 2 | Complete |
| DETAIL-11 | Phase 2 | Complete |
| DETAIL-12 | Phase 2 | Complete |
| ACTIONS-01 | Phase 3 | Complete |
| ACTIONS-02 | Phase 3 | Complete |
| ACTIONS-03 | Phase 3 | Complete |
| ACTIONS-04 | Phase 3 | Complete |
| ACTIONS-05 | Phase 3 | Complete |
| ACTIONS-06 | Phase 3 | Complete |
| ACTIONS-07 | Phase 3 | Complete |
| ACTIONS-08 | Phase 3 | Complete |
| ACTIONS-09 | Phase 3 | Complete |
| ENV-01 | Phase 4 | Complete |
| ENV-02 | Phase 4 | Complete |
| ENV-03 | Phase 5 | Complete |
| ENV-04 | Phase 5 | Complete |
| ENV-05 | Phase 5 | Complete |
| ENV-06 | Phase 5 | Complete |
| SOC-01 | Phase 4 | Complete |
| SOC-02 | Phase 4 | Complete |
| SOC-03 | Phase 6 | Complete |
| SOC-04 | Phase 6 | Complete |
| ECON-01 | Phase 6 | Complete |
| ECON-02 | Phase 6 | Complete |
| ECON-03 | Phase 7 | Complete |
| PROG-01 | Phase 7 | Complete |
| PROG-02 | Phase 7 | Complete |
| PROG-03 | Phase 7 | Complete |
| RT-01 | Phase 4 | Complete |
| RT-02 | Phase 7 | Complete |
| RT-03 | Phase 8 | Complete |
| RT-04 | Phase 8 | Complete |
| MOM-01 | Phase 8 | Complete |
| CRISIS-01 | Phase 8 | Complete |
| CRISIS-02 | Phase 8 | Complete |
| MAIN-01 | Phase 9 | Complete |
| MAIN-02 | Phase 9 | Complete |
| MAIN-03 | Phase 10 | Complete |
| MAIN-04 | Phase 10 | Complete |
| MAIN-05 | Phase 10 | Complete |
| OCEAN-01 | Phase 10 | Pending |
| OCEAN-02 | Phase 10 | Pending |
| OCEAN-03 | Phase 10 | Pending |
| BIO-01 | Phase 10 | Complete |
| BIO-02 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
