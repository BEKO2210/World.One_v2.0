# Phase 5: Environment & Forests Topics - Research

**Researched:** 2026-03-21
**Domain:** Detail page topic modules (biodiversity, air quality, forests, renewables) + reusable SVG choropleth
**Confidence:** HIGH

## Summary

Phase 5 extends the proven detail page topic module pattern (established in Phase 4 with co2, temperature, population, earthquakes, conflicts) to four new environment topics plus a reusable SVG choropleth component. The codebase already contains all necessary infrastructure: the topic module contract (meta/render/getChartConfigs/cleanup), 3-tier data fallback (live/cache/static), Chart.js CDN loading, DOMUtils for DOM construction, i18n bilingual support, and a working SVG world map with coloring/tooltip patterns in both maps.js (main page) and temperature.js (detail page).

The primary technical challenge is INFRA-06: extracting the SVG choropleth pattern (currently duplicated between maps.js and temperature.js) into a reusable component usable across detail pages. Three of the four topics (biodiversity, air quality, renewables) need choropleth maps. The data layer is partially ready -- biodiversity.json and solar.json caches exist, the collect-data.js pipeline already fetches air quality, forest area, and renewable energy from their respective APIs, but there are no dedicated cache files for airquality, forests, or renewables topics. Data will need to be hardcoded or fetched from the already-available raw data paths.

**Primary recommendation:** Build INFRA-06 choropleth component first (extracting from temperature.js pattern), then implement the four topic modules in parallel using the exact same contract and style patterns as co2.js/temperature.js. All four topics are in the environment category so they share the same CHART_COLORS.environment color.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENV-03 | Biodiversity topic: threatened species (GBIF), Living Planet Index trend, IUCN browser with CR list | GBIF API for species counts (cache exists at data/cache/biodiversity.json), LPI data hardcoded from WWF 2024 report (73% decline 1970-2020), IUCN categories as hardcoded reference data |
| ENV-04 | Air quality topic: global AQI (OpenAQ/Open-Meteo), city rankings, AQI-vs-GDP scatter, pollutant explainer | Open-Meteo Air Quality API (free, CORS-friendly, already used in collect-data.js), city AQI data available via process-data.js pipeline, GDP data hardcoded from World Bank |
| ENV-05 | Forests topic: forest cover % (World Bank), annual loss since 2000, deforestation causes stacked bar | World Bank AG.LND.FRST.ZS indicator (already fetched in collect-data.js), loss data derivable from year-over-year difference, deforestation causes from FAO hardcoded |
| ENV-06 | Renewables topic: renewable energy % (World Bank), live carbon intensity (Electricity Maps DE), country ranking, solar+wind growth | World Bank EG.FEC.RNEW.ZS (already fetched), Electricity Maps requires API key (use hardcoded fallback), RENEWABLE_SCORE data exists in maps.js, IRENA data for solar+wind hardcoded |
| INFRA-06 | Reusable SVG choropleth component extending maps.js | Extract pattern from temperature.js _renderChoropleth into detail/utils/choropleth.js -- SVG fetch, country coloring, tooltip, legend, ISO mapping all proven in codebase |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.x (CDN) | Line/bar/scatter/doughnut charts | Already loaded via chart-manager.js ensureChartJs() singleton |
| DOMUtils | Project util | DOM element creation (no innerHTML) | Security pattern established Phase 2, used in all topics |
| i18n.js | Project util | DE/EN translation keys | Bilingual requirement, all topics follow this pattern |
| data-loader.js | Project util | 3-tier fallback (live/cache/static) | fetchTopicData() + fetchWithTimeout() proven in 5 topics |
| badge.js | Project util | Data freshness badge (LIVE/Cache/Static) | createTierBadge() in every topic hero block |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MathUtils | Project util | clamp, lerp, normalize, tempToColor | Color scaling for choropleths, value normalization |
| world.svg | Asset | SVG world map with ISO-2 country paths | Base for all choropleth maps, fetched at runtime |
| CHART_COLORS | chart-manager.js | Category color palette (RGB objects) | environment: {r:0, g:180, b:216} for all 4 topics |
| toRgba() | chart-manager.js | RGB to rgba() CSS string | Chart datasets, fills, borders |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom SVG choropleth | D3.js/Leaflet | Explicitly out of scope (REQUIREMENTS.md: "D3.js / Leaflet / Mapbox - Too heavy") |
| OpenAQ API v3 (key required) | Open-Meteo Air Quality API | Open-Meteo is free, CORS-friendly, no key -- already used in co2.js and collect-data.js |
| Electricity Maps live API | Hardcoded carbon intensity data | API requires key + likely no CORS for browser; use hardcoded DE data with static badge |

**Installation:**
No new dependencies. All libraries already loaded via CDN or project utilities.

## Architecture Patterns

### Recommended Project Structure
```
detail/
  topics/
    biodiversity.js    # ENV-03 topic module
    airquality.js      # ENV-04 topic module
    forests.js         # ENV-05 topic module
    renewables.js      # ENV-06 topic module
  utils/
    choropleth.js      # INFRA-06 reusable SVG choropleth component
```

### Pattern 1: Topic Module Contract (proven in 5 existing modules)
**What:** Every topic exports { meta, render(blocks), getChartConfigs(), cleanup() }
**When to use:** Every new topic module
**Example (from co2.js, verified in codebase):**
```javascript
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

export const meta = {
  id: 'biodiversity',      // matches URL ?topic=biodiversity
  titleKey: 'detail.biodiversity.title',
  category: 'environment', // maps to CHART_COLORS.environment
  icon: '',
};

let _intervals = [];
let _chartData = null;

export async function render(blocks) {
  const { data, tier, age } = await fetchTopicData('biodiversity');
  // Populate: blocks.hero, blocks.chart, blocks.trend,
  //           blocks.tiles, blocks.explanation, blocks.comparison, blocks.sources
}

export function getChartConfigs() {
  // Return array of { canvasId, blockId, config } for lazy Chart.js init
  return [];
}

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _chartData = null;
}
```

### Pattern 2: SVG Choropleth (extract from temperature.js into reusable)
**What:** Fetch world.svg, inject into wrapper, color country paths by ISO-2 data map, add tooltip + legend
**When to use:** Biodiversity (threatened species by region), air quality (AQI by country), renewables (energy share by country)
**Key implementation details (verified from temperature.js lines 663-812):**
```javascript
// 1. Resolve base path for SVG fetch
const basePath = window.location.pathname.includes('/detail') ? '../' : '';

// 2. Fetch and inject SVG
const response = await fetch(`${basePath}assets/maps/world.svg`);
const svgText = await response.text();
wrapper.innerHTML = svgText;

// 3. Style SVG element
const svgEl = wrapper.querySelector('svg');
svgEl.style.width = '100%';
svgEl.style.height = 'auto';
svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

// 4. Color paths by data map using ISO-2 lookup
// ISO resolution: path.id (2-letter) || CLASS_TO_ISO[path.className] || CLASS_TO_ISO[path.name]

// 5. Mouse handlers: mouseenter (show tooltip + highlight), mousemove (position), mouseleave (hide)

// 6. Legend: gradient bar or discrete swatches
```

### Pattern 3: Hardcoded Data with Static Badge (proven in Phase 4)
**What:** When live API is unavailable or requires authentication, hardcode reference data in-module
**When to use:** Living Planet Index, deforestation causes, IUCN species list, carbon intensity, GDP data
**Examples from Phase 4 decisions:**
- NASA GISTEMP: 145 hardcoded annual anomalies (temperature.js)
- Top 10 emitters: hardcoded from World Bank 2020 (co2.js)
- Conflict countries: 20 entries hardcoded from UCDP/PRIO (conflicts.js)
- Freedom House: static in-script array (Phase 3 decision)

### Pattern 4: Dual Chart Rendering (direct in render + lazy via getChartConfigs)
**What:** Interactive charts rendered in render() for event handling; supplementary charts lazy via getChartConfigs()
**When to use:** When a chart needs timerangechange or other event listeners
**Example (from conflicts.js, population.js):**
- Conflict trend chart: rendered in render() for timerangechange interactivity
- Refugees doughnut: lazy via getChartConfigs()
- Population pyramid: rendered in render() for year toggle
- Urbanization: lazy via getChartConfigs()

### Pattern 5: i18n Key Convention
**What:** All user-visible strings use i18n.t('detail.{topic}.{key}') keys
**Convention (verified from i18n.js):**
```
detail.{topic}.title          -- Page title
detail.{topic}.heroLabel      -- Hero metric label
detail.{topic}.heroUnit       -- Hero metric unit
detail.{topic}.{chartTitle}   -- Chart section headings
detail.{topic}.tile{Name}     -- Context tile labels
detail.{topic}.explanation    -- Explanation paragraphs
detail.{topic}.comparison     -- Comparison text
detail.{topic}.source{Name}   -- Source labels
```

### Anti-Patterns to Avoid
- **innerHTML for user content:** Always use DOMUtils.create() -- established security pattern
- **Importing maps.js into detail pages:** The main page maps.js has its own data maps (CLIMATE_RISK, HUNGER_RISK, etc.) baked in. Detail page choropleth should be a separate reusable component that accepts data + colorFn as parameters
- **Fetching CSVs in browser:** Research Pattern 6 from Phase 4 -- hardcode data rather than attempt browser-side CSV parsing of NASA/NOAA files
- **Using OpenAQ directly in browser:** API v2 returned HTTP 410 since Jan 2025, v3 requires API key. Use Open-Meteo Air Quality API (free, no key, CORS-friendly)
- **Forgetting cleanup():** Every setInterval/addEventListener must be tracked and cleaned up

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG country identification | Custom ISO parser | Maps._getISO() pattern (id -> class -> name lookup via CLASS_TO_ISO) | Already handles multi-class paths, edge cases with 33 country mappings |
| Chart lifecycle | Manual canvas cleanup | chart-manager.js createChart() + destroyAllCharts() | Registry tracks instances, prevents canvas memory leaks |
| Data fetching | Custom fetch + cache | fetchTopicData(topic) from data-loader.js | 3-tier fallback built-in, badge tier tracking |
| Color scales | Custom interpolation | MathUtils.normalize() + stepped color function (proven in maps.js) | Consistent approach across all choropleth layers |
| Tooltip positioning | Custom positioning | TOOLTIP_STYLE pattern from temperature.js | Glass-morphism style, mouse-follow, boundary clamping |

**Key insight:** The temperature.js choropleth pattern works but is tightly coupled to regional warming data. Extracting it into a parameterized function (dataMap, colorFn, tooltipFn, legendItems) eliminates 80% of the code per new choropleth while keeping the proven SVG handling.

## Common Pitfalls

### Pitfall 1: SVG Path ISO Resolution Failures
**What goes wrong:** Some world.svg paths use CSS class names (e.g., "Russian Federation") instead of 2-letter ISO ids. Coloring fails silently on ~33 countries.
**Why it happens:** The SVG file uses mixed identification -- some paths have id="RU", others have class="Russian Federation"
**How to avoid:** Always use the CLASS_TO_ISO mapping from maps.js / temperature.js. The mapping covers 80+ country-name-to-ISO entries.
**Warning signs:** Countries appearing gray/dim when they should be colored

### Pitfall 2: Base Path for SVG Fetch in Detail Pages
**What goes wrong:** fetch('assets/maps/world.svg') fails with 404 from detail/index.html
**Why it happens:** Browser resolves relative URLs against HTML document path, not script path. Detail pages are at /detail/index.html so relative paths need '../'
**How to avoid:** Use _basePath() helper: `window.location.pathname.includes('/detail') ? '../' : ''`
**Warning signs:** Map showing "Map unavailable" fallback text

### Pitfall 3: API Key Requirements Blocking Browser Fetch
**What goes wrong:** Attempting to call APIs that require authentication from browser-side code
**Why it happens:** OpenAQ v3, Electricity Maps, UCDP all require API keys. Browser exposes keys in source.
**How to avoid:** Use only free, CORS-friendly APIs in browser (Open-Meteo, GBIF, World Bank). For key-required APIs, use cache pipeline (server-side) or hardcoded data.
**Warning signs:** 401/403 responses, CORS errors in console

### Pitfall 4: Chart.js Not Loaded When getChartConfigs() Called
**What goes wrong:** Chart.js CDN load failed or hasn't completed
**Why it happens:** ensureChartJs() returns a promise; if not awaited before chart creation, Chart constructor is undefined
**How to avoid:** detail-app.js already handles this -- it awaits ensureChartJs() before calling getChartConfigs(). No action needed in topic modules.
**Warning signs:** "Chart is not defined" console errors

### Pitfall 5: Missing i18n Keys Causing Blank Text
**What goes wrong:** i18n.t('detail.biodiversity.title') returns the key string because the key was never added
**Why it happens:** i18n keys must be added in i18n.js for both DE and EN before the topic module uses them
**How to avoid:** Phase 4 decision: "All 5 topic i18n keys added upfront in Plan 01 to unblock parallel execution." Follow same pattern -- add all Phase 5 keys in first plan.
**Warning signs:** Key paths like "detail.biodiversity.title" appearing as literal text on page

### Pitfall 6: Static Fallback Values File Has Null Entries
**What goes wrong:** fetchTopicData fallback returns null for biodiversity, airquality, forests, renewables
**Why it happens:** data/fallback/static-values.json has `"biodiversity": null, "airquality": null, "forests": null, "renewables": null`
**How to avoid:** Update static-values.json with proper fallback values for all four topics before implementing topic modules
**Warning signs:** Hero block showing "null" or "undefined" values

## Code Examples

### Reusable Choropleth Component (INFRA-06 target pattern)
```javascript
// detail/utils/choropleth.js -- extracted from temperature.js pattern
import { DOMUtils } from '../../js/utils/dom.js';

// Full CLASS_TO_ISO mapping (80+ entries from temperature.js)
const CLASS_TO_ISO = { /* ... */ };

const TOOLTIP_STYLE = {
  position: 'absolute',
  background: 'rgba(18,18,26,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  pointerEvents: 'none',
  zIndex: '1000',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s ease',
};

/**
 * Render a reusable SVG choropleth map into a container element.
 * @param {HTMLElement} container - Parent element to append map into
 * @param {Object} options
 * @param {Object} options.dataMap - ISO-2 -> numeric value mapping
 * @param {Function} options.colorFn - (value) => CSS color string
 * @param {Function} options.tooltipFn - (iso, value) => tooltip text
 * @param {Array} options.legendItems - [{color, label}] for legend
 * @param {string} [options.title] - Optional heading above map
 * @returns {Promise<{wrapper, cleanup}>}
 */
export async function renderChoropleth(container, options) { /* ... */ }
```

### Topic Module Hero Block (standard pattern)
```javascript
function _renderHero(heroEl, value, unit, tier, age) {
  const badge = createTierBadge(tier, { age });
  heroEl.appendChild(
    DOMUtils.create('div', { className: '{topic}-hero' }, [
      DOMUtils.create('div', {
        style: { fontSize: '3.5rem', fontWeight: '700', lineHeight: '1.1',
                 color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' },
      }, [
        value,
        DOMUtils.create('span', {
          style: { fontSize: '1.5rem', fontWeight: '400', marginLeft: '0.5rem',
                   color: 'var(--text-secondary)' },
          textContent: unit,
        }),
      ]),
      DOMUtils.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                 marginBottom: 'var(--space-sm)' },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.{topic}.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}
```

### Context Tiles Grid (standard 2x2 pattern)
```javascript
function _renderTiles(tilesEl, tileData) {
  // tileData = [{label, value, unit}, ...]
  const tiles = tileData.map(({ label, value, unit }) =>
    DOMUtils.create('div', {
      style: { padding: 'var(--space-sm)', background: 'rgba(255,255,255,0.04)',
               borderRadius: '8px', textAlign: 'center' },
    }, [
      DOMUtils.create('div', { textContent: label,
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' } }),
      DOMUtils.create('div', { textContent: value,
        style: { color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: '600' } }),
      DOMUtils.create('div', { textContent: unit,
        style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' } }),
    ])
  );
  tilesEl.appendChild(
    DOMUtils.create('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' },
    }, tiles)
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAQ API v2 | Open-Meteo Air Quality API | Jan 2025 (v2 returns 410) | collect-data.js already migrated; use Open-Meteo in browser too |
| Inline SVG choropleth per topic | Reusable choropleth component | Phase 5 (INFRA-06) | Eliminates ~100 lines of duplication per choropleth map |
| D3.js for maps | Custom SVG coloring | Project design decision | D3 explicitly out of scope; SVG path coloring sufficient |
| Separate cache files per detail topic | Shared data/cache/*.json | Phase 3 pipeline | biodiversity.json exists; forest/air/renewable data is in raw pipeline |

**Deprecated/outdated:**
- OpenAQ v1/v2: Returns HTTP 410 since Jan 2025
- UCDP API: Requires token since Feb 2026 (use static fallback)
- Electricity Maps free browser access: Requires API key; no evidence of CORS support

## Data Source Analysis

### ENV-03 Biodiversity
| Data Point | Source | Access Method | Confidence |
|-----------|--------|---------------|------------|
| Threatened species count | GBIF API (v1/species/search?threat=) | Cache: data/cache/biodiversity.json | HIGH -- cache exists, verified structure |
| Living Planet Index trend | WWF/ZSL LPI 2024 report | Hardcoded: 73% decline 1970-2020, ~35 data points | HIGH -- stable published data |
| IUCN CR species list | GBIF/IUCN Red List | Hardcoded: top 20 critically endangered species | MEDIUM -- manual curation needed |
| Biodiversity choropleth | NATURE_SCORE from maps.js | Reuse existing data map (50+ countries) | HIGH -- data already in codebase |

### ENV-04 Air Quality
| Data Point | Source | Access Method | Confidence |
|-----------|--------|---------------|------------|
| Global AQI | Open-Meteo Air Quality API | Live fetch (CORS-friendly, no key) | HIGH -- already used in co2.js |
| City rankings | Open-Meteo / process-data.js pipeline | Cache: cleanestCities/mostPolluted from world-state.json | HIGH -- pipeline exists |
| AQI vs GDP scatter | World Bank GDP + Open-Meteo AQI | Hardcoded: 20-30 countries, GDP from WB 2023 | MEDIUM -- manual data assembly |
| PM2.5/PM10/NO2 explainer | WHO guidelines | Hardcoded: threshold values, health impacts | HIGH -- stable reference data |

### ENV-05 Forests
| Data Point | Source | Access Method | Confidence |
|-----------|--------|---------------|------------|
| Forest cover % | World Bank AG.LND.FRST.ZS | Cache/live: collect-data.js fetches this | HIGH -- pipeline exists |
| Annual loss since 2000 | World Bank (year-over-year delta) | Derived from forest history array | HIGH -- straightforward calculation |
| Deforestation causes | FAO / Global Forest Watch | Hardcoded: stacked bar categories (agriculture, logging, fires, urbanization, infrastructure) | MEDIUM -- manual curation from FAO data |

### ENV-06 Renewables
| Data Point | Source | Access Method | Confidence |
|-----------|--------|---------------|------------|
| Renewable energy % | World Bank EG.FEC.RNEW.ZS | Cache/live: collect-data.js fetches this | HIGH -- pipeline exists |
| Carbon intensity DE | Electricity Maps | Hardcoded fallback (API requires key, no CORS) | MEDIUM -- can't do live browser fetch |
| Country ranking | RENEWABLE_SCORE from maps.js | Reuse existing data map (67 countries) | HIGH -- data in codebase |
| Solar+wind growth | IRENA / Our World in Data | Hardcoded: key capacity milestones 2000-2024 | MEDIUM -- manual data assembly |

## Open Questions

1. **Cache file mapping for new topics**
   - What we know: biodiversity.json cache exists. collect-data.js fetches forest-area.json and renewable-energy.json as raw data (saved to data/raw/environment/), not to data/cache/.
   - What's unclear: Should new cache pipeline scripts be created, or should topic modules use fetchTopicData with the raw data path?
   - Recommendation: Use existing data paths. fetchTopicData('biodiversity') already works via the cache file. For forests/renewables, hardcode historical data in-module (matching Phase 4 pattern of hardcoded NASA GISTEMP data). No new cache scripts needed for Phase 5.

2. **Electricity Maps API for live carbon intensity**
   - What we know: Requires API key, no clear CORS support for browser-side use. Free tier exists but seems server-to-server oriented.
   - What's unclear: Whether a proxy or build-time fetch could provide fresh data.
   - Recommendation: Hardcode recent DE carbon intensity (~350-400 gCO2/kWh average) with static badge. Future phases can add server-side caching if needed.

3. **GBIF rate limiting for browser-side species search**
   - What we know: GBIF API v1 is stable, free, returns JSON. Rate limited with HTTP 429 on excessive use.
   - What's unclear: Whether GBIF supports CORS for browser-side fetch of species lists.
   - Recommendation: Use only the existing cache (data/cache/biodiversity.json) for counts. Hardcode CR species list in-module to avoid browser-side GBIF calls.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework detected) |
| Config file | none |
| Quick run command | Open `detail/?topic=biodiversity` in browser |
| Full suite command | Open each of 4 new topic URLs in browser, verify all blocks render |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-06 | Reusable SVG choropleth renders map with colors + tooltip | manual | Open any topic with choropleth in browser | Wave 0 |
| ENV-03 | Biodiversity page: hero (species count), LPI trend, IUCN browser | manual | `detail/?topic=biodiversity` -- verify 3 sections | Wave 0 |
| ENV-04 | Air quality page: AQI hero, city ranking, scatter, explainer | manual | `detail/?topic=airquality` -- verify 4 sections | Wave 0 |
| ENV-05 | Forests page: cover %, annual loss, deforestation causes | manual | `detail/?topic=forests` -- verify 3 sections | Wave 0 |
| ENV-06 | Renewables page: energy %, carbon intensity, ranking, growth | manual | `detail/?topic=renewables` -- verify 4 sections | Wave 0 |

### Sampling Rate
- **Per task commit:** Open topic URL in browser, verify no console errors, all blocks populated
- **Per wave merge:** Open all 4 topic URLs + verify choropleth component works across topics
- **Phase gate:** All 5 success criteria verified in browser (from phase description)

### Wave 0 Gaps
- [ ] `data/fallback/static-values.json` -- populate biodiversity, airquality, forests, renewables entries (currently null)
- [ ] `js/i18n.js` -- add all Phase 5 detail.{topic}.* keys for DE and EN
- [ ] `detail/utils/choropleth.js` -- new file, INFRA-06 component (does not exist yet)

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** (direct file reads):
  - `detail/topics/co2.js` -- topic module contract reference
  - `detail/topics/temperature.js` -- SVG choropleth pattern (lines 663-812)
  - `detail/topics/conflicts.js` -- SVG map + hardcoded data pattern
  - `detail/topics/population.js` -- interval cleanup + dual chart rendering
  - `js/visualizations/maps.js` -- NATURE_SCORE, RENEWABLE_SCORE data maps + layer methods
  - `js/utils/data-loader.js` -- 3-tier fallback, _basePath() helper
  - `js/utils/chart-manager.js` -- CHART_COLORS, toRgba(), ensureChartJs()
  - `scripts/collect-data.js` -- fetchAirQuality, fetchGlobalForestWatch, fetchRenewableEnergy
  - `scripts/cache-biodiversity.js` -- GBIF API usage for threatened species counts
  - `data/cache/biodiversity.json` -- verified cache structure
  - `data/fallback/static-values.json` -- null entries for all 4 topics
  - `detail/detail-app.js` -- VALID_TOPICS allowlist already includes all 4 topics

### Secondary (MEDIUM confidence)
- [Electricity Maps API docs](https://docs.electricitymaps.com/) -- API key required, free tier for non-commercial
- [OpenAQ API docs](https://docs.openaq.org/using-the-api/api-key) -- v3 requires API key registration
- [GBIF Species API](https://techdocs.gbif.org/en/openapi/v1/species) -- stable v1, free, rate-limited
- [World Bank Forest Data](https://data.worldbank.org/indicator/AG.LND.FRST.ZS) -- AG.LND.FRST.ZS indicator
- [Living Planet Index 2024](https://www.livingplanetindex.org/) -- 73% decline in monitored populations 1970-2020

### Tertiary (LOW confidence)
- Electricity Maps CORS support -- no clear documentation found, assumed server-to-server only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries and patterns already proven in codebase across 5 topics
- Architecture: HIGH -- exact same topic module contract, identical imports, same 7-block layout
- Data sources: MEDIUM -- some APIs require hardcoded fallbacks (Electricity Maps, GBIF species lists)
- Pitfalls: HIGH -- all identified from actual codebase patterns and Phase 4 decisions
- INFRA-06 choropleth: HIGH -- full implementation pattern exists in temperature.js lines 663-812

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable project patterns, no external dependency changes expected)
