# Phase 10: New Acts & Biodiversity/Ocean Topics - Research

**Researched:** 2026-03-21
**Domain:** Main page act sections + detail topic modules (biodiversity + ocean)
**Confidence:** HIGH

## Summary

Phase 10 adds two new scroll-driven acts (Act 12 "Das Schweigen der Arten" and Act 13 "Die Ozeane") to the main page `index.html`, and creates five new detail topic modules (`extinction.js`, `endangered.js`, `ocean_temp.js`, `ocean_ph.js`, `ocean_plastic.js`). The work follows heavily established patterns from Phases 4-9: each new act uses the existing `section` + `bento-grid` + `data-card` HTML structure, the scroll engine registers new section IDs, nav dots get two new entries, cinematic backgrounds get Unsplash images, and detail-link click-through wiring extends the existing STATIC_TOPIC_MAP array. The five new detail topic modules follow the proven DETAIL-03 contract (meta, render, getChartConfigs, cleanup) used by all 24 existing topics.

The most important architectural insight is that the VALID_TOPICS allowlist in `detail/detail-app.js` already includes all five new topic IDs (ocean_temp, ocean_ph, ocean_plastic, extinction, endangered), while the static-values.json has null placeholder entries for all five. The ocean.json cache contains SST anomaly time series (1880-2025, ~146 data points); the biodiversity.json cache contains threatened species counts by IUCN category. No pH, plastic, or extinction-specific cache files exist -- these topics will use hardcoded reference data following the established pattern (as done for conflicts, freedom, health, crypto_sentiment, etc.).

**Primary recommendation:** Follow the exact structural patterns from Acts 2-8 for HTML sections and from biodiversity.js/hunger.js for detail topic modules. Use hardcoded data for ocean pH trend, plastic estimates, and extinction rates since no cache pipelines exist for these.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAIN-03 | Act 12 "Das Schweigen der Arten" -- new scroll section with biodiversity tiles | Section HTML pattern from Acts 2-8; bento-grid + data-card structure; scroll engine + nav dots + cinematic + sectionColors registration |
| MAIN-04 | Act 13 "Die Ozeane" -- new scroll section with ocean tiles (temp, pH, plastic) | Same section HTML pattern; 3-tile bento-grid--3 layout; SST from ocean.json cache |
| MAIN-05 | New act sections link tiles to their respective detail pages | STATIC_TOPIC_MAP extension in _initDetailLinks(); detail-link CSS already exists |
| OCEAN-01 | Topic ocean_temp -- SST anomaly, SVG heatmap choropleth, coral bleaching threshold | ocean.json has annual_sst_anomaly array; choropleth.js reusable; DETAIL-03 contract |
| OCEAN-02 | Topic ocean_ph -- pH trend, pH scale visualization, acidification infographic | No cache -- hardcode pH trend (8.25 preindustrial to ~8.08 current); DOM-based scale |
| OCEAN-03 | Topic ocean_plastic -- estimate, daily counter, garbage patches SVG, decomposition | No cache -- hardcode GESAMP estimates; counter pattern from population.js; SVG map |
| BIO-01 | Topic extinction -- extinction rate with historical mass extinctions context | No cache -- hardcode Big Five mass extinction data + current rate comparison |
| BIO-02 | Topic endangered -- IUCN categories with GBIF cached species lists | biodiversity.json has threatened_counts; extends existing biodiversity.js patterns |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.x (CDN) | Line/bar/scatter charts | Already loaded via chart-manager.js singleton |
| DOMUtils | project util | DOM creation, scrollTo, throttle | `js/utils/dom.js` -- all topic modules use it |
| fetchTopicData | project util | 3-tier data fallback | `js/utils/data-loader.js` -- standard for detail pages |
| createTierBadge | project util | LIVE/Cache/Static badge | `js/utils/badge.js` -- every topic hero uses it |
| renderChoropleth | project util | SVG world map coloring | `detail/utils/choropleth.js` -- reusable component |
| i18n | project util | DE/EN translations | `js/i18n.js` -- all text via keys |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ensureChartJs + createChart | project util | Chart.js loading + registry | For any Chart.js chart in detail pages |
| IntersectionObserver | browser API | Reveal animations | Already wired via scroll-engine.js |
| CSS custom properties | project convention | Theming/spacing | All --space-*, --text-*, color vars |

### No New Dependencies
This phase requires zero new libraries. Everything is built from existing project utilities and browser APIs.

## Architecture Patterns

### Main Page Section Insertion Points

New acts 12 and 13 must be inserted between Act 11 (akt-action, line ~946) and the Epilog (line ~951) in `index.html`. The current act order is:

```
Akt 01 (Indicator) -> Akt 02 (Environment) -> ... -> Akt 11 (Action) -> Epilog
```

The new order becomes:
```
... -> Akt 11 (Action) -> Akt 12 (Biodiversity) -> Akt 13 (Oceans) -> Epilog
```

### Pattern 1: Section HTML Structure (from existing Acts)

Every act follows this exact template:

```html
<!-- Comment banner -->
<section id="akt-biodiversity" class="section akt-biodiversity" data-section="akt-biodiversity" aria-label="Biodiversitaet">
  <div class="container section__content">
    <div class="section-header reveal">
      <span class="section-label" data-i18n="act12.label">AKT 12 -- BIODIVERSITAET</span>
      <h2 class="text-section" data-i18n="act12.title">Das Schweigen der Arten</h2>
      <p class="section-desc" data-i18n="act12.desc">[Description text]</p>
    </div>
    <!-- Data cards in bento-grid -->
    <div class="bento-grid bento-grid--2 reveal-stagger" style="margin-top:var(--space-xl)">
      <div class="data-card data-card--featured reveal">
        <!-- Tile content -->
      </div>
      <div class="data-card reveal">
        <!-- Tile content -->
      </div>
    </div>
  </div>
</section>
```

### Pattern 2: Seven Registration Points for New Sections

Adding a new act section requires updates to exactly 7 places in `js/app.js`:

1. **`_sectionColors`** (constructor, line ~26): Add particle color entries
2. **`_initScrollEngine` sectionIds array** (line ~126): Add section ID strings
3. **`_onSectionProgress` switch** (line ~152): Add case handlers (can be empty/minimal)
4. **`_initNavDots` sections array** (line ~1160): Add nav dot entries
5. **`_initDetailLinks` STATIC_TOPIC_MAP** (line ~1380): Add tile-to-topic mappings
6. **`SECTION_IMAGES` in `js/visualizations/cinematic.js`** (line ~9): Add Unsplash image URLs
7. **i18n keys** in `js/i18n.js`: Add act12.*/act13.* and nav.biodiversity/nav.oceans keys

### Pattern 3: Detail Topic Module Contract (DETAIL-03)

All 24 existing topic modules follow this exact interface:

```javascript
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

export const meta = {
  id: 'ocean_temp',
  titleKey: 'detail.ocean_temp.title',
  category: 'ocean',    // or 'biodiversity'
  icon: '',
};

let _intervals = [];
let _cacheData = null;

export async function render(blocks) {
  const { data, tier, age } = await fetchTopicData('ocean');
  // 1. Hero block
  // 2. Chart block
  // 3. Trend block
  // 4. Tiles block
  // 5. Explanation block
  // 6. Comparison block
  // 7. Sources block
}

export function getChartConfigs() {
  // Return lazy-loaded chart configs for trend charts
  return [];
}

export function cleanup() {
  _intervals.forEach(clearInterval);
  _intervals = [];
  _cacheData = null;
}
```

### Pattern 4: Hardcoded Data for Topics Without Cache (established pattern)

Multiple existing topics use hardcoded data arrays:
- `temperature.js`: NASA GISTEMP anomalies (145 entries)
- `conflicts.js`: 20 conflict countries from UCDP
- `freedom.js`: Freedom House scores (~60 countries)
- `health.js`: Causes-of-death percentages
- `crypto_sentiment.js`: Fear & Greed index (no CORS)

For Phase 10, follow this pattern for:
- **ocean_ph.js**: Hardcode pH trend 1850-2025 (~18 data points per decade)
- **ocean_plastic.js**: Hardcode GESAMP/Jambeck estimates
- **extinction.js**: Hardcode Big Five mass extinctions + current rate

### Pattern 5: Animated Counter (from population.js)

For ocean_plastic daily counter:

```javascript
// Pattern from population.js: setInterval with startOfDay epoch
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);

const dailyRate = 23_000_000; // kg/day into ocean (UNEP estimate)
const intervalId = setInterval(() => {
  const elapsed = (Date.now() - startOfDay.getTime()) / 86_400_000;
  counterEl.textContent = Math.floor(dailyRate * elapsed).toLocaleString();
}, 1000);
_intervals.push(intervalId);
```

### Pattern 6: SVG Map for Garbage Patches (from earthquake/conflict maps)

Existing pattern uses simplified continent outlines as SVG paths:

```javascript
// From earthquakes.js / conflicts.js:
// SVG viewBox with continent paths, then overlay positioned circles/markers
const svgNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(svgNS, 'svg');
svg.setAttribute('viewBox', '0 0 1000 500');
// Add continent outlines, then 5 positioned markers for garbage patches
```

### Anti-Patterns to Avoid
- **innerHTML for user-facing data**: Use DOMUtils.create() exclusively (security pattern from Phase 4)
- **Direct DOM manipulation in getChartConfigs()**: Charts in getChartConfigs are lazy-loaded; use render() for interactive elements
- **Importing main page modules into detail pages**: Copy data inline (Phase 5 decision re: NATURE_SCORE)
- **Adding new CDN dependencies**: All visualization uses existing Chart.js + SVG + DOM
- **Forgetting cleanup()**: Every setInterval MUST be tracked in _intervals array

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching with fallback | Custom fetch logic | `fetchTopicData('ocean')` | 3-tier fallback already handles all edge cases |
| Tier badge rendering | Custom badge HTML | `createTierBadge(tier, { age })` | Consistent LIVE/Cache/Static visual |
| SVG world map coloring | Custom SVG renderer | `renderChoropleth()` from `detail/utils/choropleth.js` | Handles fetch, color mapping, tooltips, legend |
| Chart creation + lifecycle | Raw Chart.js instantiation | `ensureChartJs()` + `createChart()` | Registry prevents canvas memory leaks (INFRA-05) |
| Click-through navigation | Custom click handlers | Extend STATIC_TOPIC_MAP + existing event delegation | Already handles click + keyboard + text selection guard |
| Scroll reveal animations | Custom IntersectionObserver | `class="reveal"` / `class="reveal-stagger"` | Scroll engine handles it automatically |
| i18n text | Hardcoded strings | `data-i18n` attributes + `i18n.t()` calls | DE/EN support required by DETAIL-10 |

**Key insight:** Phase 10 is purely a content phase. Zero new infrastructure is needed -- every visualization technique required (charts, SVG maps, counters, choropleths, DOM infographics) already exists in the codebase.

## Common Pitfalls

### Pitfall 1: Forgetting All Seven Registration Points
**What goes wrong:** New section renders in HTML but does not get cinematic background, nav dot, scroll progress, or particle color changes.
**Why it happens:** Seven separate files/arrays need coordinated updates for each new section.
**How to avoid:** Use the checklist from "Pattern 2" above. Verify all 7 points per new section.
**Warning signs:** Section visible but no parallax background; nav dots do not include new section; scrolling past new section does not change particle color.

### Pitfall 2: act12/act13 i18n Keys Missing for Both Languages
**What goes wrong:** German text renders but English toggle shows raw keys like "act12.title".
**Why it happens:** Adding German keys but forgetting the English `en:` section (starts at ~line 806 in i18n.js).
**How to avoid:** Always add keys to BOTH `de:` and `en:` objects simultaneously. Follow Phase 5-8 pattern of adding all i18n keys upfront in Wave 0.
**Warning signs:** Language toggle shows bracket-wrapped keys instead of text.

### Pitfall 3: New Detail Topic Modules Not in static-values.json
**What goes wrong:** When both live API and cache fail, detail page shows no data at all (blank hero).
**Why it happens:** static-values.json currently has `null` for extinction, endangered, ocean_temp, ocean_ph, ocean_plastic.
**How to avoid:** Update null entries to real fallback objects with value, year, source -- following the exact schema of existing entries.
**Warning signs:** Detail page hero shows "0" or blank when testing with network disabled.

### Pitfall 4: Section Insertion Order in index.html
**What goes wrong:** Acts render in wrong scroll order; nav dots misaligned.
**Why it happens:** Inserting new sections at wrong position in HTML. Current order: Act 11 -> Epilog. New sections go BETWEEN Act 11 and Epilog.
**How to avoid:** Insert after `</section>` closing tag of `akt-action` (line ~946) and before the Epilog comment block (line ~948).
**Warning signs:** Scrolling reaches new acts before Act 11 or after Epilog.

### Pitfall 5: ocean.json Cache Shape Assumptions
**What goes wrong:** ocean_temp module tries to access `data.sst_anomaly` but cache key is `annual_sst_anomaly`.
**Why it happens:** Guessing cache field names without checking actual JSON structure.
**How to avoid:** Actual ocean.json structure is `{ annual_sst_anomaly: [{ year, anomaly }] }`. The topic module MUST use `data.annual_sst_anomaly`. No pH or plastic fields exist in ocean.json.
**Warning signs:** Hero shows fallback static value despite cache being fresh.

### Pitfall 6: Biodiversity Cache Reuse vs. New Topics
**What goes wrong:** extinction.js and endangered.js try to fetch separate cache files that don't exist.
**Why it happens:** Assuming each topic has its own cache file. In reality, biodiversity.json contains data shared across biodiversity/extinction/endangered topics.
**How to avoid:** Both extinction.js and endangered.js should call `fetchTopicData('biodiversity')` (not 'extinction' or 'endangered'). The existing biodiversity.js already demonstrates this -- it fetches 'biodiversity' and extracts threatened_counts.
**Warning signs:** Tier 2 cache miss when it should hit; falls through to static fallback.

### Pitfall 7: Counter Cleanup on Module Unload
**What goes wrong:** ocean_plastic daily counter keeps ticking after navigating away, causing memory leak.
**Why it happens:** setInterval not cleared in cleanup().
**How to avoid:** Push every setInterval ID into `_intervals` array. cleanup() calls `clearInterval()` on each. Population.js tracks 3 independent intervals this way.
**Warning signs:** Console shows timer callbacks after navigation; increasing memory over time.

## Code Examples

### Main Page Biodiversity Section (Act 12)

```html
<section id="akt-biodiversity" class="section akt-biodiversity" data-section="akt-biodiversity" aria-label="Biodiversitaet" data-i18n-aria="act12.title">
  <div class="container section__content">
    <div class="section-header reveal">
      <span class="section-label" data-i18n="act12.label">AKT 12 -- BIODIVERSITAET</span>
      <h2 class="text-section" data-i18n="act12.title">Das Schweigen der Arten</h2>
      <p class="section-desc" data-i18n="act12.desc">Artensterben, bedrohte Spezies, das sechste Massenaussterben.</p>
    </div>

    <div class="bento-grid bento-grid--2 reveal-stagger" style="margin-top:var(--space-xl)">
      <div class="data-card data-card--featured reveal">
        <div class="data-card__header">
          <span class="data-card__label" data-i18n="act12.extinctionLabel">AUSSTERBERATE</span>
          <span class="data-card__source">IPBES</span>
        </div>
        <div class="data-card__hero">
          <span class="data-card__value" style="color:var(--danger)">1.000x</span>
        </div>
        <p class="data-card__explain" data-i18n="act12.extinctionExplain">Die aktuelle Aussterberate liegt 100-1.000x ueber dem natuerlichen Hintergrund.</p>
      </div>

      <div class="data-card reveal">
        <div class="data-card__header">
          <span class="data-card__label" data-i18n="act12.endangeredLabel">BEDROHTE ARTEN</span>
          <span class="data-card__source">IUCN/GBIF</span>
        </div>
        <div class="data-card__hero">
          <span class="data-card__value" id="bio-threatened-count" style="color:var(--warning)" data-counter data-target="129753">0</span>
        </div>
        <p class="data-card__explain" data-i18n="act12.endangeredExplain">Auf der Roten Liste der IUCN als gefaehrdet eingestuft.</p>
      </div>
    </div>
  </div>
</section>
```

### Main Page Ocean Section (Act 13)

```html
<section id="akt-oceans" class="section akt-oceans" data-section="akt-oceans" aria-label="Ozeane" data-i18n-aria="act13.title">
  <div class="container section__content">
    <div class="section-header reveal">
      <span class="section-label" data-i18n="act13.label">AKT 13 -- OZEANE</span>
      <h2 class="text-section" data-i18n="act13.title">Die Ozeane</h2>
      <p class="section-desc" data-i18n="act13.desc">SST-Anomalie, Versauerung, Plastik -- die Gesundheit unserer Meere.</p>
    </div>

    <div class="bento-grid bento-grid--3 reveal-stagger" style="margin-top:var(--space-xl)">
      <div class="data-card data-card--featured reveal">
        <div class="data-card__header">
          <span class="data-card__label" data-i18n="act13.sstLabel">SST-ANOMALIE</span>
          <span class="data-card__source">NOAA</span>
        </div>
        <div class="data-card__hero">
          <span class="data-card__value" id="sst-anomaly-value" style="color:var(--danger-light)">+0.00 C</span>
        </div>
        <p class="data-card__explain" data-i18n="act13.sstExplain">Meeresoberflaechen-Temperaturabweichung. Korallen bleichen ab +1C.</p>
      </div>

      <div class="data-card reveal">
        <div class="data-card__header">
          <span class="data-card__label" data-i18n="act13.phLabel">OZEAN-PH</span>
          <span class="data-card__source">NOAA/IPCC</span>
        </div>
        <div class="data-card__hero">
          <span class="data-card__value" style="color:#5ac8fa">8.08</span>
        </div>
        <p class="data-card__explain" data-i18n="act13.phExplain">Vorindustriell: 8.25. Jeder 0.1-Schritt = 26% saeurer.</p>
      </div>

      <div class="data-card reveal">
        <div class="data-card__header">
          <span class="data-card__label" data-i18n="act13.plasticLabel">PLASTIK IM MEER</span>
          <span class="data-card__source">GESAMP/UNEP</span>
        </div>
        <div class="data-card__hero">
          <span class="data-card__value" style="color:var(--warning)" data-counter data-target="170" data-suffix=" Mio t">0</span>
        </div>
        <p class="data-card__explain" data-i18n="act13.plasticExplain">Geschaetzte Gesamtmenge. 8-12 Mio Tonnen kommen jaehrlich dazu.</p>
      </div>
    </div>
  </div>
</section>
```

### App.js Registration Updates

```javascript
// 1. _sectionColors (constructor)
'akt-biodiversity': { r: 52, g: 199, b: 89 },    // green for nature
'akt-oceans': { r: 0, g: 122, b: 255 },           // ocean blue

// 2. _initScrollEngine sectionIds
const sectionIds = [
  'prolog', 'akt-indicator', 'akt-environment', 'akt-society',
  'akt-economy', 'akt-progress', 'akt-realtime', 'akt-momentum',
  'akt-crisis-map', 'akt-scenarios', 'akt-sources', 'akt-action',
  'akt-biodiversity', 'akt-oceans', 'epilog'
];

// 3. _initNavDots sections
{ id: 'akt-biodiversity', key: 'nav.biodiversity' },
{ id: 'akt-oceans', key: 'nav.oceans' },

// 4. STATIC_TOPIC_MAP additions
// Act 12 -- Biodiversity
{ selector: '#akt-biodiversity .data-card--featured', topic: 'extinction' },
{ selector: '#akt-biodiversity .data-card:not(.data-card--featured)', topic: 'endangered' },

// Act 13 -- Oceans
{ selector: '#akt-oceans .data-card:nth-child(1)', topic: 'ocean_temp' },
{ selector: '#akt-oceans .data-card:nth-child(2)', topic: 'ocean_ph' },
{ selector: '#akt-oceans .data-card:nth-child(3)', topic: 'ocean_plastic' },

// 5. cinematic.js SECTION_IMAGES
'akt-biodiversity': 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1920&q=80&auto=format',  // Wildlife
'akt-oceans': 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80&auto=format',         // Ocean
```

### Detail Topic Module Skeleton (ocean_temp.js)

```javascript
/* ===================================================================
   World.One 1.0 -- Ocean Temperature Topic Module (OCEAN-01)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

export const meta = {
  id: 'ocean_temp',
  titleKey: 'detail.ocean_temp.title',
  category: 'ocean',
  icon: '',
};

let _intervals = [];
let _cacheData = null;
let _choroplethCleanup = null;

// Data comes from ocean.json cache: { annual_sst_anomaly: [{ year, anomaly }] }

export async function render(blocks) {
  const { data, tier, age } = await fetchTopicData('ocean');
  _cacheData = data;

  const sstData = data?.annual_sst_anomaly || [];
  const latest = sstData.length > 0 ? sstData[sstData.length - 1] : { year: 2025, anomaly: 0.83 };

  _renderHero(blocks.hero, latest, tier, age);
  await _renderSSTChart(blocks.chart, sstData);
  // ... remaining blocks
}

export function getChartConfigs() { return []; }

export function cleanup() {
  _intervals.forEach(clearInterval);
  _intervals = [];
  _cacheData = null;
  if (_choroplethCleanup) { _choroplethCleanup(); _choroplethCleanup = null; }
}
```

## Data Inventory

### Available Cache Data

| Cache File | Key Fields | Used By |
|------------|-----------|---------|
| `data/cache/ocean.json` | `annual_sst_anomaly: [{ year, anomaly }]` (1880-2025, 146 entries) | ocean_temp.js |
| `data/cache/biodiversity.json` | `threatened_counts: { vulnerable, endangered, critically_endangered, total }` | endangered.js, extinction.js |

### Data That Must Be Hardcoded

| Topic | Data Needed | Source | Rationale |
|-------|------------|--------|-----------|
| ocean_ph | pH trend 1850-2025 (~35 data points) | NOAA PMEL | No ocean pH cache; follows temperature.js pattern |
| ocean_plastic | Total estimate: ~170M tonnes; daily input: ~23K tonnes; 5 garbage patch locations | GESAMP, Jambeck 2015, NOAA | No plastic cache; follows crypto_sentiment.js pattern |
| ocean_plastic | Decomposition times (bottle: 450yr, bag: 20yr, etc.) | NOAA Marine Debris | Static reference data |
| ocean_temp | Coral bleaching thresholds (DHW > 4 = bleaching) | NOAA Coral Reef Watch | Static scientific reference |
| ocean_temp | Regional SST anomaly by country (for choropleth) | IPCC AR6 WG1 | Same pattern as NATURE_SCORE in biodiversity.js |
| extinction | Big Five mass extinctions + current rate | IPBES 2019, Barnosky 2011 | No cache; static scientific data |
| extinction | Background rate: 0.1-1 E/MSY; current: 100-1000x | IPBES Global Assessment | Static reference |
| endangered | IUCN category counts (already in biodiversity.json) | GBIF/IUCN | Reuse biodiversity cache |

### static-values.json Updates Required

Currently null entries need real fallback values:

```json
{
  "ocean_temp": { "anomaly_c": { "value": 0.83, "year": 2025, "source": "NOAA Climate at a Glance" } },
  "ocean_ph": { "ph_current": { "value": 8.08, "year": 2024, "source": "NOAA PMEL" } },
  "ocean_plastic": { "total_mt": { "value": 170, "unit": "million tonnes", "year": 2024, "source": "GESAMP" } },
  "extinction": { "rate_multiple": { "value": 1000, "unit": "x background", "year": 2024, "source": "IPBES" } },
  "endangered": { "total_threatened": { "value": 129753, "year": 2024, "source": "IUCN/GBIF" } }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| New CDN deps for maps | Inline SVG + positioned markers | Phase 4 decision | No Leaflet/D3/Mapbox -- SVG only |
| Separate cache per topic | Shared cache files | Phase 3 design | ocean.json serves ocean_temp; biodiversity.json serves extinction + endangered |
| Live API for every data point | Hardcoded for no-CORS/no-API topics | Phase 3+ pattern | Freedom, conflicts, crypto all use hardcoded data |
| innerHTML for content | DOMUtils.create() exclusively | Phase 4 security rule | No innerHTML for any data-driven content |

## Open Questions

1. **Exact Unsplash image URLs for cinematic backgrounds**
   - What we know: Every section uses Unsplash images with `w=1920&q=80&auto=format` params
   - What's unclear: Best specific images for biodiversity (wildlife) and oceans (underwater/seascape)
   - Recommendation: Use representative images; these are aesthetic choices, not functional

2. **MAIN_INDICATOR_TOPIC_MAP entries for biodiversity/ocean**
   - What we know: The momentum section dynamically maps indicator names to topics (line ~828 in app.js)
   - What's unclear: Whether momentum indicators include biodiversity/ocean metrics
   - Recommendation: Check if world-state.json momentum.indicators includes any bio/ocean entries; if so, add mappings. If not, no action needed.

3. **Act ordering: After Act 11 or restructured numbering**
   - What we know: Requirements say "Act 12" and "Act 13"; current page ends at Act 11 + Epilog
   - Recommendation: Insert after Act 11 (akt-action), before Epilog. Acts 10 (Sources) and 11 (Action) keep their current positions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework detected) |
| Config file | none |
| Quick run command | Open index.html in browser, scroll to new sections |
| Full suite command | Manual walkthrough of all 5 success criteria |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAIN-03 | Act 12 renders with biodiversity tiles on scroll | manual | Browser scroll past Act 11 | N/A |
| MAIN-04 | Act 13 renders with ocean tiles on scroll | manual | Browser scroll past Act 12 | N/A |
| MAIN-05 | Tiles in Acts 12/13 navigate to detail pages on click | manual | Click each tile, verify URL | N/A |
| OCEAN-01 | detail/?topic=ocean_temp shows SST anomaly + choropleth + coral explainer | manual | Navigate to URL, inspect blocks | N/A |
| OCEAN-02 | detail/?topic=ocean_ph shows pH trend + scale + infographic | manual | Navigate to URL, inspect blocks | N/A |
| OCEAN-03 | detail/?topic=ocean_plastic shows estimate + counter + SVG map + decomposition | manual | Navigate to URL, verify counter ticks | N/A |
| BIO-01 | detail/?topic=extinction shows rate + mass extinction context | manual | Navigate to URL, inspect blocks | N/A |
| BIO-02 | detail/?topic=endangered shows IUCN categories with counts | manual | Navigate to URL, inspect blocks | N/A |

### Sampling Rate
- **Per task commit:** Open browser, verify changed section/module renders correctly
- **Per wave merge:** Full scroll-through of new acts + visit all 5 detail pages
- **Phase gate:** All 5 success criteria verified visually

### Wave 0 Gaps
- None -- no automated test infrastructure exists in this project; all validation is manual browser testing, consistent with Phases 1-9.

## Sources

### Primary (HIGH confidence)
- **index.html** (lines 55-970): Complete act section structure, all 13 sections + epilog
- **js/app.js** (lines 26-1518): ScrollEngine registration, sectionColors, navDots, detailLinks, STATIC_TOPIC_MAP
- **js/visualizations/cinematic.js** (lines 9-23): SECTION_IMAGES registry
- **js/i18n.js** (lines 1-807 DE, 808-1612 EN): Complete i18n key inventory
- **detail/detail-app.js** (lines 18-25): VALID_TOPICS allowlist (already includes all 5 new topics)
- **data/cache/ocean.json**: annual_sst_anomaly array structure verified
- **data/cache/biodiversity.json**: threatened_counts structure verified
- **data/fallback/static-values.json**: null placeholders for 5 new topics confirmed
- **detail/topics/biodiversity.js**: Existing topic module demonstrating DETAIL-03 contract for biodiversity data

### Secondary (MEDIUM confidence)
- **Ocean pH data**: NOAA PMEL reports pre-industrial pH ~8.25, current ~8.08; 26% acidity increase per 0.1 pH unit
- **Ocean plastic data**: GESAMP ~170M tonnes accumulated; Jambeck 2015 ~8M tonnes/year entering ocean; UNEP 2023 updated to ~11M tonnes/year
- **Extinction rate**: IPBES Global Assessment 2019 reports 100-1000x background rate
- **Garbage patch locations**: North Pacific, South Pacific, North Atlantic, South Atlantic, Indian Ocean -- well-documented by NOAA

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new libraries; all project utilities documented and verified in codebase
- Architecture: HIGH - patterns extracted directly from 9 completed phases of identical work
- Pitfalls: HIGH - based on actual codebase structure analysis (7 registration points, cache field names, cleanup patterns)
- Data availability: MEDIUM - ocean.json and biodiversity.json verified; hardcoded data values from scientific literature need verification at implementation time

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- project conventions are locked)
