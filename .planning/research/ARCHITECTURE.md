# Architecture Patterns

**Domain:** Data dashboard detail page system (extending static-file vanilla JS dashboard)
**Researched:** 2026-03-21

## Recommended Architecture

The detail page system layers on top of the existing World.One architecture without modifying any existing files. It introduces five new subsystems: a URL parameter router, a dynamic module loader, a 3-tier data fallback layer, a Chart.js lifecycle manager, and extended GitHub Actions cache collection. All communication between subsystems flows through well-defined boundaries.

### System Diagram

```
MAIN PAGE (index.html)                    DETAIL PAGE (detail/index.html)
  |                                         |
  | onclick → window.location =             | URL: ?topic=co2
  | "detail/?topic=co2"                     |
  |                                         v
  |                                    +-----------+
  |                                    |  Router   |  (reads ?topic param)
  |                                    +-----+-----+
  |                                          |
  |                                          v
  |                                    +-----------+
  |                                    | Module    |  (dynamic import()
  |                                    | Loader    |   detail/topics/{topic}.js)
  |                                    +-----+-----+
  |                                          |
  |                           +--------------+---------------+
  |                           |              |               |
  |                           v              v               v
  |                      +---------+   +-----------+   +-----------+
  |                      | Data    |   | Chart.js  |   | Layout    |
  |                      | Layer   |   | Manager   |   | Renderer  |
  |                      | (3-tier)|   | (lifecycle|   | (hero,    |
  |                      |         |   |  + lazy)  |   |  tiles,   |
  |                      +---------+   +-----------+   |  sources) |
  |                           |                        +-----------+
  |                           v
  |                 +-------------------+
  |                 |  live API         |
  |                 |  data/cache/*.json|
  |                 |  static fallback  |
  |                 +-------------------+
  |
  +--- world-state.json (UNCHANGED, main page only)
```

### Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| **Router** | Parse `?topic=` URL param, validate topic name, dispatch to loader | `detail/js/router.js` | Module Loader (passes topic ID) |
| **Module Loader** | Dynamic `import()` of topic module, error handling for missing modules | `detail/js/module-loader.js` | Router (receives topic), Topic Modules (loads them) |
| **Topic Modules** | Define data sources, chart configs, layout content for one topic | `detail/topics/{topic}.js` | Module Loader (exports config), Data Layer (requests data), Chart Manager (provides chart specs) |
| **Data Layer** | 3-tier fetch: live API -> cached JSON -> static fallback | `detail/js/data-layer.js` | Topic Modules (receives URLs), Badge Renderer (reports source tier) |
| **Chart Manager** | Load Chart.js CDN, create/destroy instances, lazy-load via IntersectionObserver | `detail/js/chart-manager.js` | Topic Modules (receives chart specs), DOM (renders canvases) |
| **Layout Renderer** | Build page sections: hero, chart area, context tiles, explanation, comparison, sources | `detail/js/layout.js` | Topic Modules (receives section content), i18n (translates labels) |
| **Badge Renderer** | Show LIVE/Cache/Static status badges with emoji indicators | `detail/js/badge.js` | Data Layer (receives tier info), DOM (renders badges) |
| **Service Worker** | Extended caching for detail page assets + data/cache/ files | `service-worker.js` (modified) | Browser cache API |

### Data Flow

**User Navigation (Main Page -> Detail Page):**

```
1. User clicks data point on main page (e.g., CO2 value)
   Main page JS: window.location.href = 'detail/?topic=co2'

2. detail/index.html loads
   - Shared CSS loads (core.css, components.css)
   - detail/css/detail.css loads (detail-specific styles)
   - <script type="module" src="detail/js/router.js"></script> runs

3. Router reads URLSearchParams
   const topic = new URLSearchParams(location.search).get('topic')
   Validates against KNOWN_TOPICS set
   If invalid → renders 404-style "topic not found" with back link

4. Module Loader invoked
   const module = await import(`../topics/${topic}.js`)
   module.default must export: { meta, dataSources, charts, layout }

5. Layout Renderer builds page skeleton
   Hero section with topic title, subtitle, icon (from meta)
   Chart containers with skeleton loaders (empty canvases)
   Context tiles, explanation blocks, comparison section, source links

6. Data Layer fetches data for each data source
   For each source in module.dataSources:
     Tier 1 (LIVE):   fetch(source.liveUrl, { timeout: 5000 })
     Tier 2 (CACHE):  fetch(`data/cache/${source.cacheFile}`)
     Tier 3 (STATIC): import from data/fallback/static-values.json
   Badge rendered next to each value showing source tier

7. Chart Manager renders charts
   Waits for Chart.js CDN script to load (deferred <script>)
   IntersectionObserver watches chart containers
   When container enters viewport:
     Creates Chart.js instance with topic's chart config + fetched data
     Stores reference in WeakMap keyed to canvas element

8. User navigates away or to another topic
   Chart Manager: destroy() all active Chart.js instances
   DOM: innerHTML cleared
   If navigating to another topic → repeat from step 3 (no page reload needed)
```

**Data Collection (GitHub Actions -> Cache Files):**

```
1. Existing pipeline runs: collect -> process -> world-state.json (UNCHANGED)

2. NEW separate workflow jobs run with staggered cron:
   Job: cache-co2        (cron: '15 */6 * * *')  → data/cache/co2.json
   Job: cache-temperature (cron: '20 */6 * * *')  → data/cache/temperature.json
   Job: cache-biodiversity (cron: '25 */6 * * *') → data/cache/biodiversity.json
   ...etc, each offset by 5 minutes

3. Each job:
   - Fetches topic-specific API endpoints
   - Writes to data/cache/{topic}.json
   - Updates data/cache/meta.json with timestamps
   - Commits only its own file (avoids merge conflicts)
   - continue-on-error: true (never blocks deployment)
   - timeout-minutes: 10

4. meta.json tracks freshness:
   {
     "co2": { "updated": "2026-03-21T12:15:00Z", "status": "ok" },
     "temperature": { "updated": "2026-03-21T12:20:00Z", "status": "ok" }
   }
```

## Patterns to Follow

### Pattern 1: URL Parameter Router (No History API Needed)

**What:** A minimal router that reads `?topic=X` from the URL and loads the corresponding module. No pushState, no History API, no hash routing. Each topic is a full page load via standard `<a href>` links. This keeps GitHub Pages compatibility perfect and avoids all SPA routing complexity on a static host.

**When:** Always. This is the entry point for all detail pages.

**Why this over hash routing or History API:**
- GitHub Pages returns 404 for paths like `/detail/co2` unless you have actual files there
- Hash routing (`#co2`) breaks graceful fallback and does not work well with service workers
- URL parameters (`?topic=co2`) work with any static host, need no server config, and preserve browser back/forward naturally
- Parameter-based routing is the simplest pattern that fully works on GitHub Pages

**Example:**

```javascript
// detail/js/router.js
const KNOWN_TOPICS = new Set([
  'co2', 'temperature', 'biodiversity', 'airquality', 'forests',
  'renewables', 'population', 'conflicts', 'health', 'freedom',
  'inequality', 'poverty', 'currencies', 'science', 'internet',
  'space', 'earthquakes', 'weather', 'solar', 'crypto_sentiment',
  'momentum_detail', 'hunger', 'disasters', 'ocean_temp',
  'ocean_ph', 'ocean_plastic', 'extinction', 'endangered'
]);

export function resolveRoute() {
  const params = new URLSearchParams(window.location.search);
  const topic = params.get('topic');

  if (!topic || !KNOWN_TOPICS.has(topic)) {
    return { valid: false, topic: null, error: 'unknown_topic' };
  }

  return { valid: true, topic };
}
```

### Pattern 2: Dynamic ES6 Module Loading with Registry

**What:** Each topic is an ES6 module at `detail/topics/{topic}.js` that exports a standard configuration object. The module loader uses `import()` to dynamically load only the requested topic.

**When:** After the router resolves a valid topic.

**Why dynamic import() over loading all modules:**
- 28+ topic modules would be 200KB+ if loaded upfront
- `import()` is natively supported in all modern browsers (no bundler needed)
- Each topic loads only when requested (typically 3-8KB per module)
- Failed imports can be caught and render a graceful error

**Example:**

```javascript
// detail/js/module-loader.js
const moduleCache = new Map();

export async function loadTopicModule(topicId) {
  if (moduleCache.has(topicId)) {
    return moduleCache.get(topicId);
  }

  try {
    const module = await import(`../topics/${topicId}.js`);
    const config = module.default;

    // Validate module contract
    if (!config.meta || !config.dataSources || !config.charts) {
      throw new Error(`Topic module "${topicId}" missing required exports`);
    }

    moduleCache.set(topicId, config);
    return config;
  } catch (err) {
    if (err.message?.includes('Failed to fetch') || err instanceof TypeError) {
      throw new Error(`Topic module "${topicId}" not found`);
    }
    throw err;
  }
}
```

**Topic module contract:**

```javascript
// detail/topics/co2.js
export default {
  meta: {
    id: 'co2',
    icon: '\u{1F32B}\u{FE0F}',
    titleKey: 'detail.co2.title',       // i18n key
    subtitleKey: 'detail.co2.subtitle',
    color: '#ff6b35',
    relatedTopics: ['temperature', 'renewables', 'forests']
  },
  dataSources: [
    {
      id: 'mauna_loa',
      liveUrl: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv',
      liveParser: 'csv',                // how to parse the live response
      cacheFile: 'co2.json',            // data/cache/co2.json
      staticKey: 'co2.current_ppm',     // key in static-values.json
      label: { de: 'CO2-Konzentration', en: 'CO2 Concentration' },
      unit: 'ppm'
    }
  ],
  charts: [
    {
      id: 'keeling-curve',
      type: 'line',
      dataSource: 'mauna_loa',
      options: {
        xField: 'year', yField: 'value',
        color: '#ff6b35', fill: true,
        titleKey: 'detail.co2.keeling_title'
      }
    },
    {
      id: 'emissions-by-country',
      type: 'bar',
      dataSource: 'emissions_country',
      options: { horizontal: true, top: 10, titleKey: 'detail.co2.emissions_title' }
    }
  ],
  layout: {
    sections: ['hero', 'charts', 'context', 'explanation', 'comparison', 'sources']
  }
};
```

### Pattern 3: 3-Tier Data Fallback with Badge Reporting

**What:** Every data fetch attempts three sources in order: live API, cached JSON (from GitHub Actions), static fallback values. Each result is tagged with its source tier so the UI can display a badge.

**When:** For every data request on detail pages. The main page world-state.json pipeline is completely unaffected.

**Why three tiers instead of two:**
- Live APIs have 5-second timeout and may fail (rate limits, downtime, CORS)
- Cached JSON from GitHub Actions is updated every 6 hours -- reliable but not real-time
- Static fallback values guarantee the page never shows empty/broken content
- The badge system makes data freshness transparent to users

**Example:**

```javascript
// detail/js/data-layer.js
const TIERS = { LIVE: 'live', CACHE: 'cache', STATIC: 'static' };
const LIVE_TIMEOUT = 5000;

export async function fetchWithFallback(source) {
  // Tier 1: Live API
  if (source.liveUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT);
      const response = await fetch(source.liveUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await parseResponse(response, source.liveParser);
      return { data, tier: TIERS.LIVE, timestamp: new Date().toISOString() };
    } catch (err) {
      console.warn(`[DataLayer] Live fetch failed for ${source.id}:`, err.message);
    }
  }

  // Tier 2: Cached JSON (from GitHub Actions)
  if (source.cacheFile) {
    try {
      const response = await fetch(`../data/cache/${source.cacheFile}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cached = await response.json();
      return { data: cached.data, tier: TIERS.CACHE, timestamp: cached.updated };
    } catch (err) {
      console.warn(`[DataLayer] Cache fetch failed for ${source.id}:`, err.message);
    }
  }

  // Tier 3: Static fallback
  if (source.staticKey) {
    const staticValues = await getStaticValues();
    const value = resolveKey(staticValues, source.staticKey);
    if (value !== undefined) {
      return { data: value, tier: TIERS.STATIC, timestamp: null };
    }
  }

  return { data: null, tier: null, timestamp: null };
}
```

### Pattern 4: Chart.js Lifecycle Management

**What:** A central manager that tracks all Chart.js instances via a WeakMap keyed on canvas elements, destroys them before re-creation, and lazy-loads charts via IntersectionObserver.

**When:** On every detail page load. Charts are created as they scroll into view and destroyed on topic navigation.

**Why this is critical:**
- Chart.js stores global state per canvas. Creating a new chart on an existing canvas without destroying the old one causes "Canvas is already in use" errors and memory leaks.
- Detail pages can have 5+ charts. Loading all immediately on a mobile device wastes bandwidth and blocks the main thread.
- IntersectionObserver ensures charts render only when visible, with skeleton loaders as placeholders.

**Example:**

```javascript
// detail/js/chart-manager.js
const instances = new WeakMap();
const allCanvases = new Set();
let observer = null;
let chartJsReady = false;

export const ChartManager = {
  async init() {
    // Wait for Chart.js CDN to load
    if (typeof Chart === 'undefined') {
      await this._loadChartJs();
    }
    chartJsReady = true;
    this._setupObserver();
  },

  _loadChartJs() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof Chart !== 'undefined') { resolve(); return; }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Chart.js CDN failed to load'));
      document.head.appendChild(script);
    });
  },

  _setupObserver() {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const canvas = entry.target;
          const config = canvas.__chartConfig;
          if (config && !instances.has(canvas)) {
            this._create(canvas, config);
          }
        }
      });
    }, { rootMargin: '100px' }); // Pre-load 100px before viewport
  },

  register(canvas, config) {
    canvas.__chartConfig = config;
    allCanvases.add(canvas);
    if (observer) observer.observe(canvas);
  },

  _create(canvas, config) {
    // Always destroy existing instance first
    this.destroyOne(canvas);

    const ctx = canvas.getContext('2d');
    const instance = new Chart(ctx, config);
    instances.set(canvas, instance);
  },

  destroyOne(canvas) {
    const existing = instances.get(canvas);
    if (existing) {
      existing.destroy();
      instances.delete(canvas);
    }
  },

  destroyAll() {
    allCanvases.forEach(canvas => {
      this.destroyOne(canvas);
      if (observer) observer.unobserve(canvas);
    });
    allCanvases.clear();
  }
};
```

### Pattern 5: Service Worker Extension for Detail Pages

**What:** The existing service worker is extended to handle detail page assets and cache files, with distinct caching strategies for each type.

**When:** Applied once during the service worker update for the detail pages milestone.

**Why extend rather than add a second service worker:**
- A service worker's scope covers a path prefix. Having two workers for `/` and `/detail/` creates scope conflicts.
- The existing worker already has the right pattern (network-first for data, cache-first for assets). Detail pages just need more paths added to each strategy.

**Example additions:**

```javascript
// service-worker.js — EXTENDED (additions shown, existing code unchanged)

const CACHE_NAME = 'worldone-v2'; // bump version on detail page release

// Add detail page assets to precache
const PRECACHE_ASSETS = [
  // ... existing 22 files unchanged ...
  './detail/index.html',
  './detail/css/detail.css',
  './detail/js/router.js',
  './detail/js/module-loader.js',
  './detail/js/data-layer.js',
  './detail/js/chart-manager.js',
  './detail/js/layout.js',
  './detail/js/badge.js'
  // Topic modules NOT precached — loaded on demand
];

// Extend data paths for network-first strategy
const DATA_PATHS = [
  '/world-state.json', '/manifest.json', '/data/',
  '/data/cache/',       // detail page cached data
  '/data/fallback/'     // static fallback values
];
```

### Pattern 6: Staggered GitHub Actions for Cache Files

**What:** Separate lightweight workflow jobs for each topic's data collection, offset by 5-minute cron intervals, each writing to a single file in `data/cache/`.

**When:** Runs alongside the existing 6-hour pipeline, but staggered to avoid API rate limits.

**Why separate jobs instead of one big job:**
- One failed API must not block other topics from updating
- Staggered timing prevents hitting rate limits on shared APIs (World Bank)
- Each job commits only its own cache file, avoiding git merge conflicts
- Individual job logs make debugging specific API failures easy
- `continue-on-error: true` per job means deployment never blocks

**Example workflow structure:**

```yaml
# .github/workflows/cache-detail-data.yml
name: Detail Pages — Cache Data

on:
  schedule:
    - cron: '15 */6 * * *'  # Starts 15min after main pipeline
  workflow_dispatch: {}

jobs:
  cache-co2:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node scripts/cache-topics.js co2
      - run: |
          git config user.name "World.One Pipeline"
          git config user.email "pipeline@world.one"
          git add data/cache/co2.json data/cache/meta.json
          git diff --staged --quiet || git commit -m "cache: update co2 data"
          git push || true

  cache-temperature:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    continue-on-error: true
    needs: cache-co2  # Sequential to avoid git push conflicts
    steps:
      - uses: actions/checkout@v4
      # ... same pattern ...
```

**Alternative: matrix strategy** (more elegant for 28 topics):

```yaml
jobs:
  cache-topic:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    continue-on-error: true
    strategy:
      max-parallel: 1           # Sequential to avoid push conflicts
      fail-fast: false
      matrix:
        topic: [co2, temperature, biodiversity, airquality, forests,
                renewables, population, conflicts, health, freedom,
                inequality, poverty, currencies, science, internet,
                space, earthquakes, weather, solar, crypto_sentiment,
                hunger, disasters, ocean_temp, ocean_ph, ocean_plastic,
                extinction, endangered]
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 1 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci || npm install
      - run: node scripts/cache-topics.js ${{ matrix.topic }}
      - run: |
          git pull --rebase origin master || true
          git config user.name "World.One Pipeline"
          git config user.email "pipeline@world.one"
          git add data/cache/${{ matrix.topic }}.json data/cache/meta.json
          git diff --staged --quiet || git commit -m "cache: update ${{ matrix.topic }}"
          git push || true
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Mutable Chart.js Instances

**What:** Reusing a Chart.js instance by calling `.update()` when switching topics, instead of destroying and recreating.
**Why bad:** Chart.js dataset mutations accumulate garbage. Switching from a line chart to a bar chart on the same canvas without destroy() causes rendering artifacts, phantom datasets, and eventually "maximum call stack exceeded" crashes.
**Instead:** Always call `chart.destroy()` before creating a new chart on any canvas. The ChartManager pattern above enforces this via WeakMap tracking.

### Anti-Pattern 2: Single Monolith Data Fetch

**What:** Loading all 28 topics' data at once or having one giant `detail-data.json` file.
**Why bad:** A user viewing the CO2 page downloads 500KB+ of data for 27 topics they do not need. Wastes bandwidth, increases load time, and makes GitHub Actions commits enormous.
**Instead:** Each topic has its own cache file (`data/cache/co2.json`, `data/cache/temperature.json`). The data layer fetches only what the current topic needs.

### Anti-Pattern 3: History API Routing on GitHub Pages

**What:** Using `history.pushState()` with clean URLs like `/detail/co2` and a 404.html redirect hack.
**Why bad:** GitHub Pages does not support server-side rewrites. The 404.html trick causes a flash of 404 content, breaks service worker caching expectations, and confuses search engines. It also requires a meta refresh or JS redirect that adds 200-500ms latency.
**Instead:** Use `?topic=co2` URL parameters. They work natively on any static host, preserve browser history without hacks, and the service worker handles them correctly.

### Anti-Pattern 4: Loading Chart.js in Main Page

**What:** Adding the Chart.js CDN `<script>` to `index.html` or precaching it in the service worker for the main page.
**Why bad:** The main page uses custom SVG charts. Loading Chart.js (60KB gzipped) on the main page wastes bandwidth for 100% of visitors when only detail page visitors need it. Violates the "no new dependencies on main page" constraint.
**Instead:** Chart.js `<script>` appears only in `detail/index.html` with `defer` attribute. It loads only when a user navigates to a detail page.

### Anti-Pattern 5: Topic Modules Importing Each Other

**What:** Having `co2.js` import from `temperature.js` because they share some data transformation logic.
**Why bad:** Creates dependency chains. Loading one topic pulls in others. If `temperature.js` has a bug, it breaks `co2.js`. Module loading becomes unpredictable.
**Instead:** Shared logic goes in utility files (`detail/js/data-transforms.js`, `detail/js/chart-helpers.js`). Topic modules import only from utilities, never from each other.

### Anti-Pattern 6: Modifying world-state.json Pipeline

**What:** Adding detail page data to the existing `scripts/process-data.js` output.
**Why bad:** The world-state.json file is the lifeblood of the main page serving 1M+ visitors. Any change risks breaking the main page. The file is already ~110KB; adding 28 topics' detailed data would balloon it to 500KB+.
**Instead:** Parallel data system. Main page keeps `data/processed/world-state.json` unchanged. Detail pages use `data/cache/{topic}.json` files collected by a separate workflow.

## File System Layout

```
World_report/
  index.html                          # Main page (UNCHANGED)
  js/                                 # Main page JS (UNCHANGED)
  css/                                # Main page CSS (UNCHANGED)
  data/
    processed/
      world-state.json                # Main page data (UNCHANGED)
    cache/                            # NEW: detail page cached data
      meta.json                       #   Pipeline health metadata
      co2.json                        #   Per-topic cache files
      temperature.json
      ...28 total
    fallback/                         # NEW: static fallback values
      static-values.json              #   Guaranteed-available defaults
  detail/                             # NEW: entire detail page system
    index.html                        #   Single entry point
    css/
      detail.css                      #   Detail-page-specific styles
    js/
      router.js                       #   URL parameter routing
      module-loader.js                #   Dynamic import() orchestration
      data-layer.js                   #   3-tier fetch with fallback
      chart-manager.js                #   Chart.js lifecycle + lazy-load
      layout.js                       #   Page section builder
      badge.js                        #   LIVE/Cache/Static badges
      chart-helpers.js                #   Shared chart configuration utils
      data-transforms.js              #   Shared data parsing utils
    topics/                           #   One module per topic
      co2.js
      temperature.js
      biodiversity.js
      ... (28 total)
  scripts/
    collect-data.js                   # Existing (UNCHANGED)
    process-data.js                   # Existing (UNCHANGED)
    self-heal.js                      # Existing (UNCHANGED)
    cache-topics.js                   # NEW: per-topic data collection
  service-worker.js                   # EXTENDED: add detail page paths
```

## CSS Architecture

**Strategy:** Shared base styles from main page CSS (via relative path), plus one detail-specific stylesheet.

| File | Contains | Loaded By |
|------|----------|-----------|
| `css/core.css` | CSS variables, resets, typography, base colors | Both pages (shared) |
| `css/components.css` | Buttons, cards, badges, grid utilities | Both pages (shared) |
| `css/sections.css` | Main page act-specific styles | Main page only |
| `css/animations.css` | Scroll-driven animations | Main page only |
| `detail/css/detail.css` | Hero layout, chart containers, context tiles, skeleton loaders, comparison grid, source list, print CSS, back button, back-to-top | Detail page only |

**Why not per-topic CSS:**
- Topics share the same layout structure (hero, charts, tiles, explanation)
- Color differentiation comes from CSS custom properties set by JavaScript per topic
- One shared detail.css is cacheable across all topic navigations
- Per-topic CSS would require 28 additional network requests

**Color theming per topic:**

```css
/* detail/css/detail.css */
.detail-page {
  --topic-color: var(--color-accent, #00d4ff);
  --topic-color-dim: color-mix(in srgb, var(--topic-color) 20%, transparent);
}

.detail-hero { border-bottom: 2px solid var(--topic-color); }
.detail-chart-title { color: var(--topic-color); }
```

```javascript
// Set per-topic color from module config
document.documentElement.style.setProperty('--topic-color', topicConfig.meta.color);
```

## i18n Integration

**Strategy:** Extend the existing `js/i18n.js` translations object with detail page keys, loaded from the shared i18n module via relative import.

```javascript
// detail/js/router.js (or detail entry point)
import { i18n } from '../../js/i18n.js';
// The i18n module already handles language toggle and key resolution
// Detail page keys follow namespace: detail.{topic}.{key}
```

Topic modules reference i18n keys, never hardcode strings:

```javascript
// Topic module
meta: {
  titleKey: 'detail.co2.title',   // resolves to "CO2 & Treibhausgase" (de) or "CO2 & Greenhouse Gases" (en)
  subtitleKey: 'detail.co2.subtitle'
}
```

## Scalability Considerations

| Concern | At 5 topics | At 15 topics | At 28+ topics |
|---------|-------------|--------------|---------------|
| Module loading | Instant (< 50ms) | Instant (< 50ms) | Instant (< 50ms) -- only one loads |
| Cache file size | 5 small JSON files (~50KB total) | 15 files (~150KB total) | 28 files (~300KB total committed) |
| GitHub Actions time | 5 matrix jobs (~5min total) | 15 jobs (~15min, stays in free tier) | 28 jobs (~25min, free tier allows 2000min/month) |
| Service worker precache | 7 core detail files | Same 7 files (topics load on demand) | Same 7 files |
| i18n file growth | +200 keys | +600 keys | +1000 keys (~15KB addition to i18n.js) |
| Git repo size | +50KB | +150KB | +300KB data, negligible for GitHub Pages |
| Browser memory | 1-2 Chart.js instances active | 1-2 active (destroyed on navigate) | 1-2 active (destroyed on navigate) |

## Suggested Build Order (Dependencies)

The components have clear dependency ordering. Items marked with the same number can be built in parallel.

```
Phase 1 (Foundation — no dependencies):
  1a. detail/index.html          ← HTML shell with CSS links, script module
  1b. detail/css/detail.css      ← Layout styles for hero, charts, tiles
  1c. detail/js/badge.js         ← Simple emoji badge renderer (standalone)
  1d. data/fallback/static-values.json  ← Hardcoded fallback values

Phase 2 (Data infrastructure — depends on 1c, 1d):
  2a. detail/js/data-layer.js    ← 3-tier fetch logic (needs badge.js, static-values.json)
  2b. detail/js/chart-manager.js ← Chart.js CDN loading + lifecycle (standalone)

Phase 3 (Routing + loading — depends on nothing new):
  3a. detail/js/router.js        ← URL param parsing
  3b. detail/js/module-loader.js ← Dynamic import() wrapper

Phase 4 (Rendering — depends on 1b, 2a):
  4a. detail/js/layout.js        ← Page section builder (needs detail.css, data-layer)
  4b. detail/js/chart-helpers.js ← Shared Chart.js config factories
  4c. detail/js/data-transforms.js ← CSV/JSON parsers

Phase 5 (First topic — depends on 2a, 2b, 3a, 3b, 4a, 4b):
  5a. detail/topics/co2.js       ← First complete topic module (proving the pattern)
  5b. Extend i18n.js with detail.co2.* keys
  5c. Extend service-worker.js with detail paths
  5d. Main page: add onclick links to detail pages

Phase 6 (GitHub Actions — depends on 5a working):
  6a. scripts/cache-topics.js    ← Topic-specific data collection script
  6b. .github/workflows/cache-detail-data.yml  ← Staggered cron workflow

Phase 7 (Remaining topics — depends on 5a proving the pattern):
  7a. detail/topics/{topic}.js   ← Each additional topic module
  7b. Extend i18n.js per topic
  7c. Extend static-values.json per topic
  7d. Main page: add onclick links per topic
```

**Why this order:**
- Phase 1-2 builds the infrastructure that every topic depends on
- Phase 3 is the glue that connects URL to module
- Phase 4 is the rendering layer
- Phase 5 proves the entire pattern with one real topic before building 27 more
- Phase 6 adds automated data freshness after manual testing confirms the pattern works
- Phase 7 is the scaling phase -- the template is proven, now replicate it

## Sources

- Existing codebase analysis: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`
- Existing service worker: `service-worker.js` (network-first/cache-first strategy)
- Existing data loader: `js/data-loader.js` (localStorage fallback pattern)
- Existing i18n system: `js/i18n.js` (dot-notation key resolution)
- Existing GitHub Actions workflow: `.github/workflows/data-pipeline.yml` (collect -> process -> deploy)
- Chart.js v4 documentation: `chart.destroy()` required before canvas reuse, `new Chart(ctx, config)` for creation (MEDIUM confidence -- based on Chart.js v4 API, not verified against live docs due to tool restrictions)
- Dynamic `import()` specification: ES2020 standard, supported in all modern browsers without bundler (HIGH confidence -- stable browser API)
- GitHub Pages URL routing constraints: No server-side rewrites, 404.html redirect is only fallback (HIGH confidence -- well-documented GitHub Pages limitation)
- GitHub Actions matrix strategy: `max-parallel: 1` with `fail-fast: false` for sequential job execution (HIGH confidence -- GitHub Actions documented feature)
