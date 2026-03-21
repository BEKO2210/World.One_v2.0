# Domain Pitfalls

**Domain:** Data dashboard expansion -- 30+ detail pages with Chart.js, live API fallback chains, GitHub Actions data caching, SVG map choropleths
**Project:** World.One Detail Pages & Data Expansion
**Researched:** 2026-03-21
**Overall confidence:** HIGH (codebase-evidenced patterns + established domain knowledge)

---

## Critical Pitfalls

Mistakes that cause rewrites, production outages, or severe user-facing degradation.

---

### Pitfall 1: Chart.js Instance Memory Leak (Canvas Not Destroyed)

**What goes wrong:** Each Chart.js instance binds to a `<canvas>` element and registers global event listeners (resize, pointer events), animation frame loops, and internal data structures. When a user navigates between detail pages (via the planned `detail/index.html?topic=X` URL parameter routing), the old topic module renders charts, then the new topic replaces the DOM -- but the Chart.js instances from the old topic are never `.destroy()`ed. The old instances keep running animation loops and holding references to detached canvas elements. After navigating through 5-10 topics, the browser accumulates orphaned Chart.js instances causing visible frame drops, increasing memory consumption, and eventual tab crashes on mobile.

**Why it happens:** The planned architecture uses a single `detail/index.html` with dynamic topic module loading (`detail/topics/{topic}.js`). When switching topics, the natural pattern is to replace `innerHTML` of the content area. This removes the `<canvas>` from the DOM, but the Chart.js instance still lives in JS memory. The existing codebase uses SVG charts (see `js/visualizations/charts.js`) which have no destroy lifecycle -- they are just innerHTML strings. Developers accustomed to this SVG pattern will forget that Chart.js canvas instances require explicit cleanup.

**Consequences:**
- Memory grows ~2-5MB per undestroyed chart (each holds parsed dataset copies)
- RAF animation loops continue for destroyed canvases (CPU waste)
- "Canvas is already in use" errors when Chart.js tries to reuse a canvas ID
- Mobile Safari aggressively kills tabs exceeding ~300MB; 15-20 topic switches can trigger this
- Event listeners on `window.resize` accumulate, causing O(n) resize handler execution

**Warning signs:**
- Browser DevTools Memory tab shows a sawtooth pattern that only climbs, never returns to baseline
- `Chart.instances` (or `Chart.getChart(canvas)`) returns instances for canvases no longer in DOM
- Console warnings: "Canvas is already in use. Chart with ID 'X' must be destroyed before..."
- Performance profiler shows multiple concurrent `requestAnimationFrame` chains

**Prevention:**
```javascript
// Topic module pattern -- every topic module must return a cleanup function
export function render(container, data) {
  const charts = [];

  const chart1 = new Chart(container.querySelector('#chart-1'), { ... });
  charts.push(chart1);

  // Return cleanup function -- called before next topic loads
  return function destroy() {
    charts.forEach(c => c.destroy());
  };
}
```
The detail page controller must:
1. Store the cleanup function returned by the current topic module
2. Call it BEFORE loading and rendering the next topic module
3. Store Chart.js instances in an array, not scattered across closures
4. Use `Chart.getChart(canvas)` as a safety check before creating new instances

**Detection:** Add a debug mode that logs `Object.keys(Chart.instances).length` on each topic switch. If it only grows, destroy is broken.

**Phase:** Must be established in the very first phase that introduces Chart.js detail pages. Retrofitting destroy logic across 30 topic modules is far harder than building the pattern from day one.

---

### Pitfall 2: Service Worker Caching Stale Data Files After Pipeline Update

**What goes wrong:** The current service worker (`service-worker.js` line 7) marks paths containing `/data/` as network-first. This works for `world-state.json`. But the detail page expansion adds `data/cache/*.json` files (30+ individual topic cache files) that are committed by GitHub Actions and deployed via GitHub Pages. The service worker DOES intercept these correctly as network-first. However, the problem is more subtle: **the service worker cache version (`worldone-v1`) never changes**, so stale responses remain in the service worker cache indefinitely. When a network request succeeds, the new response replaces the cached one -- fine. But when the network request fails (user offline or flaky connection), the service worker serves whatever was last cached. If a `data/cache/co2.json` file structure changes (new fields, renamed keys) between pipeline updates, the offline fallback returns the old structure, and the topic module that expects the new structure throws.

**Why it happens:** The existing service worker (lines 60-68) clones and caches every successful data response, but never validates the cached data against an expected schema. The plan calls for 30+ individual `data/cache/*.json` files with topic-specific schemas. Schema evolution is inevitable as detail pages mature.

**Consequences:**
- Users returning to the PWA after a schema change see broken charts (undefined data fields)
- The 3-tier fallback (live -> cache -> static) masks this: the service worker cache sits BETWEEN the browser cache and the static fallback, creating a 4th invisible layer
- Badge system shows "LIVE" (because service worker intercepted the request) even though the data is stale cached data from service worker
- Debugging is extremely difficult because the developer's fresh browser never hits this path

**Warning signs:**
- PWA users report broken charts that desktop users never see
- The badge system shows "LIVE" but data values are clearly outdated
- `Cache.keys()` in DevTools shows old responses for `/data/cache/*.json` paths

**Prevention:**
1. Include a `dataVersion` or `schemaVersion` field in every `data/cache/*.json` file
2. The data-loader utility should check `schemaVersion` in cached responses and reject mismatches, falling through to static fallback
3. Bump `CACHE_NAME` from `worldone-v1` to `worldone-v2` when deploying structural changes (this triggers the activate handler to purge old caches)
4. Consider adding a `data/cache/meta.json` (already planned) that includes a `cacheVersion` field; the service worker can check this on activate

**Detection:** Add a `meta.json` health check endpoint that the service worker fetches on activation; if `meta.cacheVersion` exceeds the stored version, purge all data caches.

**Phase:** Must be addressed in the same phase that introduces `data/cache/*.json` files. The service worker update must ship alongside the first batch of cache files.

---

### Pitfall 3: GitHub Actions Rate Limiting Cascade Across Expanded Workflows

**What goes wrong:** The current pipeline runs a single workflow (`data-pipeline.yml`) every 6 hours, making ~40 API calls within one job. The plan calls for "Extended GitHub Actions workflows for individual cache files" -- meaning additional workflow files or jobs that fetch topic-specific data (USGS, NOAA, OpenAQ, GBIF, Electricity Maps, etc.). Even with the planned "30min gaps between Action jobs", GitHub imposes multiple overlapping rate limits:
- **GitHub Actions minutes:** Free tier = 2,000 min/month. Each 6-hour pipeline run uses ~3-5 min. Adding 5-10 additional jobs per cycle = 15-50 min per cycle * 4 cycles/day * 30 days = 1,800-6,000 min/month. This exceeds the free tier.
- **GitHub API secondary rate limits:** Even with `GITHUB_TOKEN`, the search API (used for `fetchGitHubActivity`) is limited to 30 requests/min. The code already uses this (`collect-data.js` line 464).
- **Third-party API rate limits:** World Bank API has undocumented rate limits (~50-100 requests/min). Making 15+ World Bank calls in parallel (as the collector already does) is fine at 40 calls; at 60-80 calls with detail page data, you start hitting 429s.
- **Concurrent workflow limits:** Free tier allows 20 concurrent jobs. Staggered cron schedules can overlap if jobs take longer than expected (timeout is 15 min).

**Why it happens:** The existing pipeline was designed for a single monolithic collection run. Expanding to per-topic cache files tempts developers to create separate workflows or jobs per topic category. The 30-minute stagger constraint helps but does not eliminate the problem because: (a) job duration varies, (b) manual `workflow_dispatch` can trigger concurrently with scheduled runs, and (c) the `cancel-in-progress` concurrency guard only applies within the same workflow group.

**Consequences:**
- GitHub Actions minutes exhausted mid-month; pipeline stops running entirely
- API rate limit errors (HTTP 429) cause cascade failures: one 429 triggers retries, retries consume more time, job hits timeout
- `continue-on-error: true` masks the problem: pipeline reports success with 30% of sources failed
- The alert system only fires when success rate drops below 50%; sustained 60-70% success feels "fine" but means 12-16 data sources are consistently stale

**Warning signs:**
- GitHub billing page shows Actions minutes climbing toward 2,000
- `collection-manifest.json` shows increasing `failed` counts for World Bank or similar APIs
- Pipeline jobs taking 12-14 of the 15-minute timeout (approaching timeout cascade)
- Multiple workflow runs queued or cancelled by concurrency group

**Prevention:**
1. Keep one workflow, one collect job. Add detail page data collection as additional function calls within `collect-data.js`, not as separate workflows. This avoids multiplied Actions minutes.
2. Implement a request queue with rate limiting in `collect-data.js`: max 2 concurrent requests, 200ms delay between requests to the same domain.
3. For World Bank API: batch requests using multi-country endpoints (`/country/WLD;USA;CHN;...`) instead of individual calls per country.
4. Set the alert threshold lower: warn at 70% success rate, not 50%.
5. Track Actions minutes in the workflow summary output so the team sees consumption trends.
6. Cache raw API responses in the git repo (`data/raw/`) and only re-fetch if the cached response is older than `cacheTTL` (already partially done with the artifact system).

**Detection:** Add a step in the pipeline that outputs `echo "Actions minutes used this month: $(gh api /repos/$REPO/actions/usage | jq '.minutes_used')"` to the workflow summary.

**Phase:** Must be designed in the first phase that extends data collection. Adding sources ad-hoc across phases will invisibly accumulate toward the limit.

---

### Pitfall 4: SVG World Map Choropleth Performance Collapse with Country-Level Data

**What goes wrong:** The existing `maps.js` colors SVG paths by iterating `svg.querySelectorAll('path')` and setting `style.fill` and `style.opacity` on each path individually (line 121-133). This works for 5 map layers on the main page. But detail pages plan to use choropleths with country-level data for ~195 countries -- and potentially multiple maps per detail page (e.g., the `conflicts` topic shows a conflict map, a refugee flow map, and a hunger overlay). Each `style.fill` assignment triggers a style recalculation. On a page with 3 SVG maps, each with ~250 paths, that is 750 individual style mutations. If these run during scroll or resize events, the browser cannot maintain 60fps.

Additionally, the SVG world map file itself is likely large (a typical Natural Earth SVG is 200-500KB). Loading it 3 times per detail page (once per map section) means 600KB-1.5MB of duplicated SVG DOM nodes.

**Why it happens:** The current architecture (line 117, `_colorSVG`) does direct DOM manipulation in a loop without batching. The pattern is inherited from the main page where only one map exists and layers swap on button click (not during scroll). Detail pages will have multiple maps visible simultaneously and users will scroll through them.

**Consequences:**
- Jank during detail page load (750ms+ of style recalculation)
- Mobile devices (especially Android mid-range) drop to 5-10fps during map rendering
- Multiple SVG maps = massive DOM node count (~3,000+ path elements for 3 maps)
- Touch interactions (tooltips, zoom) become laggy due to hit-testing on thousands of SVG paths

**Warning signs:**
- Lighthouse Performance score drops below 80 (constraint violation)
- Chrome DevTools Performance panel shows purple "Recalculate Style" blocks >50ms
- "Forced reflow" warnings in console during map render
- Users on mobile report visible freezing when scrolling to map sections

**Prevention:**
1. Use a single SVG map instance per detail page and swap data layers (as the main page already does), rather than embedding multiple SVG maps
2. Batch style mutations: build a CSS class string or use `cssText` assignment instead of individual `style.fill` / `style.opacity` assignments
3. Use CSS custom properties for choropleth colors: set `--fill` on each path, define the gradient in CSS. This allows the browser to batch paint operations.
4. Implement `requestAnimationFrame` batching for color updates: collect all path -> color mappings first, then apply in a single RAF callback
5. For detail pages needing multiple map views: use a tabbed interface (show one map at a time) rather than stacking maps vertically
6. Lazy-load SVG maps with IntersectionObserver (already planned for charts; extend to maps)
7. For earthquake/air quality maps with point data: use a `<canvas>` overlay for dots instead of SVG circles (Canvas handles thousands of points far better than SVG)

**Detection:** Add a performance marker: `performance.mark('map-render-start')` before `_colorSVG`, `performance.mark('map-render-end')` after. Log if duration exceeds 100ms.

**Phase:** Must be addressed when building the first detail page that uses a choropleth (likely CO2 emissions or conflicts). The reusable map component should be performance-optimized from the start.

---

### Pitfall 5: Mobile Performance Collapse with Multiple Heavy Charts Per Detail Page

**What goes wrong:** The plan calls for detail pages with rich layouts: "hero, charts, context tiles, explanation, comparison, sources." A typical topic like `temperature` would have a Keeling Curve chart, a warming stripes interactive, a tipping points chart, a country comparison chart, and a map. That is 4-5 Chart.js canvas instances + 1 SVG map + the existing particle system background canvas. On mobile devices, this means:
- 5 canvas contexts competing for GPU memory (mobile GPUs have 96-256MB VRAM)
- Chart.js default animations (300ms ease) running on all 5 charts simultaneously when they enter viewport
- IntersectionObserver fires for multiple charts in quick succession during fast scrolling
- The particle system (`particles.js` line 19: 400 particles on mobile) continues running behind all of this

**Why it happens:** The project constraint says "Lazy-load charts via IntersectionObserver with skeleton loaders" -- but naive IntersectionObserver implementation fires for ALL charts that enter the viewport simultaneously when the page first loads (if 3 charts are visible above the fold, all 3 instantiate at once). Chart.js default behavior is to animate on creation, so 3-5 charts animate simultaneously.

**Consequences:**
- Mobile Lighthouse Performance drops below 60 (well below the 80 constraint)
- Total Blocking Time (TBT) spikes to 500ms+ from concurrent chart initialization
- Users see stutter and frame drops during initial detail page load
- Battery drain from concurrent canvas rendering
- iOS Safari may kill the tab silently if GPU memory is exhausted

**Warning signs:**
- Lighthouse TBT > 200ms on mobile emulation
- FPS drops below 30 during detail page initial load
- Users report "page is slow" but only on detail pages, not main page
- Canvas context warnings in console: "Too many active WebGL contexts"

**Prevention:**
1. **Stagger chart initialization:** Even with IntersectionObserver, add a 200ms delay between chart creations. Use a queue: `chartQueue.push(() => new Chart(...))` and process one per animation frame.
2. **Disable animations on mobile:** Set `Chart.defaults.animation = false` when `window.innerWidth < 768` or `navigator.connection?.effectiveType === '2g'|'3g'`
3. **Pause particle system on detail pages:** The particle canvas is unnecessary on detail pages. Call `particles.stop()` when navigating to detail and `particles.start()` when returning to main.
4. **Limit simultaneous canvas contexts:** Never have more than 3 Chart.js instances rendered at once. Destroy charts that scroll out of viewport (not just skip rendering -- actually destroy and recreate on re-entry).
5. **Use `willReadFrequently: false`** on canvas contexts (Chart.js default) and avoid `getImageData` operations
6. **Reduce Chart.js data points on mobile:** If a dataset has 100+ points, downsample to 50 on mobile using Largest-Triangle-Three-Buckets (LTTB) or simple stride sampling

**Detection:** Measure and log `performance.now()` before/after each Chart creation. Alert if any single chart takes >100ms or total page chart initialization exceeds 500ms.

**Phase:** Must be built into the chart lazy-loading infrastructure in the first detail page phase. Retrofitting staggering and destroy-on-exit across 30 topics is a rewrite.

---

## Moderate Pitfalls

Mistakes that cause significant bugs, performance issues, or maintenance headaches.

---

### Pitfall 6: CORS Failures in Live API Fallback Chain Silently Breaking Badge Display

**What goes wrong:** The 3-tier fallback system (live API -> GitHub Actions cache -> static values) will make direct browser-side fetch calls to external APIs. Many APIs that work fine in Node.js (server-side, as in `collect-data.js`) will fail in the browser due to CORS restrictions. Examples from the current collector that will NOT work client-side:
- World Bank API: Works (CORS headers present)
- NOAA CO2 CSV: Fails (no CORS headers on `gml.noaa.gov`)
- NASA GISTEMP CSV: Fails (no CORS headers on `data.giss.nasa.gov`)
- USGS Earthquake GeoJSON: Works (CORS headers present)
- disease.sh: Works (CORS headers present)
- Open-Meteo: Works (CORS headers present)
- `open.er-api.com`: Works (CORS headers present)
- arXiv API: Fails (no CORS headers)
- GitHub API: Works with caveats (rate limited to 60/hr unauthenticated)

The live tier of the fallback chain will silently fail for every CORS-blocked API. The catch block will trigger, the system will fall through to cache, and the badge will show "Cache" -- but the developer might never realize the live tier was never actually reachable.

**Why it happens:** The collector runs in Node.js on GitHub Actions where CORS does not exist. Developers test the live fallback against APIs that work in Postman or Node, assume they work in browsers, and only discover the CORS failure in production.

**Prevention:**
1. Maintain an explicit registry of which APIs support browser CORS and which do not. Only attempt live fetch for CORS-compatible APIs.
2. For CORS-blocked APIs, make the "live" tier = GitHub Actions cache (which IS same-origin), and the "cache" tier = localStorage copy of the cache file.
3. Never use a CORS proxy in production (unreliable, security risk, adds latency).
4. Document in each topic module: `// LIVE SOURCE: USGS (CORS OK) | NOAA (CORS blocked, cache only)`

**Detection:** In development, add a middleware that logs all fetch failures with the specific error type (CORS vs timeout vs 4xx/5xx). CORS errors have a distinctive `TypeError: Failed to fetch` with no response body.

**Phase:** Must be validated during the design of the data-loader utility (`utils/data-loader.js`). Each API must be tested from a browser context before being registered as a live source.

---

### Pitfall 7: localStorage Quota Exhaustion from 30+ Cached Topic JSON Files

**What goes wrong:** The existing `DataLoader` caches `world-state.json` in localStorage (line 79). The detail page expansion adds 30+ topic cache files, each potentially 5-50KB. If all 30 topics cache their data in localStorage: 30 * 50KB = 1.5MB. Add the existing `world-state.json` (~30KB), user preferences, i18n state, and service worker cached responses, and you approach the 5-10MB localStorage limit (varies by browser; Safari is 5MB, Chrome is 10MB). On Safari, exceeding the quota throws a `QuotaExceededError` silently in the `try/catch` block (line 82-85 of data-loader.js), meaning the cache write fails but no one notices.

**Why it happens:** localStorage has a synchronous, string-only API with hard size limits. Each `JSON.stringify` of a topic cache file adds the full JSON as a string (which is ~30% larger than the binary JSON due to UTF-16 encoding in localStorage). Developers add topics incrementally and never test with ALL 30 topics cached simultaneously.

**Prevention:**
1. Use a cache key prefix (`wo-cache-`) and implement LRU eviction: before writing, check total size; if exceeding 3MB, delete the oldest-accessed cache entries
2. Consider using the Cache API (service worker cache) instead of localStorage for data files -- it has much higher limits (hundreds of MB) and handles binary data efficiently
3. Set a per-topic cache size limit: if a topic's data exceeds 100KB, skip localStorage caching for that topic and rely on service worker cache only
4. Compress cached data: use a simple dictionary encoding or store only the fields each topic actually needs, not the full API response

**Detection:** Add a `getStorageUsage()` debug function: `new Blob(Object.values(localStorage)).size` and log if it exceeds 3MB.

**Phase:** Address in the phase that builds the central `utils/data-loader.js` utility. The caching strategy must account for 30+ topics from the start.

---

### Pitfall 8: Chart.js CDN Single Point of Failure

**What goes wrong:** The project plans to load Chart.js via CDN (`defer`-loaded). If the CDN is down, slow, or blocked (corporate firewalls, China's Great Firewall, ad blockers that block CDN domains), ALL detail pages break completely. Unlike the main page which uses custom SVG charts (no external dependencies), detail pages would have zero chart rendering capability without Chart.js.

**Why it happens:** The constraint "No new dependencies: Chart.js via CDN only (no npm install for frontend)" means there is no bundled fallback. CDN failures are rare but have happened with cdnjs, unpkg, and jsdelivr -- and they disproportionately affect users in regions with poor connectivity (exactly the audience a world data dashboard serves).

**Prevention:**
1. Self-host Chart.js: download the minified file into `js/lib/chart.min.js` and load it from same-origin. This is allowed even with the "no npm install for frontend" constraint -- it is a static file, not an npm dependency.
2. If CDN is preferred: implement a CDN fallback chain: try primary CDN, if `onerror`, load from secondary CDN, if `onerror`, load self-hosted copy.
3. The service worker already caches assets (cache-first strategy). If Chart.js is loaded once via CDN successfully, the service worker will serve it from cache on subsequent visits -- but the FIRST visit still needs the CDN to be reachable.

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"
        defer
        onerror="this.onerror=null; this.src='js/lib/chart.umd.min.js';">
</script>
```

**Detection:** Error boundary in the topic module loader: if `typeof Chart === 'undefined'` after DOMContentLoaded, show a user-facing message instead of silent failure.

**Phase:** Address in the first phase that introduces Chart.js. The loading strategy should be decided once and used everywhere.

---

### Pitfall 9: i18n Key Explosion Across 30 Topic Modules

**What goes wrong:** The existing i18n system uses dot-notation keys (`map.war`, `loading.sub`). Adding 30 detail pages with chart labels, axis titles, explanations, context tiles, and source attributions will add 50-100 keys per topic = 1,500-3,000 new i18n keys. If these are all added to the main `i18n.js` translation file, the file becomes unwieldy (3,000+ lines), translation updates affect the main page build, and key naming conflicts arise (e.g., `detail.title` in CO2 vs `detail.title` in temperature).

**Why it happens:** The natural approach is to add keys to the existing i18n system. Without namespace discipline, keys collide or become deeply nested (`detail.topics.co2.charts.keelingCurve.yAxisLabel`), making the translation file unmaintainable.

**Prevention:**
1. Namespace i18n keys by topic: `co2.chartTitle`, `temperature.chartTitle` -- flat within topic, namespaced by topic prefix
2. Split translations into per-topic files: `i18n/detail/co2.json`, `i18n/detail/temperature.json`. Load only the needed translation file when a detail page loads.
3. Main page translations stay in the existing `i18n.js`; detail page translations are separate and lazily loaded
4. Establish a key naming convention early: `{topic}.{section}.{element}` with max 3 levels

**Detection:** Lint rule or build script that checks for i18n key collisions across topic files.

**Phase:** Design the i18n split in the first detail page phase. Migrating 1,500 keys from a monolithic file to per-topic files later is painful.

---

### Pitfall 10: Fallback Badge Showing "LIVE" When Data Is Actually Hours Stale

**What goes wrong:** The planned badge system (LIVE/Cache/Static) shows "LIVE" when a direct API fetch succeeds. But "LIVE" from the World Bank API still returns data that is days, weeks, or months stale (World Bank updates annually for many indicators). The user sees a green "LIVE" badge next to CO2 emissions data from 2023, creating a false sense of recency. Conversely, the GitHub Actions cache (`data/cache/co2.json`) is updated every 6 hours with processed data -- the "Cache" badge (amber) is actually fresher and more useful than the "LIVE" badge (green).

**Why it happens:** The badge system conflates "how the data was fetched" with "how fresh the data is." These are different dimensions. A live API call to a slowly-updated source produces stale data via a fresh connection.

**Prevention:**
1. Add a `lastModified` or `dataDate` field to every data source response (when the underlying data was last updated, not when it was fetched)
2. Badge logic: if `dataDate` is older than 24h, show amber regardless of fetch method. If `dataDate` is older than 7 days, show orange/warning.
3. Keep the fetch-method badge (LIVE/Cache/Static) as a secondary indicator, but make the primary indicator the data freshness
4. For APIs like World Bank that update annually: suppress the "LIVE" badge entirely and show "2023 data" with a calendar icon instead

**Detection:** Compare `dataDate` vs `fetchedAt` in the badge renderer. If `fetchedAt - dataDate > 7 days`, flag the badge as misleading.

**Phase:** Address when building the badge system (`utils/badge.js`). The badge design should account for data freshness from the start.

---

### Pitfall 11: Detail Page URL Routing Race Condition on Direct Navigation

**What goes wrong:** The plan uses `detail/index.html?topic=co2` with dynamic module loading. When a user bookmarks or shares this URL, the page loads and must: (1) parse the URL parameter, (2) dynamically import the topic module, (3) fetch data via the 3-tier fallback, (4) render. If step 2 or 3 fails (network error, typo in shared URL, topic not yet deployed), the user sees a blank page or a cryptic error. There is no 404 page for invalid topics. Additionally, `history.pushState` navigation between topics from within the detail page may conflict with the service worker's navigation preload.

**Why it happens:** SPA-like routing in a static GitHub Pages site has no server-side fallback. The server always returns `detail/index.html` for any `?topic=X` parameter, even if `X` does not exist. The client must handle all error states.

**Prevention:**
1. Maintain a `VALID_TOPICS` array in the detail page controller. If the topic parameter does not match, redirect to a "topic not found" state with a list of available topics.
2. Show a meaningful loading skeleton immediately (before module import), so the user never sees a blank page.
3. Wrap the dynamic import in a try/catch with a user-facing error state: "This topic could not be loaded. [Back to Dashboard]"
4. Preload the topic module list from a manifest (`detail/topics/manifest.json`) so the page knows which topics exist without trying to import them.

**Detection:** Add error tracking: log when dynamic imports fail, including the requested topic name and error type.

**Phase:** Address in the first phase that builds the detail page routing system.

---

## Minor Pitfalls

Mistakes that cause inconvenience, maintenance burden, or suboptimal UX.

---

### Pitfall 12: Print CSS Missing for Detail Pages

**What goes wrong:** The plan includes "print CSS" but this is easily deprioritized. Charts rendered in `<canvas>` elements do NOT print well by default -- browsers render the canvas as a blank rectangle or at screen resolution (blurry on print). SVG charts print perfectly because they are vector. This means the main page (SVG charts) prints fine, but detail pages (Chart.js canvas charts) print as blank squares.

**Prevention:**
1. Before printing, convert each Chart.js canvas to a `<img>` element using `chart.toBase64Image()` and swap them in a `beforeprint` event handler
2. Hide interactive elements (tooltips, zoom buttons, particle canvas) in print CSS
3. Add `@media print` rules in the detail page CSS from the start

**Phase:** Can be deferred to a polish phase, but the `toBase64Image()` swap pattern should be documented early.

---

### Pitfall 13: Accessibility Regression -- Chart Data Not Available to Screen Readers

**What goes wrong:** The existing main page SVG charts include `role="img"` and `aria-label` attributes (see `charts.js` line 28-29 for warming stripes). Chart.js canvas elements are opaque to screen readers -- they render pixels, not semantic content. A detail page with 5 Chart.js charts is 5 black boxes to assistive technology users. This is an accessibility regression from the main page.

**Why it happens:** Chart.js does generate a `<canvas>` fallback text element, but it defaults to the chart type name ("Line Chart"), which is useless for data comprehension.

**Prevention:**
1. For every Chart.js instance, add a visually-hidden `<table>` below the chart containing the raw data. Use `sr-only` CSS class.
2. Add `role="img"` and a meaningful `aria-label` to each canvas: "CO2 concentration at Mauna Loa observatory, 1958 to 2026, showing increase from 315 to 427 ppm"
3. Add an accessible "View data as table" toggle button below each chart
4. Include `aria-describedby` pointing to a text summary of the chart's key insight

**Phase:** Must be part of the chart component pattern from the first detail page phase. Adding accessibility to 30 topics retroactively is a full audit.

---

### Pitfall 14: GitHub Actions `continue-on-error: true` Masking Persistent Failures

**What goes wrong:** The current pipeline uses `continue-on-error: true` on the collect step (line 65). This means a permanently broken API source (e.g., OpenAQ returning HTTP 410 since January 2025 -- evidenced in the code comment on line 195 of collect-data.js) never causes a pipeline failure. The alert system only fires at <50% success rate. A single broken source reduces the rate from, say, 95% to 92% -- well above the alert threshold. Over months, 5-6 sources can break silently, each reducing the rate by 2-3%, until the dashboard is running on 80% of its data and no one noticed.

**Prevention:**
1. Add per-source health tracking: record in `collection-manifest.json` how many consecutive failures each source has had
2. Alert on any source that has failed 5+ consecutive runs (regardless of overall success rate)
3. Create a health dashboard page (`data/cache/meta.json` already planned) that shows per-source success/failure history
4. Periodically review and remove permanently dead sources (like the OpenAQ v2 example)

**Phase:** Address when extending the data pipeline for detail page cache files.

---

### Pitfall 15: Topic Module Code Duplication Across 30 Files

**What goes wrong:** Each topic module (`detail/topics/co2.js`, `detail/topics/temperature.js`, etc.) will share common patterns: fetch data, check for errors, create chart container, instantiate Chart.js, add legend, add source attribution, handle resize. Without shared abstractions, each of the 30+ topic files will re-implement these patterns slightly differently, leading to inconsistent error handling, missed destroy calls, and styling drift.

**Prevention:**
1. Build a `detail/topics/_base.js` utility module with shared functions: `createChartSection()`, `createDataTable()`, `createSourceAttribution()`, `createMapSection()`
2. Define a topic module interface: every module exports `{ render(container, data): CleanupFn, meta: { title, description, sources } }`
3. Use a topic template/factory: `createTopicPage({ charts: [...], maps: [...], context: [...] })` that handles the boilerplate
4. Write the first 3 topic modules (CO2, temperature, conflicts) fully, then extract the shared patterns before building the remaining 27

**Phase:** Build the shared abstractions in the first detail page phase. Writing even 5 topic modules without shared patterns creates tech debt that compounds.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| Chart.js integration | Memory leak from undestroyed instances (#1) | Enforce destroy pattern from day one; module interface must return cleanup function | CRITICAL |
| Chart.js integration | CDN single point of failure (#8) | Self-host or implement CDN fallback chain | MODERATE |
| Chart.js integration | Canvas not accessible (#13) | Add hidden data tables and aria-labels to chart pattern | MODERATE |
| Detail page routing | Blank page on invalid topic (#11) | Validate topic parameter against manifest; show fallback UI | MODERATE |
| Data-loader utility | CORS blocking live API tier (#6) | Test each API from browser; maintain CORS compatibility registry | MODERATE |
| Data-loader utility | localStorage quota exhaustion (#7) | Implement LRU eviction or use Cache API for large datasets | MODERATE |
| Badge system | Misleading LIVE badge (#10) | Badge shows data freshness, not fetch method | MODERATE |
| Service worker update | Stale cached data after schema change (#2) | Version data schemas; bump cache name on structural changes | CRITICAL |
| GitHub Actions expansion | Rate limit cascade (#3) | Keep single workflow; add rate limiting in collector; track minutes | CRITICAL |
| GitHub Actions expansion | Silent source failures (#14) | Per-source health tracking with consecutive failure alerts | MINOR |
| SVG map choropleths | Performance collapse with many paths (#4) | Batch style mutations; single map instance per page; use tabs | CRITICAL |
| Multiple charts per page | Mobile GPU exhaustion (#5) | Stagger initialization; disable animations on mobile; pause particles | CRITICAL |
| i18n for detail pages | Key explosion (#9) | Namespace by topic; split into per-topic translation files | MODERATE |
| Topic module authoring | Code duplication (#15) | Shared base module with factory pattern; extract after first 3 topics | MINOR |
| Print support | Canvas charts print blank (#12) | beforeprint event converts canvas to img via toBase64Image() | MINOR |

---

## Confidence Assessment

| Pitfall | Confidence | Evidence Basis |
|---------|-----------|----------------|
| Chart.js memory leak (#1) | HIGH | Well-documented Chart.js behavior; codebase uses SPA-like navigation |
| Service worker stale cache (#2) | HIGH | Codebase shows static cache name `worldone-v1` with no versioning strategy |
| GitHub Actions rate limits (#3) | HIGH | Codebase shows 40+ API calls; free tier limits are documented by GitHub |
| SVG map performance (#4) | HIGH | Codebase shows per-path style mutation loop in `_colorSVG` |
| Mobile multi-chart performance (#5) | HIGH | Codebase shows 400 particles on mobile + planned 5 charts per detail page |
| CORS failures (#6) | HIGH | Codebase shows NASA/NOAA fetches that lack CORS headers |
| localStorage quota (#7) | MEDIUM | Depends on actual topic cache sizes; 30 topics is the planned count |
| CDN failure (#8) | MEDIUM | CDN outages are rare but documented; project serves global audience |
| i18n explosion (#9) | MEDIUM | Projection based on 30 topics * ~50 keys; depends on content density |
| Badge freshness (#10) | HIGH | World Bank data lag is well-known; badge design is in planning |
| Routing race condition (#11) | HIGH | Standard SPA-on-static-hosting issue; GitHub Pages has no server routing |
| Print CSS (#12) | HIGH | Canvas-to-print limitation is well-documented browser behavior |
| Accessibility (#13) | HIGH | Canvas opacity to screen readers is a fundamental web platform constraint |
| Silent failures (#14) | HIGH | `continue-on-error: true` is visible in current workflow; OpenAQ example in code |
| Code duplication (#15) | MEDIUM | Standard risk for any project with 30+ similar files; severity depends on discipline |

---

## Sources

- Codebase analysis: `service-worker.js`, `js/data-loader.js`, `js/visualizations/maps.js`, `js/visualizations/charts.js`, `js/visualizations/particles.js`, `scripts/collect-data.js`, `.github/workflows/data-pipeline.yml`, `js/app.js`
- Chart.js documentation: destroy() method requirements for canvas cleanup (established behavior since Chart.js v2)
- GitHub Actions documentation: free tier limits (2,000 minutes/month, 20 concurrent jobs)
- Web platform: CORS specification, localStorage quota limits, Canvas accessibility constraints, Service Worker Cache API behavior
- Project constraints from `.planning/PROJECT.md`

*All findings are based on codebase evidence and established web platform behavior. WebSearch was not available for verification, so third-party API CORS status claims (#6) should be verified by testing each API from a browser context before implementation.*
