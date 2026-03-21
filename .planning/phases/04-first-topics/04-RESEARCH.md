# Phase 4: First Topics -- CO2, Temperature, Earthquakes, Population, Conflicts - Research

**Researched:** 2026-03-21
**Domain:** Topic module implementation, data API integration, Chart.js chart types, SVG interactive maps, real-time data visualization
**Confidence:** HIGH

## Summary

Phase 4 implements the first five topic modules that prove the detail page pattern works end-to-end across different data sources, chart types, and content structures. Each module is a standalone ESM file placed at `detail/topics/{topic}.js` that exports the established contract: `{ meta, render(blocks), getChartConfigs(), cleanup() }`. The modules render into the 7-block layout (hero, chart, trend, tiles, explanation, comparison, sources) built in Phase 2, using the data-loader 3-tier fallback (live -> cache -> static) from Phase 1, and the Chart.js CDN loader + instance registry from Phase 1.

The five topics span three categories (environment, society, realtime) and require four distinct visualization approaches: time-series line charts (CO2 Keeling Curve, population trend), warming stripes with tooltips (temperature), interactive SVG point maps (earthquakes, conflicts), bar/histogram charts (earthquake magnitudes), doughnut charts (refugees), and data-driven counters (population live counter, births/deaths clock). All chart rendering uses the `chart-manager.js` system: `ensureChartJs()` before creation, `createChart(canvasId, config)` for tracked instances, `destroyAllCharts()` in cleanup. Non-Chart.js visualizations (warming stripes, SVG maps, counters) use direct DOM construction via `DOMUtils.create()` and `DOMUtils.createSVG()`.

Critical finding: the conflicts cache contains only a static fallback with an aggregate count (UCDP API requires token since Feb 2026). The conflicts and temperature topics will need hardcoded historical data arrays embedded in the topic module, supplemented by cached and live data where available. The population cache has rich World Bank time-series data. The CO2 cache has 800+ monthly records for the Keeling Curve. Earthquakes have no pre-cached data but the USGS GeoJSON feeds are CORS-friendly and can be fetched live in the browser.

**Primary recommendation:** Build each topic module as an independent file following the _stub.js contract pattern. Use Chart.js for all standard charts (line, bar, doughnut), the existing `Charts.warmingStripes()` pattern adapted for detail pages for temperature stripes, and inline SVG with `DOMUtils.createSVG()` for earthquake/conflict point maps. Each module handles its own data fetching via the shared `fetchTopicData()` helper plus any additional live API calls needed.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENV-01 | Topic co2 -- Hero: current ppm (Open-Meteo), Keeling Curve 1958-today, emissions by country (World Bank), greenhouse effect infographic | Open-Meteo Air Quality API provides CO2 ppm at surface level. Cache has 800+ monthly records from NOAA Mauna Loa. World Bank EN.ATM.CO2E.PC for emissions by country. Chart.js line chart for Keeling Curve, bar chart for country breakdown, DOM-based infographic |
| ENV-02 | Topic temperature -- Hero: anomaly (NASA GISTEMP), interactive warming stripes with event tooltips, regional warming SVG choropleth, 9 tipping points timeline | NASA GISTEMP CSV data already collected by collect-data.js. Existing Charts.warmingStripes() pattern available. MathUtils.tempToColor() for stripe coloring. Maps._colorSVG() pattern for choropleth. Tipping points are editorial content (hardcoded data) |
| SOC-01 | Topic population -- Hero: live counter, births/deaths clock, population pyramid toggle, urbanization chart | Cache has 59-year World Bank total population + urban % arrays. Counter class exists in visualizations/counters.js. Live counter calculated from growth rate. Pyramid data requires hardcoded age-bracket arrays for 1960/2000/2026/2050. Chart.js horizontal bar for pyramid, line chart for urbanization |
| SOC-02 | Topic conflicts -- Hero: active conflicts, SVG conflict map with intensity dots, historical trend 1946-today, refugees doughnut | Cache has static fallback (56 active conflicts, UCDP). Maps.conflictsLayer() has CONFLICT_COUNTRIES data with intensity values. Historical trend 1946-today must be hardcoded array (UCDP dataset). UNHCR API is open (no auth) for displaced persons data. Chart.js doughnut for refugees |
| RT-01 | Topic earthquakes -- Interactive SVG map (USGS 24h, magnitude=size, depth=color, click popup), 7-day magnitude histogram | USGS GeoJSON feeds are CORS-friendly, no auth needed. 2.5_day.geojson and 2.5_week.geojson for 24h and 7-day data. MathUtils.geoToSVG() for lat/lng projection. DOMUtils.createSVG() for dots. Chart.js bar chart for magnitude histogram. fetchWithTimeout() for live data |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.1 | Line, bar, doughnut charts | Already integrated via chart-manager.js CDN loader, dark defaults applied |
| Vanilla JS (ESM) | ES2022+ | All module logic | Project convention, no build step, GitHub Pages deployment |
| CSS Custom Properties | N/A | Design tokens | Established in core.css, all components use var(--*) references |

### Supporting (Already Available in Project)
| Module | Path | Purpose | Used By |
|--------|------|---------|---------|
| `data-loader.js` | `js/utils/data-loader.js` | 3-tier fetch (live -> cache -> static) | All topic modules for data retrieval |
| `chart-manager.js` | `js/utils/chart-manager.js` | Chart.js CDN load, instance registry | All chart-bearing topic modules |
| `badge.js` | `js/utils/badge.js` | Data tier badge (LIVE/Cache/Static) | Hero blocks showing data freshness |
| `dom.js` | `js/utils/dom.js` | DOM/SVG creation, throttle, observe | All topic modules for DOM construction |
| `math.js` | `js/utils/math.js` | tempToColor, geoToSVG, formatCompact, escapeHTML | Temperature stripes, earthquake map, number formatting |
| `i18n.js` | `js/i18n.js` | DE/EN translations | All text content |
| `charts.js` | `js/visualizations/charts.js` | Warming stripes, SVG line/bar charts | Temperature stripes pattern reference |
| `maps.js` | `js/visualizations/maps.js` | SVG coloring, overlays, legends, tooltips | Conflict map pattern reference |
| `counters.js` | `js/visualizations/counters.js` | Animated number counters | Population live counter |

### External APIs (Browser-Fetched, No Auth)
| API | Endpoint | Purpose | CORS | Fallback |
|-----|----------|---------|------|----------|
| Open-Meteo Air Quality | `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=19.5&longitude=-155.6&current=carbon_dioxide` | Current CO2 ppm (Mauna Loa proxy) | Yes | Cache co2-history.json latest value |
| USGS Earthquake | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` | 24h M2.5+ earthquakes | Yes | Static fallback |
| USGS Earthquake 7d | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson` | 7-day M2.5+ for histogram | Yes | Static fallback |
| World Bank CO2 | `https://api.worldbank.org/v2/country/USA;CHN;IND;RUS;JPN;DEU;KOR;IRN;SAU;IDN/indicator/EN.ATM.CO2E.PC?format=json&per_page=100&date=2020` | Top emitters per capita | Yes | Hardcoded array |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js for all charts | Existing SVG Charts class | SVG Charts class is main-page-specific, lacks interactivity (tooltips, hover). Chart.js is already loaded for detail pages |
| Chart.js bar for pyramid | Custom SVG horizontal bars | Chart.js horizontal bar chart is simpler and consistent with other charts |
| SVG inline map for earthquakes | Load world.svg | world.svg is designed for country coloring. Earthquake dots on equirectangular projection are simpler as pure SVG circles |
| UNHCR API for refugee doughnut | Hardcoded recent UNHCR numbers | API is open but may add latency. Use hardcoded with cache fallback for reliability |

## Architecture Patterns

### Recommended Project Structure
```
detail/topics/
  co2.js              # ENV-01: CO2 topic module
  temperature.js      # ENV-02: Temperature topic module
  earthquakes.js      # RT-01: Earthquakes topic module
  population.js       # SOC-01: Population topic module
  conflicts.js        # SOC-02: Conflicts topic module
  _stub.js            # (existing) Contract reference
js/i18n.js            # Add topic-specific translation keys
data/fallback/
  static-values.json  # Already has fallback data for all 5 topics
```

### Pattern 1: Topic Module Contract
**What:** Every topic module exports `{ meta, render(blocks), getChartConfigs(), cleanup() }`
**When to use:** Every topic file MUST follow this pattern
**Example:**
```javascript
// Source: detail/topics/_stub.js (established in Phase 2)
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

export const meta = {
  id: 'co2',
  titleKey: 'detail.co2.title',    // i18n key
  category: 'environment',          // matches CHART_COLORS key
  icon: '',
};

let _intervals = [];  // track setInterval IDs for cleanup

export async function render(blocks) {
  // 1. Fetch data via 3-tier fallback
  const { data, tier, age } = await fetchTopicData('co2-history');
  // 2. Render into blocks.hero, blocks.chart, blocks.trend, etc.
  // 3. Use DOMUtils.create() for all DOM elements
  // 4. Use ensureChartJs() + createChart() for Chart.js charts
}

export function getChartConfigs() {
  // Return lazy-load chart configs for IntersectionObserver
  return [
    { canvasId: 'co2-keeling-canvas', config: { /* Chart.js config */ }, blockId: 'detail-chart' },
  ];
}

export function cleanup() {
  _intervals.forEach(clearInterval);
  _intervals = [];
  // Chart instances destroyed by detail-app.js via destroyAllCharts()
}
```

### Pattern 2: Data Fetching Strategy Per Topic
**What:** Each topic uses fetchTopicData() as primary, plus optional additional live API calls
**When to use:** Every render() function

| Topic | Primary Data | Additional Live Calls | Fallback Chain |
|-------|-------------|----------------------|----------------|
| co2 | `fetchTopicData('co2-history')` | Open-Meteo Air Quality (current ppm) | cache -> static (427.5 ppm) |
| temperature | `fetchTopicData('temperature', 'https://data.giss.nasa.gov/...')` | None (CSV parsed by collect-data) | cache (via world-state.json) -> static |
| earthquakes | None (no cache file) | USGS 2.5_day.geojson + 2.5_week.geojson live | Static fallback (4 significant) |
| population | `fetchTopicData('population')` | None (World Bank cached) | cache -> static (8.1B) |
| conflicts | `fetchTopicData('conflicts')` | None (UCDP requires token) | cache (static fallback) -> static (56 active) |

### Pattern 3: Chart.js Lazy Loading via getChartConfigs()
**What:** Topic modules return chart configs; detail-app.js loads them via IntersectionObserver
**When to use:** All Chart.js charts that are below the fold
**Example:**
```javascript
export function getChartConfigs() {
  return [
    {
      canvasId: 'co2-keeling-canvas',
      config: {
        type: 'line',
        data: { /* ... */ },
        options: { /* ... */ }
      },
      blockId: 'detail-chart'
    }
  ];
}
```
**Important:** Charts in the hero block should be rendered directly in render() (above fold, no lazy load needed). Charts in trend/comparison blocks benefit from lazy loading.

### Pattern 4: SVG Point Map (Earthquakes, Conflicts)
**What:** Inline SVG with equirectangular projection for plotting lat/lng points
**When to use:** When showing geographic point data (not country-level choropleth)
**Example:**
```javascript
// Use MathUtils.geoToSVG(lat, lng, width, height) for projection
const { x, y } = MathUtils.geoToSVG(quake.lat, quake.lng, 900, 450);
const circle = DOMUtils.createSVG('circle', {
  cx: x, cy: y,
  r: magnitudeToRadius(quake.magnitude),
  fill: depthToColor(quake.depth),
  opacity: '0.7',
  'data-info': JSON.stringify(quake)
});
```

### Pattern 5: Time Range Selector Integration
**What:** Topic modules listen for `timerangechange` CustomEvent on the trend block
**When to use:** Historical trend charts that support 1Y/5Y/20Y/Max filtering
**Example:**
```javascript
// Inside render():
const trendBlock = blocks.trend;
trendBlock.addEventListener('timerangechange', (e) => {
  const range = e.detail.range; // '1y', '5y', '20y', 'max'
  const filtered = filterDataByRange(allData, range);
  updateTrendChart(filtered);
});
```

### Pattern 6: Hardcoded Historical Data
**What:** Embed historical data arrays directly in topic modules when no API exists
**When to use:** Conflicts trend (1946-today), tipping points, population pyramids
**Rationale:** UCDP API requires token, pyramid age-bracket data is not in World Bank cache, tipping point thresholds are editorial. Hardcoded data with source attribution in comments.

### Anti-Patterns to Avoid
- **Loading Chart.js in render():** WRONG. Use `getChartConfigs()` for lazy loading, or call `await ensureChartJs()` at the START of render() if charts are needed immediately
- **Creating charts without canvasId tracking:** All charts MUST use `createChart(canvasId, config)` -- never `new Chart()` directly -- to enable proper cleanup
- **Setting innerHTML with unsanitized data:** Use `DOMUtils.create()` + `textContent` or `MathUtils.escapeHTML()` for any data-derived text
- **Forgetting cleanup:** Every setInterval, event listener added in render() must be cleared in cleanup(). Topic modules track their own intervals/listeners
- **Fetching in getChartConfigs():** This function is called synchronously for lazy-load setup. Data must already be fetched in render() and chart configs built from that data
- **Using Charts.lineChart() from main page:** The main page Charts class renders SVG-based charts. Detail pages use Chart.js via chart-manager.js. Do NOT mix these approaches

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching with fallback | Custom fetch + error handling | `fetchTopicData(topic, apiUrl)` | Already handles 3-tier fallback, timeout, cache age |
| Chart creation + cleanup | `new Chart()` directly | `createChart(canvasId, config)` | Registry tracks instances, prevents canvas memory leaks |
| Chart.js CDN loading | `<script>` injection | `ensureChartJs()` | Singleton promise prevents duplicate loads |
| Data tier badge | Custom badge HTML | `createTierBadge(tier, { age })` | Consistent LIVE/Cache/Static styling with i18n |
| SVG element creation | `document.createElement('circle')` | `DOMUtils.createSVG(tag, attrs)` | Uses correct SVG namespace (createElementNS) |
| Number formatting | Custom toLocaleString() | `MathUtils.formatCompact(num)` | Handles Mio/Mrd/Bio with i18n suffixes |
| Geo projection | Custom mercator/robinson | `MathUtils.geoToSVG(lat, lng, w, h)` | Simple equirectangular projection, matches world.svg |
| Temperature stripe colors | Custom color scale | `MathUtils.tempToColor(anomaly)` | 9-step blue-to-red scale, established in main page |
| HTML escaping | String replace | `MathUtils.escapeHTML(str)` | Prevents XSS from API data in tooltips |
| Animated counters | requestAnimationFrame loop | `Counter` class from counters.js | Handles easing, locale formatting, completion callback |

## Common Pitfalls

### Pitfall 1: Chart Canvas Not Found
**What goes wrong:** `createChart()` returns null, chart doesn't render
**Why it happens:** Topic module creates canvas elements in render() but getChartConfigs() references canvasId before DOM is ready
**How to avoid:** Create canvas elements in render() FIRST, return configs from getChartConfigs() AFTER render completes. The detail-app.js calls render() before getChartConfigs(), so canvases exist by the time lazy loading triggers
**Warning signs:** Console warning "[ChartManager] Canvas not found: co2-keeling-canvas"

### Pitfall 2: Relative URL Paths from detail/ Subdirectory
**What goes wrong:** `fetch('data/cache/co2-history.json')` fails with 404
**Why it happens:** detail/index.html is in a subdirectory. Relative URLs resolve from /detail/ not from root
**How to avoid:** The data-loader.js already uses `data/cache/${topic}.json` but this resolves relative to the HTML page. Use `../data/cache/` prefix OR handle in fetchTopicData. **Check:** the existing data-loader uses relative paths that work from the root. From detail/, the path needs `../` prefix.
**Warning signs:** 404 errors for cache files in browser console
**CRITICAL:** Verify the data-loader fetch paths work from the detail/ subdirectory. The `fetchTopicData()` function uses `data/cache/${topic}.json` which resolves to `detail/data/cache/` from the detail page. This needs `../data/cache/` instead. If this was not addressed in Phase 2, it must be handled per-module or by updating the data-loader with a base path parameter.

### Pitfall 3: Memory Leaks from setInterval in Population Counter
**What goes wrong:** Counter keeps incrementing after navigating away from population page
**Why it happens:** setInterval not cleared in cleanup()
**How to avoid:** Track all interval IDs in module-level array, clear them all in cleanup()
**Warning signs:** Increasing memory usage, console logs from old topic module

### Pitfall 4: CORS Failures on Live API Calls
**What goes wrong:** NASA GISTEMP CSV, USGS GeoJSON, or Open-Meteo fails in browser
**Why it happens:** Some APIs that work server-side (collect-data.js / Node) may have different CORS headers for browser requests
**How to avoid:** Always have cache/static fallback. USGS feeds are confirmed CORS-friendly. Open-Meteo is CORS-friendly. NASA GISTEMP CSV may NOT be CORS-friendly from browser -- use cached data via world-state.json instead
**Warning signs:** "Access-Control-Allow-Origin" errors in browser console

### Pitfall 5: Chart.js Not Loaded When Rendering
**What goes wrong:** `Chart is not defined` error
**Why it happens:** Calling createChart() before ensureChartJs() completes
**How to avoid:** Either use getChartConfigs() (detail-app.js handles ensureChartJs + createChart), or explicitly `await ensureChartJs()` at the top of render() if building charts inline
**Warning signs:** ReferenceError in console

### Pitfall 6: i18n Keys Not Added
**What goes wrong:** UI shows raw i18n keys like "detail.co2.title" instead of translated text
**Why it happens:** New translation keys not added to i18n.js DE and EN objects
**How to avoid:** Add all topic-specific keys to both language objects in i18n.js before testing. Each topic needs ~15-25 translation keys (title, hero label, chart titles, explanation text, source names, comparison labels, etc.)
**Warning signs:** Text showing as dot-notation keys

### Pitfall 7: SVG Map Aspect Ratio and Responsiveness
**What goes wrong:** Earthquake/conflict dots appear at wrong positions on mobile
**Why it happens:** SVG viewBox dimensions don't match the width/height used in geoToSVG()
**How to avoid:** Set SVG viewBox="0 0 900 450" to match MathUtils.geoToSVG default (900x450). Use CSS `width: 100%; height: auto;` for responsive scaling. The dots' positions are relative to viewBox, not pixel dimensions
**Warning signs:** Points clustered in wrong area of map

### Pitfall 8: Large Data Arrays Blocking Render
**What goes wrong:** Page appears frozen while processing 800+ CO2 data points
**Why it happens:** Synchronous array processing blocks the main thread
**How to avoid:** CO2 monthly data (800 records) and population data (59 records) are small enough for synchronous processing. For warming stripes (144 years), use DocumentFragment batching as the existing Charts.warmingStripes() does
**Warning signs:** Janky scrolling during initial render

## Code Examples

### Example 1: Topic Module Skeleton (All Topics Follow This)
```javascript
// Source: established pattern from detail/topics/_stub.js
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

export const meta = {
  id: 'topicname',
  titleKey: 'detail.topicname.title',
  category: 'environment', // or 'society', 'realtime'
  icon: '',
};

// Module-level state for cleanup
let _intervals = [];
let _chartData = null;

export async function render(blocks) {
  const { data, tier, age } = await fetchTopicData('topicname');
  _chartData = data;

  // Hero block
  const badge = createTierBadge(tier, { age });
  blocks.hero.appendChild(
    DOMUtils.create('div', { className: 'topic-hero' }, [
      badge,
      DOMUtils.create('h1', { textContent: i18n.t('detail.topicname.heroValue') }),
    ])
  );

  // ... render other blocks
}

export function getChartConfigs() {
  if (!_chartData) return [];
  return [
    {
      canvasId: 'topicname-main-canvas',
      config: buildChartConfig(_chartData),
      blockId: 'detail-chart',
    }
  ];
}

export function cleanup() {
  _intervals.forEach(clearInterval);
  _intervals = [];
  _chartData = null;
}
```

### Example 2: Chart.js Line Chart Config (Keeling Curve)
```javascript
// Source: Chart.js 4.x docs - line chart configuration
function buildKeelingCurveConfig(monthly) {
  const color = CHART_COLORS.environment;
  return {
    type: 'line',
    data: {
      labels: monthly.map(d => `${d.year}-${String(d.month).padStart(2, '0')}`),
      datasets: [{
        label: 'CO2 (ppm)',
        data: monthly.map(d => d.value),
        borderColor: toRgba(color, 1),
        backgroundColor: toRgba(color, 0.1),
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.1,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          type: 'category',
          ticks: { maxTicksAuto: true, maxRotation: 0, autoSkipPadding: 40 }
        },
        y: {
          title: { display: true, text: 'ppm' },
          beginAtZero: false
        }
      }
    }
  };
}
```

### Example 3: Chart.js Doughnut Config (Refugees)
```javascript
// Source: Chart.js 4.x docs - doughnut chart configuration
function buildRefugeeDoughnutConfig() {
  return {
    type: 'doughnut',
    data: {
      labels: [
        i18n.t('detail.conflicts.refugees'),
        i18n.t('detail.conflicts.idps'),
        i18n.t('detail.conflicts.asylumSeekers')
      ],
      datasets: [{
        data: [37.6, 68.3, 6.9],  // UNHCR 2024 mid-year (millions)
        backgroundColor: [
          toRgba(CHART_COLORS.crisis, 0.8),
          toRgba(CHART_COLORS.society, 0.8),
          toRgba(CHART_COLORS.economy, 0.8),
        ],
        borderColor: 'rgba(10, 10, 15, 0.8)',
        borderWidth: 2,
      }]
    },
    options: {
      cutout: '55%',
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  };
}
```

### Example 4: Chart.js Bar Chart (Earthquake Histogram)
```javascript
// Source: Chart.js 4.x docs - bar chart configuration
function buildMagnitudeHistogramConfig(quakes) {
  const bins = [
    { label: '2.5-3.0', min: 2.5, max: 3.0, count: 0 },
    { label: '3.0-4.0', min: 3.0, max: 4.0, count: 0 },
    { label: '4.0-5.0', min: 4.0, max: 5.0, count: 0 },
    { label: '5.0-6.0', min: 5.0, max: 6.0, count: 0 },
    { label: '6.0+',    min: 6.0, max: 99,  count: 0 },
  ];
  quakes.forEach(q => {
    const bin = bins.find(b => q.magnitude >= b.min && q.magnitude < b.max);
    if (bin) bin.count++;
  });
  const color = CHART_COLORS.realtime;
  return {
    type: 'bar',
    data: {
      labels: bins.map(b => b.label),
      datasets: [{
        label: i18n.t('detail.earthquakes.count'),
        data: bins.map(b => b.count),
        backgroundColor: toRgba(color, 0.7),
        borderColor: toRgba(color, 1),
        borderWidth: 1,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  };
}
```

### Example 5: SVG Earthquake Map with Click Popup
```javascript
// Source: existing MathUtils.geoToSVG and DOMUtils.createSVG patterns
function buildEarthquakeMap(container, quakes) {
  const W = 900, H = 450;
  const svg = DOMUtils.createSVG('svg', {
    viewBox: `0 0 ${W} ${H}`,
    style: 'width:100%;height:auto;background:rgba(0,0,0,0.3);border-radius:12px;'
  });

  // Simple land outline (or use world.svg paths inline)
  // ... add landmass paths ...

  quakes.forEach(q => {
    const { x, y } = MathUtils.geoToSVG(q.lat, q.lng, W, H);
    const r = MathUtils.remap(q.magnitude, 2.5, 8, 3, 16);
    const color = depthToColor(q.depth);
    const circle = DOMUtils.createSVG('circle', {
      cx: x, cy: y, r: r,
      fill: color, opacity: '0.7',
      stroke: color, 'stroke-width': '0.5',
      style: 'cursor:pointer;'
    });
    circle.addEventListener('click', () => showPopup(container, q, x, y));
    svg.appendChild(circle);
  });

  container.appendChild(svg);
}

function depthToColor(depth) {
  if (depth < 10) return '#ff3b30';   // Shallow - red
  if (depth < 70) return '#ff9500';   // Medium - orange
  if (depth < 300) return '#ffcc00';  // Deep - yellow
  return '#34c759';                    // Very deep - green
}
```

### Example 6: Population Live Counter
```javascript
// Source: existing Counter class from visualizations/counters.js pattern
function startLiveCounter(element, currentPop, growthRate) {
  // UN estimates ~4.3 births/sec, ~1.8 deaths/sec globally -> ~2.5 net/sec
  const perSecond = (currentPop * (growthRate / 100)) / (365.25 * 24 * 3600);
  const startTime = Date.now();

  const update = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const current = currentPop + Math.round(elapsed * perSecond);
    element.textContent = MathUtils.formatNumber(current);
  };

  update();
  const id = setInterval(update, 1000);
  return id;  // caller stores for cleanup
}
```

### Example 7: Chart.js Horizontal Bar (Population Pyramid)
```javascript
// Source: Chart.js 4.x docs - horizontal bar chart with indexAxis: 'y'
function buildPyramidConfig(maleData, femaleData, ageLabels) {
  return {
    type: 'bar',
    data: {
      labels: ageLabels, // ['0-4', '5-9', '10-14', ..., '80+']
      datasets: [
        {
          label: i18n.t('detail.population.male'),
          data: maleData.map(v => -v), // negative for left side
          backgroundColor: toRgba(CHART_COLORS.progress, 0.7),
        },
        {
          label: i18n.t('detail.population.female'),
          data: femaleData,
          backgroundColor: toRgba(CHART_COLORS.society, 0.7),
        }
      ]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Math.abs(ctx.raw);
              return `${ctx.dataset.label}: ${MathUtils.formatCompact(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => MathUtils.formatCompact(Math.abs(v)) }
        }
      }
    }
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG-based charts on main page | Chart.js on detail pages | Phase 1-2 design | Topic modules use Chart.js exclusively; SVG charts stay on main page only |
| Direct `new Chart()` | `createChart(canvasId, config)` via registry | Phase 1 | All chart instances are tracked and destroyed on cleanup |
| UCDP API for live conflict data | Static fallback (token required) | Feb 2026 | Conflicts topic uses hardcoded data supplemented by cache |
| OpenAQ for air quality | Open-Meteo Air Quality API | Jan 2025 | CO2 ppm available via Open-Meteo instead |

**Key constraints documented in project decisions:**
- D3.js/Leaflet/Mapbox are out of scope (too heavy). Use SVG inline maps only
- No external icon dependencies (inline SVG icons)
- No framework or bundler -- vanilla ESM only
- `type: "module"` in package.json means ESM imports everywhere

## Open Questions

1. **Data-loader relative path from detail/ subdirectory**
   - What we know: `fetchTopicData()` uses `fetch('data/cache/${topic}.json')` which is a relative URL
   - What's unclear: From `detail/index.html`, this resolves to `detail/data/cache/` which does not exist. The cache files are at root `data/cache/`
   - Recommendation: Each topic module should use `fetchTopicData()` but verify the path resolution works. If not, topic modules can call `fetchWithTimeout('../data/cache/co2-history.json')` directly, or the data-loader needs a base-path parameter. Check Phase 2 code to see if this was addressed. If it was tested with _stub.js (which does not fetch data), it may be an untested path.

2. **Population pyramid age-bracket data**
   - What we know: World Bank cache has total population and urban % time series. No age-bracket breakdown in cache.
   - What's unclear: Whether to embed full pyramid data for 4 years (1960/2000/2026/2050) or fetch from World Bank on demand
   - Recommendation: Embed hardcoded arrays in the topic module. Population pyramid data by age/sex bracket is available from UN DESA Population Division but the API is complex. Hardcoded data from published UN sources is simpler and more reliable. Each pyramid needs ~17 age brackets x 2 genders = 34 values per year, x 4 years = 136 values total. This is manageable as inline data.

3. **Warming stripes interactive tooltips**
   - What we know: Existing Charts.warmingStripes() creates CSS div-based stripes with `title` attributes for native browser tooltips
   - What's unclear: Whether the requirement "interactive warming stripes with event tooltips" means custom tooltip popups or native title is sufficient
   - Recommendation: Use the existing div-stripe pattern with enhanced click/hover to show a custom positioned tooltip div (matching glass-morphism style) that can include event annotations (e.g., "Paris Agreement signed") for specific years

4. **CORS for NASA GISTEMP CSV**
   - What we know: collect-data.js fetches NASA CSV server-side (Node). Browser CORS behavior may differ
   - What's unclear: Whether `data.giss.nasa.gov` sets CORS headers for browser fetch
   - Recommendation: Do NOT attempt browser-side NASA CSV fetch. Use cached temperature data from world-state.json or data/cache/ instead. The collect-data.js and process-data.js pipeline already processes this data server-side and stores it in world-state.json as `environment.temperatureAnomaly.history[]`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework detected in project) |
| Config file | none -- static site with no test runner |
| Quick run command | `Open detail/?topic=co2 in browser, verify all blocks render` |
| Full suite command | `Test all 5 topic URLs sequentially in browser` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENV-01 | CO2 page: hero ppm, Keeling Curve chart, emissions bar, infographic | manual | Open `detail/?topic=co2`, verify 4 visual elements | Wave 0: create co2.js |
| ENV-02 | Temperature page: anomaly hero, warming stripes, choropleth, tipping points | manual | Open `detail/?topic=temperature`, verify 4 visual elements | Wave 0: create temperature.js |
| SOC-01 | Population page: live counter, births/deaths, pyramid, urbanization | manual | Open `detail/?topic=population`, verify 4 visual elements | Wave 0: create population.js |
| SOC-02 | Conflicts page: active count, conflict map, trend chart, refugees doughnut | manual | Open `detail/?topic=conflicts`, verify 4 visual elements | Wave 0: create conflicts.js |
| RT-01 | Earthquakes page: SVG map with dots, click popup, magnitude histogram | manual | Open `detail/?topic=earthquakes`, verify map + histogram | Wave 0: create earthquakes.js |

### Sampling Rate
- **Per task commit:** Open the specific topic URL in browser, check console for errors, verify visual output
- **Per wave merge:** Test all 5 topic URLs, check i18n toggle (DE/EN), test time range selector, check mobile viewport
- **Phase gate:** All 5 topics render all blocks, no console errors, badges show correct tier, charts interactive

### Wave 0 Gaps
- [ ] `detail/topics/co2.js` -- ENV-01 topic module
- [ ] `detail/topics/temperature.js` -- ENV-02 topic module
- [ ] `detail/topics/population.js` -- SOC-01 topic module
- [ ] `detail/topics/conflicts.js` -- SOC-02 topic module
- [ ] `detail/topics/earthquakes.js` -- RT-01 topic module
- [ ] `js/i18n.js` -- topic-specific translation keys for all 5 topics (~100 keys total)
- [ ] Verify data-loader path resolution from detail/ subdirectory

## Sources

### Primary (HIGH confidence)
- Project codebase: `detail/detail-app.js` - topic loading contract, lazy chart setup, time range dispatch
- Project codebase: `detail/topics/_stub.js` - reference implementation of topic module contract
- Project codebase: `js/utils/data-loader.js` - fetchTopicData() 3-tier fallback pattern
- Project codebase: `js/utils/chart-manager.js` - ensureChartJs(), createChart(), CHART_COLORS
- Project codebase: `js/utils/dom.js` - DOMUtils.create(), createSVG(), observe()
- Project codebase: `js/utils/math.js` - tempToColor(), geoToSVG(), formatCompact(), escapeHTML()
- Project codebase: `js/visualizations/charts.js` - Charts.warmingStripes() reference pattern
- Project codebase: `js/visualizations/maps.js` - Maps.conflictsLayer() with CONFLICT_COUNTRIES data
- Project codebase: `data/cache/co2-history.json` - 800+ monthly CO2 records from NOAA Mauna Loa
- Project codebase: `data/cache/population.json` - 59-year World Bank population + urban % series
- Project codebase: `data/cache/conflicts.json` - static fallback (56 active conflicts)
- Project codebase: `data/fallback/static-values.json` - fallback values for all 5 topics
- [USGS GeoJSON Feed Documentation](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) - Feed URLs and data format
- [Chart.js Doughnut and Pie Charts](https://www.chartjs.org/docs/latest/charts/doughnut.html) - Doughnut chart configuration
- [Chart.js Bar Charts](https://www.chartjs.org/docs/latest/charts/bar.html) - Bar chart, horizontal bar (indexAxis: 'y')

### Secondary (MEDIUM confidence)
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) - Confirmed CO2 ppm available as variable
- [World Bank API - CO2 Emissions](https://data.worldbank.org/indicator/EN.ATM.CO2E.PC) - EN.ATM.CO2E.PC indicator for per-capita emissions
- [UNHCR Refugee Statistics API](https://api.unhcr.org/docs/refugee-statistics.html) - Open API, no auth required, forcibly displaced persons data
- [UCDP Dataset Downloads](https://ucdp.uu.se/downloads/) - Historical conflict data 1946-present (token required for API since Feb 2026)

### Tertiary (LOW confidence)
- Open-Meteo CO2 accuracy: Open-Meteo Air Quality API provides surface-level CO2 which may differ from Mauna Loa observatory measurements. Needs browser testing to verify actual response format and value range

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, Chart.js 4.5.1 loaded and configured
- Architecture: HIGH - topic module contract proven via _stub.js, all utility functions inspected
- Pitfalls: HIGH - identified from direct codebase inspection and API documentation review
- Data availability: HIGH for CO2/population/earthquakes (rich cache + live APIs), MEDIUM for conflicts/temperature (limited cache, static fallback)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- APIs and project architecture established)
