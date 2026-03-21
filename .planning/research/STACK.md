# Technology Stack

**Project:** World.One Detail Pages & Data Expansion
**Researched:** 2026-03-21
**Focus:** Chart.js integration, URL parameter routing, dynamic ES6 module loading, badge/status systems

## Recommended Stack

### Chart.js (CDN) -- Detail Page Charting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Chart.js | 4.4.x | Line, bar, scatter, doughnut, radar charts on detail pages | Only library needed for rich interactive charts. 60KB gzipped via CDN. Canvas-based so it complements existing SVG charts on main page without conflict. Mature, well-documented, no dependencies. |

**Confidence:** MEDIUM -- Chart.js 4.4.x is the stable v4 line. The exact latest patch (4.4.4, 4.4.6, etc.) should be verified at CDN load time. The v4 API has been stable since Chart.js 4.0 (late 2022).

**CDN Loading Strategy:**

```html
<!-- In detail/index.html <head> -- defer-loaded, not render-blocking -->
<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

Use `@4` (major version pin) rather than `@4.4.4` (exact pin). Rationale:
- Major version pin gets security patches and bug fixes automatically
- Chart.js v4 maintains backward compatibility within the major version
- CDN edge caches the resolved version, so performance is identical
- If exact pinning is needed for reproducibility, use `@4.4` (minor pin)

Do NOT use:
- `chart.js@latest` -- could break on v5 release
- `chart.js@^4.4.4` -- npm syntax, not valid for CDN URLs
- Self-hosted copy -- adds maintenance burden, loses CDN edge caching for 1M+ visitors

**Why jsDelivr over cdnjs/unpkg:**
- jsDelivr has the widest global edge network (serves from nearest PoP)
- Supports version ranges natively (`@4` resolves to latest 4.x)
- Highest uptime among JS CDNs, fallback to multiple infrastructure providers
- Already industry standard for Chart.js distribution

**CDN Fallback Pattern:**

```javascript
// utils/chart-loader.js
function ensureChartJS() {
  if (window.Chart) return Promise.resolve(window.Chart);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => {
      // Fallback CDN
      const fallback = document.createElement('script');
      fallback.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js';
      fallback.onload = () => resolve(window.Chart);
      fallback.onerror = () => reject(new Error('Chart.js failed to load'));
      document.head.appendChild(fallback);
    };
    document.head.appendChild(script);
  });
}
```

### Chart.js Configuration Defaults

| Setting | Value | Rationale |
|---------|-------|-----------|
| `responsive` | `true` | Charts resize with container. Default in Chart.js 4. |
| `maintainAspectRatio` | `false` | Detail pages control height via CSS, not chart aspect ratio. Without this, charts fight with layout. |
| `animation.duration` | `800` | Smooth but not sluggish. Default 1000ms is slightly too slow for data dashboards. |
| `plugins.legend.display` | Varies per chart | Single-dataset charts: hide legend. Multi-dataset: show legend. |
| `plugins.tooltip.enabled` | `true` | Essential for data exploration on detail pages. |
| `scales.*.grid.color` | `rgba(255,255,255,0.06)` | Matches existing `--glass-border` design token from core.css. |
| `scales.*.ticks.color` | `rgba(255,255,255,0.3)` | Matches existing `--text-muted` opacity level. |
| `elements.line.tension` | `0.3` | Slight curve, not angular. Matches the aesthetic of existing SVG line charts. |
| `elements.point.radius` | `0` (hover: `4`) | Clean lines, dots appear on hover only. |

**Confidence:** HIGH -- these are standard Chart.js 4 config options, well-documented and stable.

**Global Defaults Setup:**

```javascript
// Set once after Chart.js loads, before any chart creation
function configureChartDefaults() {
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.color = 'rgba(255,255,255,0.3)';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'SF Mono', 'Fira Code', 'Consolas', monospace";
  Chart.defaults.font.size = 11;
  Chart.defaults.animation.duration = 800;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 10, 15, 0.9)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
}
```

### Chart.js Lazy Initialization via IntersectionObserver

**Confidence:** HIGH -- IntersectionObserver is a mature Web API (baseline since 2019). Chart.js `destroy()` API is stable.

```javascript
// Pattern: lazy-init charts only when scrolled into view
function observeCharts(containerSelector) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const chartType = container.dataset.chart;
        const chartDataKey = container.dataset.key;
        initChart(container, chartType, chartDataKey);
        observer.unobserve(container); // One-shot: init once
      }
    });
  }, {
    rootMargin: '200px 0px', // Start loading 200px before visible
    threshold: 0
  });

  document.querySelectorAll(containerSelector).forEach(el => observer.observe(el));
  return observer;
}
```

**Critical Chart.js Memory Pattern -- destroy before re-init:**

```javascript
// MUST destroy old instance before creating new one on same canvas
const chartRegistry = new Map();

function initChart(container, type, dataKey) {
  const canvas = container.querySelector('canvas');
  const existingId = canvas?.id;

  // Destroy previous instance if exists
  if (existingId && chartRegistry.has(existingId)) {
    chartRegistry.get(existingId).destroy();
    chartRegistry.delete(existingId);
  }

  const chart = new Chart(canvas, { type, data: /* ... */, options: /* ... */ });
  chartRegistry.set(canvas.id, chart);
}
```

This is a **critical pitfall** -- Chart.js does not auto-destroy. Failing to call `.destroy()` before creating a new chart on the same canvas leaks memory and causes rendering glitches. With 30+ topic pages potentially having 5+ charts each, this matters.

### URL Parameter Routing (No Framework)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| URLSearchParams (Web API) | N/A (built-in) | Parse `?topic=co2&lang=de` from URL | Native browser API since 2016. Zero dependencies. Perfect for GitHub Pages single-HTML routing. |
| History API (pushState/replaceState) | N/A (built-in) | Update URL without page reload when switching topics | Keeps browser back/forward working. Essential UX for single-page detail routing. |

**Confidence:** HIGH -- URLSearchParams and History API are mature, universally supported Web APIs.

**Why NOT hash routing (`#topic`):**
- Hash fragments are not sent to server, complicating analytics and link sharing
- URLSearchParams is cleaner: `?topic=co2` reads better than `#co2`
- GitHub Pages serves `detail/index.html` for all `detail/?topic=X` requests -- no server config needed
- Hash changes don't trigger `popstate` (they trigger `hashchange`), adding complexity

**Why NOT a router library (page.js, navigo, etc.):**
- The routing need is trivial: one parameter (`topic`), one page (`detail/index.html`)
- Adding a router library for `URLSearchParams.get('topic')` is severe over-engineering
- Every router library adds weight, learning curve, and maintenance for zero benefit here

**Routing Pattern:**

```javascript
// detail/js/router.js
export class DetailRouter {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.topic = this.params.get('topic') || 'co2'; // Default topic
    this.lang = this.params.get('lang') || document.documentElement.lang || 'de';
  }

  // Navigate to different topic without page reload
  navigate(topic) {
    this.topic = topic;
    const url = new URL(window.location);
    url.searchParams.set('topic', topic);
    history.pushState({ topic }, '', url);
    // Dispatch custom event for topic modules to listen
    window.dispatchEvent(new CustomEvent('topic-change', { detail: { topic } }));
  }

  // Handle browser back/forward
  listen(callback) {
    window.addEventListener('popstate', (e) => {
      this.params = new URLSearchParams(window.location.search);
      this.topic = this.params.get('topic') || 'co2';
      callback(this.topic);
    });
  }

  // Build detail URL from main page
  static detailURL(topic, lang) {
    return `detail/?topic=${encodeURIComponent(topic)}${lang ? `&lang=${lang}` : ''}`;
  }
}
```

### Dynamic ES6 Module Loading

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Dynamic `import()` | ES2020 (built-in) | Load topic modules on demand: `import('./topics/co2.js')` | Native browser feature. No bundler needed. Only loads the JS for the current topic, not all 30+. |

**Confidence:** HIGH -- Dynamic `import()` is supported in all modern browsers (Chrome 63+, Firefox 67+, Safari 11.1+, Edge 79+). It is the standard mechanism for code splitting without a bundler.

**Why dynamic import over static import:**
- 30+ topic modules at ~5-15KB each = 150-450KB if statically imported
- Dynamic import loads only the active topic module (~5-15KB)
- Each topic module is independently cacheable by the service worker
- Reduces initial page load from ~500KB to ~60KB (Chart.js) + ~15KB (framework + active topic)

**Module Loading Pattern:**

```javascript
// detail/js/module-loader.js
const moduleCache = new Map();

export async function loadTopicModule(topic) {
  // Validate topic name (prevent path traversal)
  if (!/^[a-z_]+$/.test(topic)) {
    throw new Error(`Invalid topic: ${topic}`);
  }

  // Return cached module if already loaded
  if (moduleCache.has(topic)) {
    return moduleCache.get(topic);
  }

  try {
    const module = await import(`./topics/${topic}.js`);
    moduleCache.set(topic, module);
    return module;
  } catch (err) {
    console.error(`[ModuleLoader] Failed to load topic: ${topic}`, err);
    // Load fallback/error module
    const fallback = await import('./topics/_fallback.js');
    return fallback;
  }
}
```

**Topic Module Interface (contract all 30+ modules must follow):**

```javascript
// detail/topics/co2.js -- Example topic module
export const meta = {
  id: 'co2',
  titleKey: 'detail.co2.title',       // i18n key
  descriptionKey: 'detail.co2.desc',  // i18n key
  icon: '\ud83c\udf0d',                          // Emoji, no icon library
  color: '#ff6b6b',                    // Theme color for this topic
  sources: ['NOAA', 'Mauna Loa'],
  cachePath: 'data/cache/co2.json',    // Where GitHub Actions writes cached data
  apiEndpoint: 'https://...',          // Live API for tier-1 fetch
  apiTimeout: 5000,
  staticFallback: {                    // Tier-3: hardcoded values
    current_ppm: 426.5,
    trend: 'rising',
    annual_increase: 2.4,
    last_updated: '2026-01-01'
  }
};

export async function render(container, data, lang) {
  // Build the detail page content: hero, charts, tiles, explanation
  // Called by the detail page framework after data loading
}

export function getChartConfigs(data) {
  // Return array of Chart.js configuration objects
  return [
    { id: 'co2-trend', type: 'line', data: /* ... */, options: /* ... */ },
    { id: 'co2-emissions', type: 'bar', data: /* ... */, options: /* ... */ }
  ];
}

export function cleanup() {
  // Called when navigating away -- destroy charts, cancel timers
}
```

### 3-Tier Data Fallback System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fetch API + AbortController | Built-in | Tier 1: Live API call with 5s timeout | Native, no library needed. AbortController handles timeout cancellation cleanly. |
| fetch() for local JSON | Built-in | Tier 2: Load `data/cache/{topic}.json` pre-fetched by GitHub Actions | Same API, different URL. Cache files are updated every 6 hours by the pipeline. |
| Hardcoded JS objects | N/A | Tier 3: Static fallback values embedded in topic module | Guarantees something always renders. Values updated manually when significantly stale. |

**Confidence:** HIGH -- AbortController + fetch is the standard timeout pattern (baseline since 2019).

**Data Loader Utility:**

```javascript
// utils/data-loader.js (NEW -- extends existing DataLoader concept)
export async function fetchWithFallback(topicMeta) {
  const result = { data: null, source: 'static', timestamp: null };

  // Tier 1: Live API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), topicMeta.apiTimeout || 5000);
    const response = await fetch(topicMeta.apiEndpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      result.data = await response.json();
      result.source = 'live';
      result.timestamp = new Date().toISOString();
      return result;
    }
  } catch (err) {
    console.warn(`[DataLoader] Live API failed for ${topicMeta.id}:`, err.message);
  }

  // Tier 2: Cached JSON from GitHub Actions
  try {
    const response = await fetch(topicMeta.cachePath);
    if (response.ok) {
      const cached = await response.json();
      result.data = cached.data || cached;
      result.source = 'cache';
      result.timestamp = cached.meta?.timestamp || cached.timestamp || null;
      return result;
    }
  } catch (err) {
    console.warn(`[DataLoader] Cache failed for ${topicMeta.id}:`, err.message);
  }

  // Tier 3: Static fallback values from topic module
  result.data = topicMeta.staticFallback;
  result.source = 'static';
  result.timestamp = topicMeta.staticFallback?.last_updated || null;
  return result;
}
```

### Badge / Status Indicator System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Emoji badges | N/A | Visual indicators: LIVE / Cached / Static / Stale | Project constraint: no icon libraries. Emojis render consistently on all platforms. Zero bytes added. |
| CSS custom properties | Built-in | Badge theming via `--badge-color` | Extends existing design system in `core.css`. |

**Confidence:** HIGH -- This is pure CSS + HTML, no external dependencies.

**Badge Specifications:**

| Data Source | Badge | Color | Emoji | Meaning |
|-------------|-------|-------|-------|---------|
| Live API (< 1 hour old) | `LIVE` | `--success` (#34c759) | `\ud83d\udfe2` | Fresh from API |
| Cache (< 24 hours old) | `Cache` | `--progress` (#00d4ff) | `\ud83d\udd35` | Recent cached data |
| Cache (> 24 hours old) | `Stale` | `--warning` (#ffcc00) | `\ud83d\udfe1` | Cached but aging |
| Static fallback | `Static` | `--text-muted` (#5a5a65) | `\u26aa` | Hardcoded baseline |
| Failed all tiers | `Offline` | `--danger` (#ff3b30) | `\ud83d\udd34` | No data available |

**Badge Renderer:**

```javascript
// utils/badge.js
export function renderBadge(source, timestamp) {
  const age = timestamp ? Date.now() - new Date(timestamp).getTime() : Infinity;
  const HOUR = 3600000;

  let label, emoji, cssClass;

  switch (source) {
    case 'live':
      label = 'LIVE';
      emoji = '\ud83d\udfe2';
      cssClass = 'badge--live';
      break;
    case 'cache':
      if (age > 24 * HOUR) {
        label = 'Stale';
        emoji = '\ud83d\udfe1';
        cssClass = 'badge--stale';
      } else {
        label = 'Cache';
        emoji = '\ud83d\udd35';
        cssClass = 'badge--cache';
      }
      break;
    case 'static':
      label = 'Static';
      emoji = '\u26aa';
      cssClass = 'badge--static';
      break;
    default:
      label = 'Offline';
      emoji = '\ud83d\udd34';
      cssClass = 'badge--offline';
  }

  return `<span class="data-badge ${cssClass}">${emoji} ${label}</span>`;
}
```

### Skeleton Loaders

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `@keyframes` + placeholder divs | Built-in | Show pulsing placeholder shapes while charts/data load | Prevents layout shift (CLS). Matches existing animation patterns in `animations.css`. No JavaScript needed for the skeleton itself. |

**Confidence:** HIGH -- CSS-only skeleton loaders are standard practice.

```css
/* Skeleton shimmer for chart containers */
.chart-skeleton {
  background: var(--glass-bg);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  min-height: 200px;
}

.chart-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.04) 50%,
    transparent 100%
  );
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Print CSS

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@media print` stylesheet | Built-in | Printable detail pages | PROJECT.md lists print CSS as a requirement. Dark backgrounds invert to white. Charts render as static canvas snapshots. |

**Confidence:** HIGH -- Standard CSS, no libraries needed.

### Web Share API

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `navigator.share()` | Built-in | "Share this page" button on detail pages | Native sharing on mobile (iOS, Android). Falls back to clipboard copy on desktop. |

**Confidence:** HIGH -- navigator.share() is well-supported on mobile. Desktop support varies but the fallback (clipboard) is trivial.

```javascript
async function shareDetail(topic, title) {
  const url = window.location.href;
  if (navigator.share) {
    await navigator.share({ title, url });
  } else {
    await navigator.clipboard.writeText(url);
    // Show "Link copied" toast
  }
}
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Charting | Chart.js 4 via CDN | D3.js | PROJECT.md explicitly rules out D3.js. Too heavy (240KB), steep learning curve, overkill for standard chart types. |
| Charting | Chart.js 4 via CDN | Apache ECharts | 800KB+ min bundle. Massive overkill. Designed for enterprise dashboards with hundreds of data points. |
| Charting | Chart.js 4 via CDN | Plotly.js | 3.5MB unminified. Absolutely not for a static site with 1M visitors. |
| Charting | Chart.js 4 via CDN | Lightweight alternatives (uPlot, frappe-charts) | Fewer chart types. uPlot only does time-series. Frappe has tiny community. Chart.js ecosystem (plugins, docs, community) is unmatched. |
| Routing | URLSearchParams | page.js / navigo / router5 | Over-engineering. One URL parameter does not justify a routing library. |
| Routing | URLSearchParams | Hash routing (#topic) | Worse for analytics, SEO, and link sharing. URLSearchParams is cleaner. |
| Module loading | Dynamic import() | RequireJS | Dead technology. Dynamic import() is the native standard. |
| Module loading | Dynamic import() | Webpack/Vite code splitting | Project is bundler-free by design. Dynamic import() works natively in browsers. Adding a bundler violates the project's architecture. |
| Data fallback | Custom 3-tier fetch | SWR / React Query / TanStack Query | Framework-specific libraries. This project is vanilla JS. The fallback logic is ~40 lines, not worth a dependency. |
| Status badges | Emoji + CSS | Font Awesome / Material Icons | PROJECT.md explicitly prohibits icon libraries. Emojis work everywhere, cost zero bytes. |
| Skeleton loaders | CSS @keyframes | react-loading-skeleton / similar | Framework-specific. CSS-only skeletons are simpler, lighter, and sufficient. |
| Maps | Extend existing maps.js (SVG) | Leaflet / Mapbox | PROJECT.md explicitly rules these out. Existing SVG map infrastructure works. |

## Chart.js Plugins -- Use Sparingly

| Plugin | Use When | CDN URL | Size |
|--------|----------|---------|------|
| chartjs-plugin-datalabels | Labels directly on bars/points (not tooltip) | `cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2` | ~7KB gzipped |
| chartjs-chart-treemap | Treemap charts (wealth distribution, etc.) | `cdn.jsdelivr.net/npm/chartjs-chart-treemap@2` | ~8KB gzipped |

**Do NOT add plugins speculatively.** Start with base Chart.js. Add a plugin only when a specific topic module needs a chart type or feature that base Chart.js cannot provide. Each plugin is another CDN request.

**Confidence:** MEDIUM -- Plugin version numbers (`@2`) are approximate. Verify at implementation time.

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| D3.js | Explicitly excluded in PROJECT.md. Too heavy for the use cases here. |
| React / Vue / Svelte / any framework | Project is vanilla JS. Framework migration is not in scope and would be a rewrite. |
| Webpack / Vite / Rollup / any bundler | Project is bundler-free. Dynamic import() provides code splitting natively. |
| Tailwind CSS / Bootstrap | Project has a mature custom CSS design system. Adding a utility framework would clash. |
| Font Awesome / Material Icons / Heroicons | Emojis only, per PROJECT.md constraint. |
| Leaflet / Mapbox / Google Maps | Excluded in PROJECT.md. Extend existing SVG maps. |
| Axios / ky / got (frontend) | Fetch API is sufficient. No need for an HTTP client library. |
| Moment.js / date-fns / Luxon | `Date.toLocaleString()` with locale parameter handles all date formatting (already used in existing DataLoader). |
| lodash / underscore | Existing `MathUtils` and `DOMUtils` cover all needed utilities. |
| TypeScript | Existing codebase is JS. Migration would be out of scope. |

## Browser Compatibility Targets

| Feature | Required | Baseline Since | Notes |
|---------|----------|----------------|-------|
| ES6 Modules (static import/export) | Yes (existing) | 2018 | Already used throughout codebase |
| Dynamic import() | Yes (new) | 2020 | Chrome 63, Firefox 67, Safari 11.1 |
| IntersectionObserver | Yes (new) | 2019 | Already used in DOMUtils.observe() |
| URLSearchParams | Yes (new) | 2016 | Universal support |
| AbortController | Yes (new) | 2019 | For fetch timeout in data loader |
| CSS Custom Properties | Yes (existing) | 2017 | Already used extensively |
| navigator.share() | Optional | 2021 (mobile) | Falls back to clipboard copy |
| ResizeObserver | Recommended | 2020 | For responsive chart container monitoring |

**Minimum browser target:** Same as existing site -- any browser supporting ES6 modules (roughly 2018+). The new APIs (dynamic import, AbortController) have the same or wider support.

## Installation

```bash
# No npm install for frontend -- CDN only
# Chart.js loaded via <script defer> in detail/index.html

# For the data pipeline (already installed):
npm install  # rss-parser, xml2js (existing dependencies)
```

**Frontend has zero new npm dependencies.** Everything is either a built-in Web API or loaded via CDN. This matches the existing project constraint: "No new dependencies: Chart.js via CDN only (no npm install for frontend)."

## File Structure for New Stack Components

```
detail/
  index.html              # Single detail page with Chart.js CDN script
  css/
    detail.css            # Detail page styles (extends core.css variables)
    detail-print.css      # @media print styles
  js/
    detail-app.js         # Detail page controller (entry point)
    router.js             # URL parameter routing
    module-loader.js      # Dynamic import() wrapper with validation
    topics/
      _template.js        # Topic module template/interface
      _fallback.js        # Error/404 topic fallback
      co2.js              # One file per topic
      temperature.js
      ... (30+ modules)

utils/                    # Shared between main page and detail pages
  data-loader.js          # Extended with fetchWithFallback()
  badge.js                # Badge renderer (new)
  chart-helpers.js        # Chart.js utility functions (new)

data/
  cache/                  # GitHub Actions writes per-topic cache files
    co2.json
    temperature.json
    ...
  fallback/
    static-values.json    # Tier-3 static fallback values for all topics
```

## Sources

- Chart.js official documentation: https://www.chartjs.org/docs/latest/ (version and API details based on training data, version should be verified at implementation)
- URLSearchParams API: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams (stable Web API, HIGH confidence)
- Dynamic import() specification: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import (stable ES2020 feature, HIGH confidence)
- IntersectionObserver API: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver (stable Web API, HIGH confidence)
- AbortController API: https://developer.mozilla.org/en-US/docs/Web/API/AbortController (stable Web API, HIGH confidence)
- Existing codebase analysis: `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`
- Project requirements: `.planning/PROJECT.md`

**Note:** WebSearch and WebFetch were unavailable during this research. Chart.js exact version number (4.4.x) is based on training data through mid-2025 and should be verified at CDN load time. All Web API recommendations are based on mature, stable specifications with HIGH confidence.

---

*Stack research: 2026-03-21*
