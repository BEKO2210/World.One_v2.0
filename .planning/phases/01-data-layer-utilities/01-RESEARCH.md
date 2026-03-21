# Phase 1: Data Layer & Utilities - Research

**Researched:** 2026-03-21
**Domain:** Browser data fetching, fallback systems, Chart.js integration, DOM utility patterns
**Confidence:** HIGH

## Summary

Phase 1 builds shared infrastructure that all future detail pages depend on: a 3-tier data fallback system (live API -> cached JSON -> static values), a badge renderer indicating data source tier, a static fallback values file, and Chart.js lifecycle management. This is a utilities-only phase -- no detail pages, no topics, no main page changes.

The project is a vanilla JS ES6 module application (no framework, no bundler) deployed on GitHub Pages. All new utilities must follow the established pattern: named exports from `js/utils/` or `js/visualizations/`, using `DOMUtils.create()` for DOM construction, and `i18n.t()` for translatable labels. Chart.js 4.5.1 is the current stable release, loaded via CDN as a UMD bundle that auto-registers all chart types to `window.Chart`.

**Primary recommendation:** Build four independent modules (`utils/data-loader.js`, `utils/badge.js`, `utils/chart-manager.js`, `data/fallback/static-values.json`) that are completely self-contained and testable in isolation. The new `data-loader.js` must NOT touch the existing `js/data-loader.js` -- they serve parallel data systems.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- user delegated all implementation choices to Claude's discretion.

### Claude's Discretion
User reviewed all gray areas and delegated all implementation choices. Claude has full flexibility on:

**Badge design & placement:**
- Rendering approach (small chip/pill next to data values recommended -- fits dashboard aesthetic)
- Badge states: LIVE (pulsing red dot + text), Cache (gray chip, orange if >24h stale), Static (gray chip with reference year)
- Badge should be a reusable DOM element factory via utils/badge.js
- Emoji-based status indicators per PROJECT.md constraint (no icon libraries)

**Static fallback scope:**
- Build scaffold with all 28 topic keys defined but populate fully only the Phase 4 topics (co2, temperature, earthquakes, population, conflicts) with real values
- Remaining topics get placeholder structure (null values) -- filled when each topic phase is built
- This prevents blocking Phase 1 on researching 200+ data points while ensuring the file schema is complete

**Chart.js dark theme:**
- Global defaults matching existing dark aesthetic (bg: transparent, grid: rgba(255,255,255,0.08), text: rgba(255,255,255,0.7))
- Primary palette derived from existing section colors in app.js (_sectionColors)
- Dark tooltips with glass-morphism feel matching main page
- All charts rendered on transparent canvas (page background shows through)

**Data-loader architecture:**
- New utils/data-loader.js as a standalone module (not extending existing DataLoader class)
- Existing DataLoader stays untouched for main page world-state.json
- New loader: fetchWithTimeout(url, 5000) -> data/cache/{topic}.json -> data/fallback/static-values.json
- Returns { data, tier: 'live'|'cache'|'static', age?: number } so badge renderer knows which tier served

**Chart.js CDN loading:**
- jsDelivr primary, cdnjs fallback via sequential script injection
- Deferred loading -- not on page load, triggered when first chart is needed
- Chart instance registry tracks all instances for mandatory destroy() on topic cleanup/navigation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Central data-loader utility (utils/data-loader.js) with fetchWithTimeout (5s) and 3-tier fallback (live -> cache -> static) | AbortSignal.timeout() pattern verified, existing DataLoader pattern analyzed for localStorage caching, tier response shape defined |
| INFRA-02 | Badge renderer (utils/badge.js) -- LIVE pulsing red, Cache gray/orange (>24h), Static gray reference | Existing badge CSS patterns analyzed (.live-badge, .zone-badge), DOMUtils.create() factory pattern confirmed, i18n integration pattern documented |
| INFRA-03 | Static fallback values file (data/fallback/static-values.json) with value, year, source for every data point | Schema design specified, 28 topic keys with 5 fully populated (Phase 4 topics), remaining get null placeholders |
| INFRA-04 | Chart.js 4.x loaded via CDN (jsDelivr primary, cdnjs fallback) with defer and global dark-theme defaults | Chart.js 4.5.1 verified as latest, CDN URLs confirmed, UMD auto-registration verified, Chart.defaults API fully documented |
| INFRA-05 | Chart instance registry with mandatory destroy() lifecycle to prevent canvas memory leaks | Chart.destroy() API verified, Chart.getChart() static method confirmed for instance lookup, registry pattern designed |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.1 | Rich charts (line, bar, scatter, doughnut) on detail pages | 66k+ GitHub stars, ~60KB gzipped UMD bundle, auto-registers all chart types, no build step needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMUtils | (existing) | DOM element factory, IntersectionObserver wrapper | Badge rendering, lazy-load triggers |
| i18n | (existing) | DE/EN translations with dot-notation keys | Badge labels (LIVE/Cache/Static) |
| MathUtils | (existing) | clamp(), lerp() | Threshold calculations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js via CDN | npm install + bundler | Project has no bundler; CDN is the correct approach per constraints |
| AbortSignal.timeout() | setTimeout + AbortController | AbortSignal.timeout() is cleaner and fully supported since April 2024; no legacy concern |
| New data-loader module | Extending existing DataLoader class | Existing class is tightly coupled to world-state.json validation; new module avoids coupling risk |

**CDN URLs (verified):**
```
Primary:   https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js
Fallback:  https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js
```

Note: cdnjs may lag slightly behind jsDelivr on version availability (4.5.0 vs 4.5.1). This is acceptable for the fallback role.

## Architecture Patterns

### Recommended Project Structure
```
js/
  utils/
    data-loader.js      # NEW -- 3-tier fallback data fetcher (INFRA-01)
    badge.js             # NEW -- data source tier badge renderer (INFRA-02)
    chart-manager.js     # NEW -- CDN loader + instance registry + dark defaults (INFRA-04, INFRA-05)
    dom.js               # EXISTING -- unchanged
    math.js              # EXISTING -- unchanged
  data-loader.js         # EXISTING -- unchanged (main page world-state.json)
data/
  cache/                 # NEW directory -- will hold topic JSON from GitHub Actions (Phase 3)
  fallback/
    static-values.json   # NEW -- static fallback values for all topics (INFRA-03)
  processed/             # EXISTING -- unchanged
  history/               # EXISTING -- unchanged
```

### Pattern 1: 3-Tier Data Fetch with Tier Metadata
**What:** Every data request tries live API first, falls back to cached JSON, then to static values. The response always includes which tier served the data.
**When to use:** Any detail page data load.
**Example:**
```javascript
// Source: AbortSignal.timeout() (MDN), existing DataLoader._getFromCache pattern
export async function fetchTopicData(topic, apiUrl) {
  // Tier 1: Live API with 5s timeout
  if (apiUrl) {
    try {
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        _saveToCache(topic, data);
        return { data, tier: 'live', age: 0 };
      }
    } catch (err) {
      console.warn(`[DataLoader] Live fetch failed for ${topic}:`, err.message);
    }
  }

  // Tier 2: Cached JSON file
  try {
    const cacheUrl = `data/cache/${topic}.json`;
    const response = await fetch(cacheUrl);
    if (response.ok) {
      const data = await response.json();
      const age = _getCacheAge(data);
      return { data, tier: 'cache', age };
    }
  } catch (err) {
    console.warn(`[DataLoader] Cache miss for ${topic}:`, err.message);
  }

  // Tier 3: Static fallback
  const staticData = await _getStaticFallback(topic);
  return { data: staticData, tier: 'static', age: null };
}
```

### Pattern 2: Deferred CDN Script Injection
**What:** Chart.js is not loaded on page load. Instead, a loader function injects the script tag on first use, with jsDelivr primary and cdnjs fallback.
**When to use:** When first chart is needed on a detail page.
**Example:**
```javascript
// Source: Chart.js installation docs, UMD auto-registration behavior
let _chartJsLoaded = false;
let _chartJsLoading = null;

export function ensureChartJs() {
  if (_chartJsLoaded) return Promise.resolve();
  if (_chartJsLoading) return _chartJsLoading;

  _chartJsLoading = _loadScript(
    'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js'
  ).catch(() => _loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js'
  )).then(() => {
    _chartJsLoaded = true;
    _applyDarkDefaults();
  });

  return _chartJsLoading;
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

### Pattern 3: Chart Instance Registry with destroy() Lifecycle
**What:** A Map tracks all active Chart instances by canvas ID. When topic is cleaned up or user navigates away, all tracked instances are destroyed.
**When to use:** Every Chart.js instance creation and page/topic cleanup.
**Example:**
```javascript
// Source: Chart.js API docs -- Chart.destroy(), Chart.getChart()
const _instances = new Map();

export function createChart(canvasId, config) {
  // Destroy any existing chart on same canvas
  destroyChart(canvasId);

  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const chart = new Chart(ctx, config);
  _instances.set(canvasId, chart);
  return chart;
}

export function destroyChart(canvasId) {
  const existing = _instances.get(canvasId);
  if (existing) {
    existing.destroy();
    _instances.delete(canvasId);
  }
}

export function destroyAllCharts() {
  for (const [id, chart] of _instances) {
    chart.destroy();
  }
  _instances.clear();
}
```

### Pattern 4: Badge Rendering with DOMUtils.create()
**What:** A factory function that creates a badge DOM element based on the data tier and age.
**When to use:** After every data fetch, attach badge next to the data display element.
**Example:**
```javascript
// Source: existing .live-badge and .zone-badge CSS patterns in components.css
import { DOMUtils } from './dom.js';
import { i18n } from '../i18n.js';

export function createTierBadge(tier, options = {}) {
  const { age = null, year = null } = options;
  const isStale = tier === 'cache' && age !== null && age > 24 * 60 * 60 * 1000;

  const badgeClass = tier === 'live' ? 'data-badge--live'
    : isStale ? 'data-badge--stale'
    : tier === 'cache' ? 'data-badge--cache'
    : 'data-badge--static';

  const children = [];

  if (tier === 'live') {
    children.push(DOMUtils.create('span', { className: 'data-badge__dot' }));
  }

  const label = tier === 'live' ? i18n.t('badge.live')
    : tier === 'cache' ? i18n.t('badge.cache')
    : `${i18n.t('badge.static')} ${year || ''}`;

  children.push(label.trim());

  return DOMUtils.create('span', {
    className: `data-badge ${badgeClass}`,
    'aria-label': label.trim()
  }, children);
}
```

### Anti-Patterns to Avoid
- **Extending existing DataLoader class:** It validates world-state.json structure specifically. Extending it for topic data would create fragile coupling. Use a separate module.
- **Loading Chart.js at page load:** Detail pages may never need charts (if data fetch fails and shows error state). Defer loading to first use.
- **Creating Chart instances without registry:** Orphaned Chart instances leak memory. Every `new Chart()` must go through the registry.
- **Hardcoding badge labels:** All user-visible text must use i18n.t() keys for DE/EN support.
- **Using localStorage for topic cache:** The existing DataLoader uses localStorage for world-state.json. Topic data should use the file-based cache (data/cache/*.json) and the service worker's network-first strategy on `/data/` paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetch timeout | Manual setTimeout + clearTimeout + AbortController | `AbortSignal.timeout(5000)` | Built-in, cleaner, no cleanup needed, supported since April 2024 |
| DOM element creation | innerHTML or manual createElement chains | `DOMUtils.create()` | Existing pattern, XSS-safe, consistent |
| Badge pulsing animation | Custom JS animation | CSS `@keyframes livePulse` | Already exists in animations.css at line 103 |
| Script loading with fallback | XHR or fetch for scripts | Script tag injection with onload/onerror | Standard browser pattern, simplest for CDN loading |
| Chart type registration | Manual Chart.register() calls | UMD bundle auto-registration | The UMD bundle at chart.umd.min.js auto-registers all chart types, scales, elements |

**Key insight:** Chart.js UMD bundle auto-registers everything when loaded via script tag. No `Chart.register()` calls are needed -- `new Chart(ctx, config)` works immediately after script load. This is different from ESM/bundler usage where tree-shaking requires explicit registration.

## Common Pitfalls

### Pitfall 1: Chart.defaults Only Apply at Chart Creation Time
**What goes wrong:** Changing `Chart.defaults` after charts are already created does NOT retroactively update those charts. Only charts created after the defaults change pick up the new values.
**Why it happens:** Chart.js reads defaults during `new Chart()` and bakes them into the instance config. This is documented behavior (verified via GitHub issue #11910).
**How to avoid:** Call `_applyDarkDefaults()` immediately after Chart.js loads, BEFORE any chart is created. The `ensureChartJs()` function must guarantee this ordering.
**Warning signs:** Charts render with white text on dark background, or with default light grid colors.

### Pitfall 2: Canvas Memory Leaks from Orphaned Chart Instances
**What goes wrong:** Creating a new Chart on a canvas that already has one without calling `destroy()` first causes memory leaks. The old instance retains event listeners and animation frames.
**Why it happens:** Chart.js does not auto-destroy previous instances on the same canvas.
**How to avoid:** Always use the registry pattern. `createChart()` calls `destroyChart()` on the same canvas ID first. On topic navigation, call `destroyAllCharts()`.
**Warning signs:** Increasing memory usage, ghosted chart data on re-render, event handlers firing multiple times.

### Pitfall 3: CDN Script Injection Race Condition
**What goes wrong:** Multiple components request Chart.js simultaneously, causing duplicate script tags or accessing `window.Chart` before load completes.
**Why it happens:** Async script loading without proper singleton guard.
**How to avoid:** Use the `_chartJsLoading` promise singleton pattern. The first call creates the promise; subsequent calls return the same promise. The `_chartJsLoaded` boolean prevents re-injection after success.
**Warning signs:** "Chart is not defined" errors, duplicate script tags in DOM.

### Pitfall 4: Static Fallback File Growing Unbounded
**What goes wrong:** Adding every possible data point to static-values.json makes it large and hard to maintain.
**Why it happens:** Trying to populate all 28 topics in Phase 1.
**How to avoid:** Per CONTEXT.md decision: define the schema for all 28 topics but only populate the 5 Phase 4 topics (co2, temperature, earthquakes, population, conflicts). Other topics get null values -- populated when each topic phase is built.
**Warning signs:** N/A -- this is a process discipline issue.

### Pitfall 5: CORS Errors on Live API Fetches
**What goes wrong:** Browser blocks cross-origin API requests to NOAA, NASA, World Bank, etc.
**Why it happens:** Not all data APIs support CORS for browser requests.
**How to avoid:** The 3-tier fallback handles this gracefully -- CORS failure is caught in the try/catch and triggers fallback to cache. However, the data-loader should NOT log CORS errors as severe (use console.warn, not console.error). Known CORS-blocked APIs should be documented so topics don't attempt live fetch unnecessarily.
**Warning signs:** TypeError: Failed to fetch in console. This is expected and handled -- not a bug.

### Pitfall 6: Service Worker Caching Stale Chart.js CDN Response
**What goes wrong:** Service worker caches the Chart.js CDN response and serves stale version forever.
**Why it happens:** The service worker caches same-origin responses (line 80 of service-worker.js: `url.origin === self.location.origin`). CDN requests are cross-origin, so they will NOT be cached by the service worker. This is actually correct behavior -- no pitfall here, but worth documenting so no one "fixes" it.
**How to avoid:** N/A -- current service worker correctly skips cross-origin caching.
**Warning signs:** None expected.

## Code Examples

Verified patterns from official sources and existing codebase:

### Chart.js Dark Theme Global Defaults
```javascript
// Source: Chart.js docs -- Chart.defaults, colors, fonts, tooltips, legend
// Matched to existing CSS custom properties from core.css

function _applyDarkDefaults() {
  // Global colors for dark background
  Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';           // --text-secondary approx
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';    // --glass-border
  Chart.defaults.backgroundColor = 'rgba(255, 255, 255, 0.04)';// --glass-bg

  // Font matching existing design system
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"; // --font-sans
  Chart.defaults.font.size = 12;

  // Responsive defaults
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  // Tooltip -- glass-morphism style matching main page
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(18, 18, 26, 0.9)';  // --bg-secondary + alpha
  Chart.defaults.plugins.tooltip.titleColor = '#f0f0f5';                       // --text-primary
  Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255, 255, 255, 0.7)';      // --text-secondary approx
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.08)';   // --glass-border
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;

  // Legend -- match dark theme
  Chart.defaults.plugins.legend.labels.color = 'rgba(255, 255, 255, 0.7)';

  // Animations -- respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Chart.defaults.animation = false;
  }
}
```

### Section Color Palette for Charts
```javascript
// Source: existing app.js _sectionColors (lines 26-40)
// These become the default chart color palette for each topic section

export const CHART_COLORS = {
  environment: { r: 0, g: 180, b: 216 },   // #00b4d8
  society:     { r: 232, g: 168, b: 124 },  // #e8a87c
  economy:     { r: 255, g: 215, b: 0 },    // #ffd700
  progress:    { r: 0, g: 255, b: 204 },    // #00ffcc
  realtime:    { r: 255, g: 59, b: 48 },    // #ff3b30
  momentum:    { r: 90, g: 200, b: 250 },   // #5ac8fa
  crisis:      { r: 255, g: 107, b: 107 },  // #ff6b6b
};

// Helper: convert to rgba string for Chart.js
export function toRgba({ r, g, b }, alpha = 1) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

### Static Fallback JSON Schema
```json
{
  "_meta": {
    "version": "1.0.0",
    "description": "Static fallback values for detail pages when live API and cache are unavailable",
    "last_updated": "2026-03-21"
  },
  "co2": {
    "current_ppm": { "value": 427.5, "year": 2025, "source": "NOAA Mauna Loa" },
    "annual_increase": { "value": 2.4, "year": 2025, "source": "NOAA GML" }
  },
  "temperature": {
    "anomaly": { "value": 1.29, "year": 2024, "source": "NASA GISTEMP" }
  },
  "earthquakes": {
    "significant_24h": { "value": 4, "year": 2025, "source": "USGS" }
  },
  "population": {
    "total": { "value": 8100000000, "year": 2025, "source": "UN DESA" }
  },
  "conflicts": {
    "active_conflicts": { "value": 56, "year": 2024, "source": "UCDP" }
  },
  "airquality": null,
  "forests": null
}
```

### Badge CSS (New, Following Existing Patterns)
```css
/* Source: existing .live-badge and .zone-badge patterns in components.css */
/* New data-badge variants for data tier indication */

.data-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  vertical-align: middle;
}

.data-badge--live {
  background: rgba(255, 59, 48, 0.12);
  color: var(--danger);
  border: 1px solid rgba(255, 59, 48, 0.25);
}

.data-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger);
  animation: livePulse 2s ease infinite;
}

.data-badge--cache {
  background: rgba(142, 142, 147, 0.12);
  color: var(--text-secondary);
  border: 1px solid rgba(142, 142, 147, 0.25);
}

.data-badge--stale {
  background: rgba(255, 149, 0, 0.12);
  color: var(--warning-dark);
  border: 1px solid rgba(255, 149, 0, 0.25);
}

.data-badge--static {
  background: rgba(142, 142, 147, 0.12);
  color: var(--text-secondary);
  border: 1px solid rgba(142, 142, 147, 0.25);
}
```

### i18n Keys for Badges
```javascript
// Add to both DE and EN translation objects in i18n.js

// DE:
'badge.live': 'LIVE',
'badge.cache': 'Cache',
'badge.static': 'Statisch',
'badge.staleWarning': 'Daten aelter als 24h',

// EN:
'badge.live': 'LIVE',
'badge.cache': 'Cache',
'badge.static': 'Static',
'badge.staleWarning': 'Data older than 24h',
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setTimeout + AbortController for fetch timeout | AbortSignal.timeout(ms) | April 2024 (full browser support) | Cleaner code, no cleanup needed |
| Chart.js 3.x Chart.register() required | Chart.js 4.x UMD auto-registers all | Chart.js 4.0 (Feb 2023) | No manual registration needed with UMD bundle |
| Chart.js 3.x grid.borderColor | Chart.js 4.x scales.x.border.color | Chart.js 4.0 (Feb 2023) | Grid border is now separate from grid lines |
| Manual fetch + cache check | Service worker network-first for /data/ paths | Already in project | data/cache/*.json files automatically get network-first caching via existing SW |

**Deprecated/outdated:**
- `Chart.defaults.global` (Chart.js 2.x) -- now `Chart.defaults` directly
- `Chart.defaults.scale` -- now `Chart.defaults.scales` (plural)
- `gridLines` (Chart.js 2.x/3.x) -- now `grid` in Chart.js 4.x

## Open Questions

1. **Exact static fallback data values**
   - What we know: Schema is defined; 5 topics need real values (co2, temperature, earthquakes, population, conflicts)
   - What's unclear: Exact current values need research when populating the file
   - Recommendation: Use best-available public data at implementation time; document sources inline. Values are static fallbacks, so approximate correctness is fine -- they exist for when everything else fails.

2. **Chart.js version pinning strategy**
   - What we know: 4.5.1 is current on jsDelivr; cdnjs has 4.5.0
   - What's unclear: Whether to pin exact version or use semver range in CDN URL
   - Recommendation: Pin exact version (4.5.1) on jsDelivr for reproducibility. The cdnjs fallback at 4.5.0 is acceptable -- minor patch difference.

3. **Badge placement in future detail page layout**
   - What we know: Badge is a reusable DOM element factory; detail page layout is Phase 2
   - What's unclear: Exact DOM insertion point (next to value? in section header?)
   - Recommendation: Build badge.js as a pure element factory. Let Phase 2 decide placement. The factory returns a DOM element -- the caller decides where to insert it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- project has no test infrastructure |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | fetchTopicData returns { data, tier, age } through 3-tier fallback | unit | N/A -- no test framework | No |
| INFRA-01 | fetchWithTimeout aborts after 5 seconds | unit | N/A -- no test framework | No |
| INFRA-02 | createTierBadge creates correct DOM element per tier | unit | N/A -- no test framework | No |
| INFRA-02 | Stale cache (>24h) produces orange badge | unit | N/A -- no test framework | No |
| INFRA-03 | static-values.json has valid schema with all 28 topic keys | manual-only | JSON schema validation (manual) | No |
| INFRA-04 | ensureChartJs loads Chart.js and applies dark defaults | integration | Manual browser test | No |
| INFRA-04 | CDN fallback works when primary fails | integration | Manual browser test (block jsDelivr) | No |
| INFRA-05 | destroyAllCharts destroys all tracked instances | unit | N/A -- no test framework | No |
| INFRA-05 | createChart destroys existing chart on same canvas | unit | N/A -- no test framework | No |

### Sampling Rate
- **Per task commit:** Manual browser console verification (no automated tests)
- **Per wave merge:** Manual verification of all 5 INFRA requirements in browser
- **Phase gate:** All 5 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework exists -- manual browser testing is the only option for this vanilla JS project
- [ ] Consider adding a simple HTML test harness page (e.g., `test/infra-test.html`) that exercises all utilities in-browser
- [ ] JSON schema validation for static-values.json could be a Node.js script if desired

## Sources

### Primary (HIGH confidence)
- [Chart.js Official Docs - Installation](https://www.chartjs.org/docs/latest/getting-started/installation.html) - CDN setup, version info
- [Chart.js Official Docs - Configuration](https://www.chartjs.org/docs/latest/configuration/) - Chart.defaults API
- [Chart.js Official Docs - Colors](https://www.chartjs.org/docs/latest/general/colors.html) - Chart.defaults.color, backgroundColor, borderColor
- [Chart.js Official Docs - Fonts](https://www.chartjs.org/docs/latest/general/fonts.html) - Chart.defaults.font properties
- [Chart.js Official Docs - Tooltip](https://www.chartjs.org/docs/latest/configuration/tooltip.html) - Chart.defaults.plugins.tooltip namespace
- [Chart.js Official Docs - Legend](https://www.chartjs.org/docs/latest/configuration/legend.html) - Chart.defaults.plugins.legend namespace
- [Chart.js Official Docs - API](https://www.chartjs.org/docs/latest/developers/api.html) - Chart.destroy(), Chart.getChart()
- [Chart.js Official Docs - Performance](https://www.chartjs.org/docs/latest/general/performance.html) - Animation disable, decimation
- [Chart.js Official Docs - Axes Styling](https://www.chartjs.org/docs/latest/axes/styling.html) - Grid and tick color configuration
- [jsDelivr CDN package.json](https://cdn.jsdelivr.net/npm/chart.js/package.json) - Verified version 4.5.1
- [cdnjs Chart.js](https://cdnjs.com/libraries/Chart.js/) - Verified version 4.5.0, SRI hash available
- [MDN AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) - API reference
- [Can I Use AbortSignal.timeout()](https://caniuse.com/mdn-api_abortsignal_timeout_static) - Full browser support since April 2024

### Secondary (MEDIUM confidence)
- [Chart.js GitHub Issue #11910](https://github.com/chartjs/Chart.js/issues/11910) - Verified: Chart.defaults only apply at chart creation time, not retroactively
- [Chart.js GitHub Issue #8658](https://github.com/chartjs/Chart.js/issues/8658) - Dark mode discussion, confirmed no built-in dark theme

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Chart.js 4.5.1 verified directly on jsDelivr CDN, official docs confirmed all APIs
- Architecture: HIGH - Patterns derived from existing codebase analysis (DataLoader, DOMUtils, i18n, service worker, CSS) and official Chart.js documentation
- Pitfalls: HIGH - Memory leak pattern, defaults timing, CDN race condition all verified with official docs and GitHub issues

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable libraries, low churn expected)
