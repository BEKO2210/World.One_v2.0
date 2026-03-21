# Phase 8: Remaining Topics - Research

**Researched:** 2026-03-21
**Domain:** 5 topic modules -- solar activity, crypto sentiment, world momentum dashboard, hunger, disasters
**Confidence:** HIGH

## Summary

Phase 8 completes the remaining 5 topic modules to reach the full 28-topic set. All 5 topics follow the established module contract (`meta`, `render()`, `getChartConfigs()`, `cleanup()`) proven across 19 prior modules. The VALID_TOPICS allowlist in detail-app.js already includes all 5 topic IDs (`solar`, `crypto_sentiment`, `momentum_detail`, `hunger`, `disasters`). Cache pipeline scripts and JSON cache files already exist for solar, hunger, and disasters data.

The key technical considerations are: (1) NOAA SWPC JSON APIs for solar/Kp data are CORS-friendly and serve live data directly to browsers; (2) the Crypto Fear & Greed API (alternative.me) has no CORS headers, requiring cache-only data access; (3) the momentum detail page aggregates 20+ indicators from the existing world-state.json; (4) hunger/disasters both rely on cache data with static fallback (ReliefWeb API requires registered appname, FAO has no browser-friendly API).

**Primary recommendation:** Follow the Phase 4-7 proven pattern -- Plan 01 adds all i18n keys + static fallbacks + first topic, Plans 02-03 implement remaining topics in parallel. Use cache data via `fetchTopicData()` as primary source for all 5 topics (consistent with project's 3-tier fallback architecture). NOAA SWPC is the only API worth fetching live in-browser.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RT-03 | Solar topic -- hero solar activity, solar cycle 25 chart with sunspot count, aurora Kp-index map with visibility latitude bands | NOAA SWPC JSON APIs are CORS-friendly: `predicted-solar-cycle.json` (cache), `observed-solar-cycle-indices.json` (live), `planetary_k_index_1m.json` (live Kp), `ovation_aurora_latest.json` (aurora). SVG map with latitude bands for aurora visibility. |
| RT-04 | Crypto sentiment -- 30-day Fear & Greed history chart with color zones (red=fear, green=greed) | alternative.me API NOT CORS-friendly -- use cache only. Cache file not present; data available from collect-data.js pipeline (`crypto-fear-greed.json`). Hardcode 30-day history as fallback. Chart.js bar/line with per-point coloring (proven pattern from AQI scatter). |
| MOM-01 | Momentum detail -- all 20 indicators as mini-cards with value, trend arrow, % change, 10-year sparkline, improvement/stagnation/decline assessment | world-state.json `subScores` contains all indicators across 5 categories (~24 total). No new API needed. SVG sparklines (weather.js pattern). DOM-only mini-cards (inequality.js grid pattern). |
| CRISIS-01 | Hunger topic -- hunger index hero, SVG choropleth by malnutrition rate with click popups, FAO Food Price Index trend + correlation visualization | hunger.json cache has `undernourishment_trend` (2001-2023, 23 data points). Choropleth uses `detail/utils/choropleth.js`. FAO Food Price Index has no browser-friendly API -- hardcode historical data (pattern 6 from temperature.js). |
| CRISIS-02 | Disasters topic -- 2026 natural disaster timeline, historical trend dual-axis chart (frequency + economic cost) | disasters.json cache has 10 events (static fallback from ReliefWeb). Timeline is DOM-based (no chart needed). Historical trend dual-axis requires hardcoded EM-DAT data (no browser API). Chart.js with dual y-axes. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.1 | Line/bar charts (solar cycle, F&G, dual-axis) | CDN-loaded via ensureChartJs(), dark defaults pre-applied |
| DOMUtils | project | DOM creation (mini-cards, timelines, tiles) | Used by all 19 existing topic modules |
| fetchTopicData | project | 3-tier fallback data loading | Used by all topics needing cache data |
| choropleth.js | project | SVG world map with tooltips + legend | INFRA-06, proven in biodiversity/airquality/freedom/health |
| i18n.js | project | DE/EN translations | DETAIL-10 requirement, all topics use it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fetchWithTimeout | project | Live API calls with abort | Solar NOAA endpoints (8s timeout) |
| createTierBadge | project | LIVE/Cache/Static badge | Every topic hero block |
| CHART_COLORS | project | Category-keyed color palette | `realtime` for solar, `crisis` for hunger/disasters, `momentum` for momentum, `economy` for crypto |
| MathUtils.geoToSVG | project | Lat/lng to SVG coordinate mapping | Aurora Kp visibility latitude bands |
| toRgba | project | Color alpha conversion | Chart datasets, borders, accents |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded FAO data | Live FAO API | FAO has no CORS-friendly browser API; hardcoded is consistent with temperature.js/freedom.js pattern |
| Live crypto F&G fetch | Cache-only | alternative.me API lacks CORS headers; Chrome extensions use background scripts, not direct fetch |
| NOAA live observed-solar-cycle | Cache-only solar.json | SWPC JSON is CORS-friendly -- live fetch adds value for current sunspot count |

## Architecture Patterns

### Recommended Module Structure (per topic)
```
detail/topics/{topic}.js
  meta: { id, titleKey, category, icon }
  render(blocks): async -- fills hero/chart/trend/tiles/explanation/comparison/sources
  getChartConfigs(): returns [{canvasId, blockId, config}] for lazy Chart.js init
  cleanup(): clears intervals, nulls module state
```

### Pattern 1: Cache-First with Live Augmentation (solar)
**What:** Load cached solar cycle prediction from solar.json, then augment with live NOAA SWPC data (observed sunspots, current Kp index, aurora forecast).
**When to use:** When cache has historical data but live endpoints provide real-time value.
**Example:**
```javascript
// Cache: solar.json (predicted solar cycle, 36 months)
const { data: cacheData, tier, age } = await fetchTopicData('solar');

// Live augmentation: current observed data (CORS-friendly)
let liveKp = null;
try {
  const res = await fetchWithTimeout(
    'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', 8000
  );
  if (res.ok) {
    const kpData = await res.json();
    liveKp = kpData[kpData.length - 1]; // most recent entry
  }
} catch (_err) { /* fallback to cache-only */ }
```

### Pattern 2: Hardcoded Historical Dataset (hunger FAO, disasters EM-DAT)
**What:** Historical time-series data hardcoded as in-script arrays, following the proven Pattern 6 from temperature.js (145 GISTEMP entries), freedom.js (60 countries), conflicts.js (20 countries).
**When to use:** When authoritative historical data has no browser-friendly API, changes slowly (annually), and the dataset is manageable (<100 entries).
**Example:**
```javascript
// FAO Food Price Index (annual, 1990-2025)
const FAO_FOOD_PRICE_INDEX = [
  { year: 1990, value: 107.6 },
  { year: 1991, value: 105.0 },
  // ... ~35 entries
  { year: 2024, value: 122.2 },
];

// EM-DAT historical disaster trends (decade aggregates)
const DISASTER_TRENDS = [
  { decade: '1970s', count: 711, costB: 131 },
  { decade: '1980s', count: 1681, costB: 213 },
  // ... 6 entries
];
```

### Pattern 3: DOM Grid Cards (momentum mini-cards)
**What:** Pure DOM-based card grid with no Canvas/Chart.js, using CSS grid and inline SVG sparklines. Follows inequality.js wealth grid and weather.js city cards pattern.
**When to use:** When displaying 20+ small visual elements where Canvas instances would be excessive.
**Example:**
```javascript
// 20 indicator mini-cards in a responsive grid
const card = DOMUtils.create('div', {
  style: {
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '8px',
    borderLeft: `3px solid ${assessmentColor}`, // green/yellow/red
  },
}, [
  nameEl, valueEl, trendArrowEl, changeEl, sparklineSvg, assessmentBadge
]);
```

### Pattern 4: Color-Zoned Chart (crypto Fear & Greed)
**What:** Chart.js bar/line chart with per-point background color based on value thresholds. Proven in AQI scatter (green/yellow/orange/red) and poverty stacked area.
**When to use:** When data values map to semantic color zones.
**Example:**
```javascript
// F&G: 0-25 = Extreme Fear (red), 26-45 = Fear (orange),
//       46-55 = Neutral (yellow), 56-75 = Greed (light green), 76-100 = Extreme Greed (green)
backgroundColor: fgHistory.map(d => {
  if (d.value <= 25) return 'rgba(255, 59, 48, 0.7)';   // Extreme Fear
  if (d.value <= 45) return 'rgba(255, 149, 0, 0.7)';   // Fear
  if (d.value <= 55) return 'rgba(255, 204, 0, 0.7)';   // Neutral
  if (d.value <= 75) return 'rgba(52, 199, 89, 0.7)';   // Greed
  return 'rgba(0, 255, 127, 0.7)';                       // Extreme Greed
}),
```

### Pattern 5: Dual-Axis Chart (disasters trend)
**What:** Chart.js with two y-axes (left: frequency/count, right: economic cost in $B). Used for showing correlation between disaster frequency and economic impact.
**When to use:** When two related metrics with different units need to share a time axis.
**Example:**
```javascript
{
  type: 'bar',
  data: {
    labels: decades,
    datasets: [
      {
        label: 'Events',
        data: counts,
        yAxisID: 'y',
        backgroundColor: toRgba(CHART_COLORS.crisis, 0.5),
      },
      {
        type: 'line',
        label: 'Cost ($B)',
        data: costs,
        yAxisID: 'y1',
        borderColor: toRgba(CHART_COLORS.economy),
      },
    ],
  },
  options: {
    scales: {
      y: { position: 'left', title: { text: 'Number of events' } },
      y1: { position: 'right', grid: { drawOnChartArea: false }, title: { text: 'Cost ($ Billion)' } },
    },
  },
}
```

### Anti-Patterns to Avoid
- **Do NOT fetch alternative.me Crypto API in browser:** No CORS headers. Use cache data only via `fetchTopicData('crypto_sentiment')` -- there is no `crypto_sentiment.json` cache file yet, so the topic MUST either: (a) create a minimal cache script, or (b) use hardcoded 30-day data as static fallback. Recommendation: hardcode (matches Pattern 6 for datasets that change daily but topic only needs representative data).
- **Do NOT create 20 Chart.js canvas instances for momentum sparklines:** Use SVG polylines (weather.js pattern) to keep lightweight.
- **Do NOT try to fetch FAO Food Price Index live:** No browser-friendly API. Hardcode the annual series.
- **Do NOT fetch EM-DAT disaster data live:** EM-DAT requires registration. Use cache/static fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| World map coloring | Custom SVG map generator | `detail/utils/choropleth.js` | Already handles ISO-2 mapping, tooltips, legends, cleanup |
| Chart dark theme | Per-chart dark styling | `ensureChartJs()` auto-applies | Global dark defaults set once at load |
| Data fallback chain | Manual fetch/try/catch cascade | `fetchTopicData(topic, apiUrl?)` | 3-tier fallback with cache age tracking |
| Lat/lng to SVG coords | Custom projection math | `MathUtils.geoToSVG()` | Equirectangular projection already implemented |
| SVG sparklines | Canvas-based mini-charts | `DOMUtils.createSVG('polyline')` | Pattern proven in weather.js, no Canvas overhead |
| Trend assessment | Custom scoring algorithm | Extract from world-state.json `subScores.*.indicators[].trend` | Already computed by process-data.js |

**Key insight:** All 5 topics can be built entirely from existing utilities. No new utility code is needed. The only "new" patterns are dual-axis Chart.js config and aurora latitude bands on SVG map.

## Common Pitfalls

### Pitfall 1: Crypto Fear & Greed Cache File Missing
**What goes wrong:** `fetchTopicData('crypto_sentiment')` falls through to cache tier looking for `data/cache/crypto_sentiment.json` which does not exist. The collect-data.js saves to `economy/crypto-fear-greed.json` (raw data directory, not cache).
**Why it happens:** Cache pipeline scripts were written for different topics. No `cache-crypto-sentiment.js` was created.
**How to avoid:** Use hardcoded 30-day F&G data as static fallback (Pattern 6). The static-values.json has `"crypto_sentiment": null` -- this needs to be populated with a representative value. Alternatively, add a simple cache generation to an existing pipeline script.
**Warning signs:** Topic page shows "--" for all values with static badge.

### Pitfall 2: Solar Cache JSON Has PREDICTED Data Only
**What goes wrong:** The solar.json cache contains `solar_cycle[]` with `predicted_ssn` (future predictions from 2028-2030), NOT observed historical sunspot counts.
**Why it happens:** cache-environment-ext.js fetches `predicted-solar-cycle.json` which is forward-looking. The separate `observed-solar-cycle-indices.json` endpoint has actual historical data.
**How to avoid:** For the solar cycle 25 chart, fetch `observed-solar-cycle-indices.json` live from NOAA SWPC (it's CORS-friendly). Use cache predicted data to show the forecast envelope. Combine both for a complete picture.
**Warning signs:** Chart shows only future predicted values, no actual observed sunspot history.

### Pitfall 3: Momentum Indicators Array is Empty in world-state.json
**What goes wrong:** `subScores.momentum.indicators` is an empty array `[]` in the current world-state.json. The momentum score (71.4) and counts (15 positive, 6 negative, 21 total) exist, but the individual indicator breakdown is missing.
**Why it happens:** The momentum sub-score is computed from other category indicators by process-data.js, but the individual indicators are stored under the other 4 categories (environment, society, economy, progress).
**How to avoid:** Aggregate indicators from ALL 4 category subScores: `environment.indicators` (6) + `society.indicators` (7) + `economy.indicators` (5) + `progress.indicators` (6) = 24 indicators total. Each has `name`, `value`, `score`, `trend`, `source`.
**Warning signs:** Momentum detail page shows 0 indicators or crashes on empty array.

### Pitfall 4: Disaster Data Lacks Affected/Damage Numbers
**What goes wrong:** Requirement CRISIS-02 specifies timeline with "type/country/affected/damage" but the disasters.json cache only has `name`, `date`, `type`, `countries`, `status` -- no `affected` or `damage` fields.
**Why it happens:** The ReliefWeb API static fallback in cache-disasters.js was simplified. Even the live API version doesn't request these fields.
**How to avoid:** Hardcode affected population and damage estimates for the 10 disaster entries alongside the existing data. This is supplementary context data (like hardcoded GISTEMP anomalies). Source: EM-DAT/ReliefWeb annual reviews.
**Warning signs:** Timeline items show "N/A" for affected and damage columns.

### Pitfall 5: Aurora Kp-Index Map Projection
**What goes wrong:** Kp visibility latitude bands (Kp 5 = 50deg, Kp 7 = 40deg, Kp 9 = 30deg) need to be drawn on the simplified continent SVG map, but the earthquake/space map uses a 900x450 equirectangular projection.
**Why it happens:** Latitude bands are concentric circles on a globe but straight horizontal lines on equirectangular. This is actually simpler than expected.
**How to avoid:** Use `MathUtils.geoToSVG(latitude, 0, 900, 450)` to get the Y coordinate for each latitude band, then draw horizontal lines or filled rectangles. This is the simplest approach and matches the existing map projection.
**Warning signs:** Aurora bands at wrong latitudes if using raw pixel offsets instead of the geo-to-SVG conversion.

## Code Examples

### Topic Module Contract (all 5 topics follow this)
```javascript
// Source: detail/topics/weather.js, detail/topics/earthquakes.js (established pattern)
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

export const meta = { id: 'topicId', titleKey: 'detail.topicId.title', category: 'category', icon: '' };
export async function render(blocks) { /* fills hero, chart, trend, tiles, explanation, comparison, sources */ }
export function getChartConfigs() { return []; }
export function cleanup() { /* clear intervals, null state */ }
```

### SVG Sparkline for Momentum Mini-Cards
```javascript
// Source: detail/topics/weather.js _createSparkline() pattern
function _createSparkline(values, color, width = 80, height = 24) {
  const svg = DOMUtils.createSVG('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    height: String(height),
    style: 'display:block;',
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  svg.appendChild(DOMUtils.createSVG('polyline', {
    points, fill: 'none', stroke: color,
    'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  return svg;
}
```

### Aurora Kp Latitude Bands on SVG Map
```javascript
// Source: derived from earthquakes.js continent map + MathUtils.geoToSVG
// Kp -> approximate aurora visibility latitude (northern hemisphere)
const KP_BANDS = [
  { kp: 9, lat: 30, label: 'Kp 9 (30 N)', color: 'rgba(255, 0, 100, 0.15)' },
  { kp: 7, lat: 40, label: 'Kp 7 (40 N)', color: 'rgba(255, 100, 0, 0.12)' },
  { kp: 5, lat: 50, label: 'Kp 5 (50 N)', color: 'rgba(0, 255, 100, 0.10)' },
  { kp: 3, lat: 60, label: 'Kp 3 (60 N)', color: 'rgba(0, 100, 255, 0.08)' },
];
for (const band of KP_BANDS) {
  const { y: yNorth } = MathUtils.geoToSVG(band.lat, 0, 900, 450);
  const { y: ySouth } = MathUtils.geoToSVG(-band.lat, 0, 900, 450);
  // Northern band
  svg.appendChild(DOMUtils.createSVG('rect', {
    x: '0', y: String(yNorth - 5), width: '900', height: '10',
    fill: band.color, opacity: '0.5',
  }));
  // Southern band (mirror)
  svg.appendChild(DOMUtils.createSVG('rect', {
    x: '0', y: String(ySouth - 5), width: '900', height: '10',
    fill: band.color, opacity: '0.5',
  }));
}
```

### Choropleth Usage for Hunger (malnutrition rate)
```javascript
// Source: detail/utils/choropleth.js (proven in biodiversity, airquality, freedom, health)
import { renderChoropleth } from '../utils/choropleth.js';

const malnutritionMap = {
  'AF': 29.8, 'BD': 11.4, 'TD': 39.6, 'CD': 36.7,
  // ~50 countries with undernourishment %
};

function _malnutritionColor(value) {
  if (value > 35) return '#ff3b30';   // Severe
  if (value > 25) return '#ff9500';   // High
  if (value > 15) return '#ffcc00';   // Moderate
  if (value > 5)  return '#34c759';   // Low
  return '#5ac8fa';                    // Very low
}

await renderChoropleth(blocks.chart, {
  dataMap: malnutritionMap,
  colorFn: _malnutritionColor,
  tooltipFn: (iso, value) => `${iso}: ${value.toFixed(1)}% undernourished`,
  legendItems: [
    { color: '#ff3b30', label: '> 35%' },
    { color: '#ff9500', label: '25-35%' },
    { color: '#ffcc00', label: '15-25%' },
    { color: '#34c759', label: '5-15%' },
    { color: '#5ac8fa', label: '< 5%' },
  ],
  title: i18n.t('detail.hunger.mapTitle'),
});
```

## Data Source Analysis

### Per-Topic Data Sources

| Topic | Primary Source | Cache File | Live API | Fallback |
|-------|--------------|------------|----------|----------|
| solar | NOAA SWPC | data/cache/solar.json (predicted cycle) | `services.swpc.noaa.gov/json/observed-solar-cycle-indices.json` (CORS OK), `planetary_k_index_1m.json` (CORS OK) | Static fallback (null -- needs populating) |
| crypto_sentiment | alternative.me | NONE (no cache file exists) | NOT usable (no CORS) | Hardcode 30-day representative data |
| momentum_detail | world-state.json | data/processed/world-state.json | N/A (local file) | Aggregate from subScores.*.indicators |
| hunger | World Bank | data/cache/hunger.json (undernourishment 2001-2023) | N/A (cache-only) | Static fallback (null -- needs populating) |
| disasters | ReliefWeb/EM-DAT | data/cache/disasters.json (10 events, static fallback) | ReliefWeb requires appname (403) | Hardcode affected/damage + historical trends |

### NOAA SWPC API Endpoints (Solar Topic)

| Endpoint | Data | CORS | Update Freq | Size |
|----------|------|------|-------------|------|
| `/json/solar-cycle/predicted-solar-cycle.json` | Future SSN predictions (2028-2030) | YES | Monthly | ~6KB |
| `/json/solar-cycle/observed-solar-cycle-indices.json` | Historical observed SSN (1749-present) | YES | Monthly | ~120KB |
| `/json/planetary_k_index_1m.json` | Current planetary Kp index (6h) | YES | 1-minute | ~27KB |
| `/json/ovation_aurora_latest.json` | Aurora probability map | YES | ~30min | ~900KB (LARGE) |
| `/json/sunspot_report.json` | Daily sunspot report | YES | Daily | ~132KB |

**Recommendation for solar:** Use `observed-solar-cycle-indices.json` live (monthly, small) for the solar cycle 25 chart. Use `planetary_k_index_1m.json` live for current Kp. Do NOT fetch `ovation_aurora_latest.json` (900KB is excessive for a detail page); instead use the current Kp value to show static latitude bands.

### Static Fallback Values to Populate

Currently null in static-values.json:
- `solar`: needs `{ current_ssn: { value: 150, year: 2025, source: 'NOAA SWPC' }, kp_current: { value: 3, year: 2025, source: 'NOAA SWPC' } }`
- `crypto_sentiment`: needs `{ fear_greed: { value: 45, label: 'Fear', year: 2025, source: 'alternative.me' } }`
- `hunger`: needs `{ undernourishment_pct: { value: 8.5, year: 2023, source: 'FAO/World Bank' } }`
- `disasters`: needs `{ events_2024: { value: 10, year: 2024, source: 'EM-DAT/ReliefWeb' } }`
- `momentum_detail`: needs `{ total_indicators: { value: 24, year: 2025, source: 'World.One' }, positive_count: { value: 15, year: 2025, source: 'World.One' } }`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NOAA SWPC XML feeds | JSON endpoints at services.swpc.noaa.gov/json/ | 2018 | Direct browser fetch possible |
| Crypto F&G manual scraping | alternative.me JSON API | ~2020 | Simple REST endpoint (server-side) |
| EM-DAT download-only | ReliefWeb API v1 | ~2019 | API available but requires appname registration |
| FAO manual CSV | FAOSTAT API | ~2020 | API exists but no CORS; hardcode is reliable |

**Deprecated/outdated:**
- Nothing deprecated in this phase's domain. NOAA SWPC is actively maintained and expanding JSON offerings.

## i18n Key Pattern

Following established convention from Phases 4-7, keys for all 5 topics follow:

```
detail.{topicId}.title
detail.{topicId}.heroLabel
detail.{topicId}.heroUnit
detail.{topicId}.[sectionTitle]
detail.{topicId}.tile[Name]
detail.{topicId}.explanation
detail.{topicId}.comparison
detail.{topicId}.source[Name]
```

Categories for CHART_COLORS:
- `solar` -> `realtime` (same as earthquakes, weather)
- `crypto_sentiment` -> `economy` (same as currencies, inequality)
- `momentum_detail` -> `momentum` (dedicated color: `{ r: 90, g: 200, b: 250 }`)
- `hunger` -> `crisis` (dedicated color: `{ r: 255, g: 107, b: 107 }`)
- `disasters` -> `crisis` (same as hunger)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework) |
| Config file | none |
| Quick run command | Open `detail/?topic={id}` in browser |
| Full suite command | Visit all 5 topic URLs sequentially |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-03 | Solar hero + cycle 25 chart + Kp map | manual-only | Browse `detail/?topic=solar` | N/A -- no test infra |
| RT-04 | Crypto 30-day F&G chart with color zones | manual-only | Browse `detail/?topic=crypto_sentiment` | N/A -- no test infra |
| MOM-01 | 20 mini-cards with sparklines + assessments | manual-only | Browse `detail/?topic=momentum_detail` | N/A -- no test infra |
| CRISIS-01 | Hunger index + choropleth + FAO trend | manual-only | Browse `detail/?topic=hunger` | N/A -- no test infra |
| CRISIS-02 | Disaster timeline + dual-axis trend chart | manual-only | Browse `detail/?topic=disasters` | N/A -- no test infra |

### Sampling Rate
- **Per task commit:** Open topic URL in browser, verify hero renders, charts load, no console errors
- **Per wave merge:** Visit all 5 topic URLs, check Chrome DevTools for errors
- **Phase gate:** All 5 topics render correctly with tier badge showing appropriate data source

### Wave 0 Gaps
None -- existing detail page infrastructure covers all phase requirements. No new test files needed; project uses manual browser validation.

## Open Questions

1. **Crypto Fear & Greed Cache**
   - What we know: collect-data.js saves to `economy/crypto-fear-greed.json` (raw data dir). Cache pipeline does NOT generate `data/cache/crypto_sentiment.json`.
   - What's unclear: Should we add a cache pipeline step, or just hardcode representative data?
   - Recommendation: Hardcode 30 days of representative F&G data in the topic module. This matches the pattern used for Freedom House scores, EM-DAT disasters, and UCDP conflicts where APIs aren't reliably accessible from browser.

2. **Historical Disaster Data (Affected/Damage)**
   - What we know: Current cache only has name/date/type/countries/status. EM-DAT has affected population and economic damage data but requires registration.
   - What's unclear: Exact affected/damage figures for the 10 cached events.
   - Recommendation: Hardcode EM-DAT published summary figures for each disaster. These are widely available in UNDRR/EM-DAT annual reports and don't change once published.

3. **Momentum Sparkline Data (10-Year History)**
   - What we know: world-state.json has current indicator values and trend direction, but NOT historical time-series for each indicator.
   - What's unclear: Where 10-year sparkline data comes from.
   - Recommendation: Use simplified representative sparklines based on trend direction: improving=upward slope, declining=downward slope, stable=flat. This is an honest visualization when exact historical data isn't available per-indicator. Alternatively, hardcode approximate 10-year trajectories for the ~24 indicators from World Bank/source data.

## Sources

### Primary (HIGH confidence)
- NOAA SWPC JSON services directory: `https://services.swpc.noaa.gov/json/` -- verified available endpoints and file sizes
- Project codebase: 19 existing topic modules, detail-app.js VALID_TOPICS, choropleth.js, data-loader.js, chart-manager.js
- Cache files: solar.json (predicted cycle, 36 months), hunger.json (undernourishment 2001-2023), disasters.json (10 events + static fallback note)
- cache-disasters.js, cache-environment-ext.js: verified data collection logic and API endpoints
- collect-data.js: verified NOAA observed solar cycle + alternative.me crypto F&G endpoints

### Secondary (MEDIUM confidence)
- [NOAA SWPC Data Access](https://www.swpc.noaa.gov/content/data-access) -- confirmed JSON endpoints, CORS status inferred from existing browser-based usage patterns
- [Alternative.me Crypto API](https://alternative.me/crypto/api/) -- confirmed API structure and 30-day history endpoint
- [FAO Food Price Index](https://www.fao.org/worldfoodsituation/foodpricesindex/en/) -- confirmed no browser-friendly API

### Tertiary (LOW confidence)
- NOAA SWPC CORS headers: inferred from the fact that USGS (similar govt JSON API) is CORS-friendly and SWPC JSON is used by browser-based dashboards. Should be verified with actual browser fetch during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all utilities exist and are proven across 19 topic modules
- Architecture: HIGH - patterns directly follow established Phase 4-7 conventions
- Data sources: HIGH for cache files (verified), MEDIUM for live NOAA SWPC CORS (inferred from similar govt APIs)
- Pitfalls: HIGH - identified from direct inspection of cache data structures vs requirement specifications

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days -- stable domain, no framework upgrades pending)
