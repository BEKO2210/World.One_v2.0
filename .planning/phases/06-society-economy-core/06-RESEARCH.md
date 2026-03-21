# Phase 6: Society & Economy Core - Research

**Researched:** 2026-03-21
**Domain:** Detail page topic modules (health, freedom, inequality, poverty) + society/economy data visualization
**Confidence:** HIGH

## Summary

Phase 6 implements four new detail page topic modules following the proven pattern from Phases 4 and 5. The codebase has 10 working topic modules that establish every aspect of the contract: meta/render/getChartConfigs/cleanup exports, 3-tier data fallback, Chart.js via CDN, DOMUtils for safe DOM construction, i18n bilingual keys, and reusable SVG choropleth. The four Phase 6 topics span two categories (society and economy) and introduce three visualization types not yet built: a DOM-based treemap (causes of death), a bubble scatter chart (health spending vs life expectancy), and a CSS-animated wealth distribution graphic.

The data layer is partially ready. Cache files already exist for freedom.json (global_trend 2006-2025), inequality.json (country_latest Gini values for 10 countries), and poverty.json (poverty_trend 1990-2024). There is no health cache file -- the health topic will use hardcoded reference data (WHO/World Bank 2024 estimates) following the same pattern as conflicts.js and temperature.js. Freedom House has no public API (confirmed in STATE.md decision from Phase 3), so freedom data remains a static in-script dataset supplemented by the cached global_trend. Static fallback values in static-values.json are currently null for health, freedom, inequality, and poverty -- these must be populated. No i18n keys exist yet for any Phase 6 topic.

The VALID_TOPICS allowlist in detail-app.js already includes 'health', 'freedom', 'inequality', and 'poverty', so no router changes are needed. The choropleth.js utility (built in Phase 5) can be reused directly for the freedom and vaccination maps.

**Primary recommendation:** Follow the Phase 5 pattern exactly: Plan 01 adds all i18n keys + static fallback values + the first topic module (health, the most complex with 4 visualizations). Plan 02 implements freedom + poverty (both use cached trend data + choropleth). Plan 03 implements inequality (the most animation-heavy with the wealth distribution visualization and toggle interaction).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SOC-03 | Topic health: life expectancy hero (World Bank), causes-of-death treemap, health spending vs life expectancy scatter (bubble=population), vaccination choropleth | World Bank SP.DYN.LE00.IN for life expectancy (no dedicated cache -- use hardcoded WHO 2024 data, ~73.4 years global); WHO top-10 causes hardcoded; scatter uses hardcoded WHO/World Bank health expenditure data; vaccination choropleth via renderChoropleth with DTP3 coverage data |
| SOC-04 | Topic freedom: Freedom House score hero (cached), SVG choropleth (green/yellow/red), 18-year decline trend chart | freedom.json cache has global_trend (2006-2025, score 47->42.3); Freedom House country scores hardcoded as static dataset (no API, confirmed Phase 3 decision); choropleth uses renderChoropleth with 3-color freedom classification |
| ECON-01 | Topic inequality: Gini index hero (World Bank), 100-person wealth distribution animation, country Gini ranking (toggle income/wealth), billionaire counter | inequality.json cache has country_latest (10 countries with Gini); world_trend is empty (World Bank sparse); Gini hardcoded for broader ranking; wealth distribution is pure DOM/CSS animation; billionaire count 3,028 (Forbes 2025) hardcoded |
| ECON-02 | Topic poverty: extreme poverty % hero (World Bank $2.15/day), dramatic 38%->8% animated trend line, regional stacked area chart | poverty.json cache has poverty_trend (1990-2024, 43.4%->10.3%); regional breakdown hardcoded from World Bank regional estimates; animated trend rendered directly in render() for time range support |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.x (CDN) | Line/bar/scatter/doughnut/bubble charts | Already loaded via chart-manager.js ensureChartJs() singleton |
| DOMUtils | Project util | DOM element creation (no innerHTML) | Security pattern established Phase 2, used in all 10 topics |
| i18n.js | Project util | DE/EN translation keys | Bilingual requirement, all topics follow this pattern |
| data-loader.js | Project util | 3-tier fallback (live/cache/static) | fetchTopicData() + fetchWithTimeout() proven in 10 topics |
| badge.js | Project util | Data freshness badge (LIVE/Cache/Static) | createTierBadge() in every topic hero block |
| choropleth.js | detail/utils | Reusable SVG choropleth component | Built in Phase 5 (INFRA-06), used by biodiversity + renewables already |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MathUtils | Project util | formatCompact, escapeHTML, clamp | Number formatting in tiles, safe string rendering |
| CHART_COLORS | chart-manager.js | Category color palette (RGB objects) | society: {r:232, g:168, b:124}, economy: {r:255, g:215, b:0} |
| toRgba() | chart-manager.js | RGB to rgba() CSS string | Chart datasets, fills, borders |
| world.svg | Asset | SVG world map with ISO-2 country paths | Base for freedom and vaccination choropleths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DOM-based treemap (causes of death) | chartjs-chart-treemap plugin v3.1.0 CDN | Adds another CDN dependency; project policy is Chart.js only; DOM treemap follows forests.js proportional bars pattern |
| Chart.js bubble chart (health spending) | Pure DOM scatter | Chart.js bubble type is built-in, no plugin needed; consistent with existing scatter patterns in airquality.js |
| CSS animation (wealth distribution) | Canvas/Chart.js custom | DOM animation is simpler, follows project DOMUtils pattern; no canvas needed for 100-element grid |

**Installation:**
No new dependencies. All libraries already loaded via CDN or project utilities.

## Architecture Patterns

### Recommended Project Structure
```
detail/
  topics/
    health.js          # SOC-03 topic module (category: society)
    freedom.js         # SOC-04 topic module (category: society)
    inequality.js      # ECON-01 topic module (category: economy)
    poverty.js         # ECON-02 topic module (category: economy)
  utils/
    choropleth.js      # Reusable SVG choropleth (already exists)
js/
  i18n.js              # Add ~60 new keys per language (health, freedom, inequality, poverty)
data/
  fallback/
    static-values.json # Populate health, freedom, inequality, poverty entries (currently null)
```

### Pattern 1: Topic Module Contract (proven in 10 existing modules)
**What:** Every topic exports { meta, render(blocks), getChartConfigs(), cleanup() }
**When to use:** Every new topic module
**Example (verified in codebase -- all 10 existing modules follow this):**
```javascript
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

export const meta = {
  id: 'health',
  titleKey: 'detail.health.title',
  category: 'society',  // CHART_COLORS.society for health + freedom
  icon: '',
};

let _intervals = [];
let _chartData = null;

export async function render(blocks) {
  const { data, tier, age } = await fetchTopicData('health');
  // blocks.hero, blocks.chart, blocks.trend, blocks.tiles,
  // blocks.explanation, blocks.comparison, blocks.sources
}

export function getChartConfigs() { return []; }
export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _chartData = null;
}
```

### Pattern 2: Hardcoded Reference Data (proven in conflicts.js, temperature.js, airquality.js)
**What:** Large datasets that have no live API or sparse API data are hardcoded in-module
**When to use:** Health (life expectancy, causes of death, vaccination rates), Freedom (country scores), Inequality (Gini rankings beyond cache), Poverty (regional breakdown)
**Why:** Project decision: data that updates annually or less frequently is hardcoded from authoritative sources. This is the established pattern for UCDP conflict data (20 countries), NASA GISTEMP (145 years), WHO AQI city rankings, IUCN categories, and Freedom House scores.

### Pattern 3: Choropleth Map via renderChoropleth() (proven in biodiversity.js, renewables.js)
**What:** Reusable SVG choropleth for freedom (3-color) and vaccination (gradient) maps
**When to use:** Freedom country classification map and vaccination coverage map
**Example (from biodiversity.js):**
```javascript
import { renderChoropleth } from '../utils/choropleth.js';

const result = await renderChoropleth(container, {
  dataMap: FREEDOM_SCORES,       // ISO-2 -> numeric value
  colorFn: (value) => { ... },   // value -> CSS color
  tooltipFn: (iso, val) => `${iso}: Score ${val}`,
  legendItems: [{ color: '#4caf50', label: 'Free' }, ...],
  title: i18n.t('detail.freedom.mapTitle'),
});
if (result?.cleanup) _choroplethCleanup = result.cleanup;
```

### Pattern 4: DOM-Based Treemap (new pattern, follows proportional bars from forests.js)
**What:** Pure DOM/CSS visualization for causes-of-death treemap using flexbox
**When to use:** Health topic (causes-of-death treemap visualization)
**Why not Chart.js plugin:** Adding chartjs-chart-treemap would require a new CDN load in ensureChartJs(). The project keeps external deps minimal. A DOM treemap with DOMUtils.create is lightweight, matches the project security pattern (no innerHTML), and follows the forests.js precedent of proportional DOM bars for ranked data.
**Implementation approach:**
```javascript
// Treemap as nested flex containers -- proportional area = death count
const causes = [
  { name: 'Cardiovascular', deaths: 19100000, color: '#d32f2f' },
  { name: 'Cancer', deaths: 10000000, color: '#7b1fa2' },
  // ... more causes
];
const total = causes.reduce((s, c) => s + c.deaths, 0);

const treemapEl = DOMUtils.create('div', {
  style: { display: 'flex', flexWrap: 'wrap', height: '300px', borderRadius: '8px', overflow: 'hidden' },
});

for (const cause of causes) {
  const pct = (cause.deaths / total) * 100;
  treemapEl.appendChild(DOMUtils.create('div', {
    style: {
      flex: `0 0 ${pct}%`,
      minHeight: pct > 5 ? '50%' : '25%',
      background: cause.color,
      padding: '6px',
      // ...
    },
  }, [/* label + value */]));
}
```

### Pattern 5: Chart.js Bubble Chart (built-in, no plugin)
**What:** Health spending vs life expectancy scatter with bubble size = population
**When to use:** Health topic comparison visualization
**Why:** Chart.js 4.x has native 'bubble' chart type. Each data point = {x, y, r} where r is bubble radius proportional to country population. Already used logarithmic x-axis in airquality.js scatter -- same pattern applies here.

### Pattern 6: CSS Animation for Wealth Distribution (new pattern, follows population counter in population.js)
**What:** 100 person icons in a 10x10 grid, where top N are colored differently to show wealth concentration
**When to use:** Inequality topic (100-person wealth distribution animation)
**Implementation approach:**
```javascript
// 100 "person" elements in a grid
const grid = DOMUtils.create('div', {
  style: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' },
});
for (let i = 0; i < 100; i++) {
  const isRich = i < 1; // top 1% owns ~45% of wealth
  grid.appendChild(DOMUtils.create('div', {
    style: {
      width: '24px', height: '24px', borderRadius: '50%',
      background: isRich ? toRgba(CHART_COLORS.economy) : 'rgba(255,255,255,0.15)',
      transition: 'background 0.3s ease',
    },
  }));
}
```

### Pattern 7: Toggle Interaction (proven in population.js pyramid year toggle)
**What:** Button group to switch between income Gini and wealth Gini views
**When to use:** Inequality topic (toggle income/wealth Gini ranking)
**Example (from population.js, verified):**
```javascript
// Year toggle buttons for pyramid -- same pattern for income/wealth toggle
const years = [1960, 2000, 2026, 2050];
const toggleContainer = DOMUtils.create('div', {
  style: { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: 'var(--space-sm)' },
});
for (const year of years) {
  const btn = DOMUtils.create('button', {
    textContent: String(year),
    style: { /* active/inactive styles */ },
  });
  btn.addEventListener('click', () => { /* update chart data */ });
  toggleContainer.appendChild(btn);
}
```

### Anti-Patterns to Avoid
- **Adding CDN dependencies:** Do NOT load chartjs-chart-treemap. Use DOM treemap instead. The project loads only Chart.js 4.x via CDN.
- **innerHTML for data rendering:** All 10 existing topics use DOMUtils.create exclusively. Never use innerHTML for data-driven content (security pattern from Phase 2).
- **Importing from main page modules:** Do NOT import from js/app.js or js/maps.js. Copy needed data inline (Phase 5 decision: NATURE_SCORE copied, not imported).
- **Forgetting choropleth cleanup:** Store the cleanup function from renderChoropleth() and call it in cleanup(). Forgetting causes listener leaks.
- **Missing static fallback:** All topics need non-null values in static-values.json or fetchTopicData returns null on all tiers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG world map coloring | Custom SVG path finder | renderChoropleth() from detail/utils/choropleth.js | Already handles ISO-2 mapping, tooltips, legend, cleanup; proven in 2 topics |
| Chart lifecycle | Manual Chart() + destroy | createChart() + ensureChartJs() from chart-manager.js | Automatic destroy-before-create, registry tracking, dark defaults |
| Data fetching | Raw fetch() | fetchTopicData() from data-loader.js | 3-tier fallback, cache age calculation, static fallback loading |
| Data freshness badge | Custom badge HTML | createTierBadge() from badge.js | Consistent LIVE/Cache/Static pill with correct styling |
| Number formatting | Manual toLocaleString everywhere | MathUtils.formatCompact() | Handles millions/billions with i18n suffixes |
| Translation lookup | String literals | i18n.t('key') | Bilingual DE/EN support, falls back to key if missing |

**Key insight:** Phase 6 is a pure "content phase" -- all infrastructure exists. The only new patterns are the DOM treemap and wealth distribution animation, both of which are DOM-only and follow existing DOMUtils patterns.

## Common Pitfalls

### Pitfall 1: No Health Cache File
**What goes wrong:** fetchTopicData('health') looks for data/cache/health.json which does not exist -- tier 2 (cache) always fails
**Why it happens:** The GitHub Actions pipeline (cache-society-ext.js) writes population.json, freedom.json, conflicts.json but NOT health.json
**How to avoid:** Health module must rely on hardcoded data (like temperature.js uses hardcoded GISTEMP data). Set the hero value from hardcoded WHO data with tier='static'. Alternatively, fetch life expectancy live from World Bank API as tier 1 (SP.DYN.LE00.IN), but expect cache tier to fail gracefully.
**Warning signs:** Hero shows no badge or null value

### Pitfall 2: Empty world_trend in inequality.json Cache
**What goes wrong:** inequality.json cache has world_trend: [] (empty array) because the World Bank Gini endpoint returns sparse data for WLD aggregate
**Why it happens:** The World Bank does not publish a single "global Gini" time series. The cache script handles this by fetching country_latest instead.
**How to avoid:** Use country_latest array from cache for the ranking chart. For a world Gini hero value, use a hardcoded estimate (e.g., World Bank estimated global Gini ~38.5, 2024). Do NOT depend on world_trend being populated.
**Warning signs:** Gini hero shows NaN or no value

### Pitfall 3: Poverty Trend Data Starts at 43.4%, Not 38%
**What goes wrong:** Requirements say "38%-to-8%" but poverty.json starts at 1990: 43.4% and ends at 2024: 10.3%
**Why it happens:** The 38% figure is from ~1996 (37.9%). The 43% starting point is 1990. The "8%" is approximately the 2019 pre-COVID low.
**How to avoid:** Use the full cache data (1990-2024, 43.4%->10.3%). The "38% to 8%" in requirements is a simplified narrative -- the trend line should show the full data with labels. The dramatic drop IS there: 43.4% -> 10.3% is even more dramatic than 38% -> 8%.
**Warning signs:** Animated line looks wrong if cherry-picking years

### Pitfall 4: Freedom House Country Data Not in Cache
**What goes wrong:** freedom.json only contains global_trend (aggregate score). No per-country data for the choropleth.
**Why it happens:** Freedom House has no public API (confirmed Phase 3 decision). The cache script stores only the global score trend.
**How to avoid:** Hardcode Freedom House country classifications (Free/Partly Free/Not Free) as an in-module constant, like CONFLICT_COUNTRIES in conflicts.js. ~40-50 countries covering major nations is sufficient for a meaningful choropleth.
**Warning signs:** Choropleth map shows only a few colored countries

### Pitfall 5: Category Color Mismatch
**What goes wrong:** Health and freedom use CHART_COLORS.society (orange-peach) but inequality and poverty use CHART_COLORS.economy (gold)
**Why it happens:** Two categories in one phase. Easy to copy-paste and forget to switch.
**How to avoid:** meta.category determines the color. Verify: health.category='society', freedom.category='society', inequality.category='economy', poverty.category='economy'. Use the matching CHART_COLORS key consistently.
**Warning signs:** Gold charts on a society topic or peach charts on an economy topic

### Pitfall 6: Treemap Plugin Temptation
**What goes wrong:** Developer loads chartjs-chart-treemap CDN thinking "it's just one more script"
**Why it happens:** Chart.js has a treemap plugin. Seems like the "right" way.
**How to avoid:** Use a DOM-based treemap with flexbox. The project loads only Chart.js core via CDN. Adding plugins would require modifying ensureChartJs() and adding fallback CDN logic. The DOM treemap approach follows the proportional bars pattern from forests.js and keeps the dependency footprint unchanged.
**Warning signs:** New CDN URLs appearing in chart-manager.js

## Code Examples

Verified patterns from the codebase:

### Fetching Cache Data with 3-Tier Fallback
```javascript
// Source: detail/topics/conflicts.js (verified in codebase)
const { data, tier, age } = await fetchTopicData('freedom');

const globalTrend = data?.global_trend || [];
const latestScore = globalTrend.length > 0
  ? globalTrend[globalTrend.length - 1].score
  : 42.3; // static fallback
```

### Hero Block with Badge
```javascript
// Source: detail/topics/conflicts.js, biodiversity.js (common pattern)
function _renderHero(heroEl, value, year, tier, age) {
  const badge = createTierBadge(tier, { age, year: tier === 'static' ? year : null });
  heroEl.appendChild(
    DOMUtils.create('div', { className: 'freedom-hero' }, [
      DOMUtils.create('div', {
        style: { fontSize: '3.5rem', fontWeight: '700', lineHeight: '1.1',
                 color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' },
      }, [String(value)]),
      DOMUtils.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.freedom.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}
```

### Bubble Chart (Chart.js built-in type)
```javascript
// Source: Chart.js 4.x documentation (type: 'bubble' is built-in)
// Pattern follows airquality.js scatter chart structure
await ensureChartJs();
createChart('health-spending-scatter', {
  type: 'bubble',
  data: {
    datasets: [{
      label: 'Health Spending vs Life Expectancy',
      data: HEALTH_SPENDING_DATA.map(d => ({
        x: d.spending,     // health expenditure per capita
        y: d.lifeExp,      // life expectancy years
        r: Math.sqrt(d.population / 1e7) * 2, // bubble radius
      })),
      backgroundColor: HEALTH_SPENDING_DATA.map(d =>
        d.lifeExp >= 75 ? toRgba(CHART_COLORS.society, 0.6)
                        : toRgba(CHART_COLORS.crisis, 0.6)
      ),
    }],
  },
  options: {
    scales: {
      x: { type: 'logarithmic', title: { display: true, text: 'Health spending per capita (USD)' } },
      y: { title: { display: true, text: 'Life expectancy (years)' } },
    },
  },
});
```

### Trend Chart with Time Range Support (Rendered Directly)
```javascript
// Source: detail/topics/conflicts.js _renderTrend (verified in codebase)
// Poverty animated trend follows same pattern
async function _renderTrend(trendEl) {
  trendEl.appendChild(DOMUtils.create('div', {}, [
    DOMUtils.create('h2', { textContent: i18n.t('detail.poverty.trendTitle'), /* ... */ }),
    DOMUtils.create('div', { style: 'position:relative; height:350px;' }, [
      DOMUtils.create('canvas', { id: 'poverty-trend-canvas' }),
    ]),
  ]));

  await ensureChartJs();
  _trendChart = createChart('poverty-trend-canvas', { /* line chart config */ });

  // Listen for time range changes (from detail-app.js time range selector)
  trendEl.addEventListener('timerangechange', (e) => {
    const range = e.detail?.range;
    // Filter data and update chart
    _trendChart.data.labels = filtered.map(d => String(d.year));
    _trendChart.data.datasets[0].data = filtered.map(d => d.value);
    _trendChart.update('none');
  });
}
```

### Choropleth with Freedom Classification Colors
```javascript
// Source: detail/utils/choropleth.js + biodiversity.js (verified pattern)
import { renderChoropleth } from '../utils/choropleth.js';

function colorFn(score) {
  if (score >= 70) return '#4caf50';  // Free (green)
  if (score >= 35) return '#fbc02d';  // Partly Free (yellow)
  return '#d32f2f';                    // Not Free (red)
}

const result = await renderChoropleth(blocks.comparison, {
  dataMap: FREEDOM_COUNTRY_SCORES,
  colorFn,
  tooltipFn: (iso, val) => `${iso}: ${val}/100`,
  legendItems: [
    { color: '#4caf50', label: 'Free' },
    { color: '#fbc02d', label: 'Partly Free' },
    { color: '#d32f2f', label: 'Not Free' },
  ],
  title: i18n.t('detail.freedom.mapTitle'),
});
```

### Tiles Grid (2x2, consistent across all topics)
```javascript
// Source: every topic module uses this exact pattern
const tiles = tileData.map(({ label, value, unit, accent }) =>
  DOMUtils.create('div', {
    style: {
      padding: 'var(--space-sm)',
      background: 'rgba(255, 255, 255, 0.04)',
      borderRadius: '8px',
      textAlign: 'center',
    },
  }, [
    DOMUtils.create('div', { textContent: label,
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' } }),
    DOMUtils.create('div', { textContent: value,
      style: { color: accent || 'var(--text-primary)', fontSize: '1.5rem', fontWeight: '600' } }),
    DOMUtils.create('div', { textContent: unit,
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' } }),
  ])
);

tilesEl.appendChild(DOMUtils.create('div', {
  style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' },
}, tiles));
```

## Data Availability Analysis

### Health Topic (SOC-03)
| Data Point | Source | Availability | Approach |
|------------|--------|-------------|----------|
| Life expectancy (global) | World Bank SP.DYN.LE00.IN | No cache file; API available | Try live World Bank API -> fallback to hardcoded 73.4 years (WHO 2024) |
| Causes of death | WHO Global Health Estimates | No API (data releases) | Hardcode WHO top-10 causes (2024 estimates) |
| Health spending vs life expectancy | World Bank SH.XPD.CHEX.PC.CD | No cache file | Hardcode ~25 countries from World Bank 2022 data |
| Vaccination coverage (DTP3) | WHO/UNICEF WUENIC | No cache file | Hardcode ~50 countries from WHO 2024 estimates |

### Freedom Topic (SOC-04)
| Data Point | Source | Availability | Approach |
|------------|--------|-------------|----------|
| Global freedom score | Freedom House | freedom.json cache (global_trend) | Use cache -> fallback hardcoded 42.3 |
| Country scores (choropleth) | Freedom House | NOT in cache | Hardcode ~60 countries with FH score 0-100 |
| 18-year trend | Freedom House | freedom.json cache (global_trend 2006-2025) | Use cache data directly |

### Inequality Topic (ECON-01)
| Data Point | Source | Availability | Approach |
|------------|--------|-------------|----------|
| Gini index (hero) | World Bank SI.POV.GINI | inequality.json cache (world_trend empty!) | Hardcode ~38.5 global estimate (World Bank 2024) |
| Country Gini ranking | World Bank | inequality.json cache (country_latest, 10 countries) | Supplement with hardcoded additional countries for richer ranking |
| Billionaire count | Forbes | No cache | Hardcode 3,028 (Forbes 2025) |
| Wealth distribution | Oxfam/Credit Suisse | No cache | Hardcode: top 1% owns ~45%, bottom 50% owns ~1% |

### Poverty Topic (ECON-02)
| Data Point | Source | Availability | Approach |
|------------|--------|-------------|----------|
| Extreme poverty % | World Bank SI.POV.DDAY | poverty.json cache (poverty_trend) | Use cache -> latest value 10.3% (2024) |
| Historical trend | World Bank | poverty.json cache (1990-2024, 35 entries) | Use cache data directly for trend line |
| Regional breakdown | World Bank | NOT in cache | Hardcode regional estimates from World Bank PIP 2024 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| $1.90/day poverty line | $2.15/day poverty line | 2022 (2017 PPPs) | All poverty data now uses $2.15 threshold |
| $2.15/day poverty line | $3.00/day poverty line | June 2025 (2021 PPPs) | World Bank updated; requirements still reference $2.15 -- use $2.15 for consistency with existing cache data |
| Freedom House manual download | democracyData R package | 2024 | Still no REST API; in-script static data is correct approach |
| Gini as single global number | Per-country Gini only | Ongoing | World Bank does not publish a single global Gini. Use estimate with citation. |

**Deprecated/outdated:**
- $1.90/day poverty line: replaced by $2.15 in 2022, and now $3.00 in June 2025
- poverty.json cache uses the World Bank SI.POV.DDAY indicator which tracks $2.15/day -- consistent with requirements

## Open Questions

1. **Poverty threshold narrative ($2.15 vs 38%)**
   - What we know: poverty.json starts at 43.4% (1990), not 38%. The requirements say "38%-to-8%".
   - What's unclear: Whether to show the full range (43.4%->10.3%) or a cropped range
   - Recommendation: Show full data from cache (43.4% 1990 -> 10.3% 2024). This is MORE dramatic than 38%->8%. The animated line should highlight the drop. The requirements' "38%->8%" is a simplified narrative description, not a strict data constraint.

2. **Health topic data freshness**
   - What we know: No health cache file exists. Life expectancy data comes from World Bank which has 2022 as latest year.
   - What's unclear: Whether to add a new cache script or rely on hardcoded data
   - Recommendation: Use hardcoded data for Phase 6 (matches temperature.js pattern with 145 hardcoded data points). A cache script can be added in a future phase if needed. The health topic data changes slowly (annual updates).

3. **Inequality wealth vs income toggle**
   - What we know: Requirements say "toggle income/wealth". Income Gini and wealth Gini are different metrics.
   - What's unclear: Exact data availability for wealth Gini by country
   - Recommendation: Hardcode both income Gini (World Bank) and wealth Gini (Credit Suisse Global Wealth Report) for ~15-20 countries. Toggle switches the dataset and updates the bar chart (following population.js pyramid year toggle pattern).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser validation (no automated test framework in project) |
| Config file | none |
| Quick run command | Open `detail/?topic=health` in browser |
| Full suite command | Visit all 4 topic URLs and verify all visualizations |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOC-03 | Health: hero + treemap + scatter + choropleth | manual | `open detail/?topic=health` | Wave 0 |
| SOC-04 | Freedom: hero + choropleth + trend chart | manual | `open detail/?topic=freedom` | Wave 0 |
| ECON-01 | Inequality: hero + animation + ranking + billionaire | manual | `open detail/?topic=inequality` | Wave 0 |
| ECON-02 | Poverty: hero + animated trend + stacked area | manual | `open detail/?topic=poverty` | Wave 0 |

### Sampling Rate
- **Per task commit:** Open topic URL in browser, verify hero renders with correct value
- **Per wave merge:** Visit all implemented topic URLs, check all visualization blocks
- **Phase gate:** All 4 topic URLs render without errors, all success criteria visualizations visible

### Wave 0 Gaps
- [ ] `data/fallback/static-values.json` -- populate health, freedom, inequality, poverty (currently null)
- [ ] `js/i18n.js` -- add ~60 keys per language for all 4 Phase 6 topics
- [ ] `detail/topics/health.js` -- new file
- [ ] `detail/topics/freedom.js` -- new file
- [ ] `detail/topics/inequality.js` -- new file
- [ ] `detail/topics/poverty.js` -- new file

## Sources

### Primary (HIGH confidence)
- Codebase: 10 existing topic modules (co2.js, temperature.js, biodiversity.js, airquality.js, forests.js, renewables.js, population.js, conflicts.js, earthquakes.js, _stub.js) -- all patterns verified by reading source
- Codebase: detail/utils/choropleth.js -- verified renderChoropleth() API signature and usage
- Codebase: js/utils/chart-manager.js -- verified CHART_COLORS.society and CHART_COLORS.economy values
- Codebase: data/cache/freedom.json -- verified global_trend structure (2006-2025)
- Codebase: data/cache/inequality.json -- verified world_trend empty, country_latest has 10 entries
- Codebase: data/cache/poverty.json -- verified poverty_trend 1990-2024
- Codebase: scripts/cache-economy-ext.js -- verified no health cache exists
- Codebase: scripts/cache-society-ext.js -- verified freedom is static in-script data
- Codebase: detail/detail-app.js -- verified VALID_TOPICS includes health, freedom, inequality, poverty
- Codebase: data/fallback/static-values.json -- verified health/freedom/inequality/poverty are null

### Secondary (MEDIUM confidence)
- [World Bank Data API](https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries) -- SP.DYN.LE00.IN life expectancy, SI.POV.GINI Gini, SI.POV.DDAY poverty
- [WHO Top 10 Causes of Death](https://www.who.int/news-room/fact-sheets/detail/the-top-10-causes-of-death) -- 2024 estimates based on GHE 2000-2021
- [Freedom House Methodology](https://freedomhouse.org/reports/freedom-world/freedom-world-research-methodology) -- confirmed no public API
- [Freedom House Country Scores](https://freedomhouse.org/country/scores) -- Free/Partly Free/Not Free classifications
- [Forbes Billionaires 2025](https://www.npr.org/2025/04/01/nx-s1-5345950/forbes-billionaires-list) -- 3,028 billionaires, $16.1T total
- [WHO Immunization Coverage 2024](https://www.who.int/news-room/fact-sheets/detail/immunization-coverage) -- DTP3 85%, Measles 84%
- [chartjs-chart-treemap on jsDelivr](https://www.jsdelivr.com/package/npm/chartjs-chart-treemap) -- v3.1.0 available but NOT recommended (use DOM treemap)

### Tertiary (LOW confidence)
- Global Gini estimate ~38.5: from World Bank 2024 reporting, not directly from API data (world_trend is empty in cache)
- Wealth Gini by country: from Credit Suisse Global Wealth Report, values change annually, needs validation against latest report

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new deps
- Architecture: HIGH - all 4 modules follow exact same contract as 10 existing modules
- Data availability: HIGH - caches verified, gaps identified with clear fallback strategies
- Pitfalls: HIGH - derived from direct inspection of cache data and existing module patterns
- Visualizations: MEDIUM - DOM treemap and wealth animation are new patterns but follow established DOMUtils approach

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- underlying data sources update annually)
