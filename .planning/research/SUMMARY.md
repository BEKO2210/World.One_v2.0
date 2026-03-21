# Project Research Summary

**Project:** World.One Detail Pages & Data Expansion
**Domain:** Public data dashboard -- static-file vanilla JS site expanding from scroll-driven overview to 28+ deep-dive detail pages with Chart.js charting, live API fallback chains, and per-topic GitHub Actions caching
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

World.One is a production static-site global data dashboard serving 1M+ visitors on GitHub Pages. The expansion adds 28+ drill-down detail pages, each rendering interactive Chart.js charts for a single topic (CO2, temperature, biodiversity, etc.), powered by a 3-tier data fallback system (live API, GitHub Actions cached JSON, static hardcoded values). The entire stack remains vanilla JS with zero new npm dependencies on the frontend -- Chart.js loads via CDN, routing uses native URLSearchParams, and topic modules load on demand via dynamic `import()`. This is a well-constrained problem with mature browser APIs and a proven charting library; the patterns are standard and the architecture is sound.

The recommended approach is a layered build starting with shared infrastructure (URL router, data layer, Chart.js lifecycle manager, badge system), then proving the full pattern end-to-end with a single topic (CO2), then scaling to the remaining 27 topics using the validated template. The architecture cleanly separates the new detail page system from the existing main page -- no existing files need modification except extending the service worker with new cache paths and adding navigation links from the main page. Each topic is an independent ES6 module exporting a standard contract (meta, data sources, chart configs, layout), which makes topic development parallelizable once the infrastructure is proven.

The primary risks are performance-related: Chart.js instance memory leaks from missing `.destroy()` calls during topic navigation (critical -- must be enforced from day one), mobile GPU exhaustion from multiple simultaneous canvas contexts, and SVG map rendering jank from unbatched style mutations. Secondary risks center on the data pipeline: GitHub Actions free-tier minute exhaustion when adding 28 parallel cache jobs, CORS blocking browser-side live API calls for sources that work fine in Node.js, and the service worker serving schema-stale cached data after pipeline updates. All of these are well-understood problems with documented solutions; the key is building the prevention patterns into the foundation rather than retrofitting them.

## Key Findings

### Recommended Stack

The stack adds zero new npm dependencies to the frontend. Everything is either a built-in Web API or loaded via CDN. Chart.js 4.x is the only external library, loaded with `defer` exclusively on the detail page (never on the main page). The constraint "no bundler" is respected by using native dynamic `import()` for code splitting -- each topic module is ~3-8KB and loads only when requested.

**Core technologies:**
- **Chart.js 4.x (CDN):** Line, bar, scatter, doughnut, radar charts on detail pages -- 60KB gzipped, canvas-based, no dependencies, mature ecosystem. Use jsDelivr with major version pin (`@4`) and cdnjs fallback.
- **URLSearchParams + History API:** URL parameter routing for `?topic=co2&lang=de` -- native browser API, zero dependencies, works on any static host including GitHub Pages.
- **Dynamic `import()`:** On-demand loading of topic modules -- ES2020 standard, reduces initial payload from ~450KB (all topics) to ~15KB (framework + one topic). Each module is independently cacheable.
- **Fetch API + AbortController:** 3-tier data fallback with 5-second timeout -- live API, GitHub Actions cache JSON, static hardcoded values. Standard timeout pattern.
- **IntersectionObserver:** Lazy chart initialization -- charts render only when scrolled into view, with 200px rootMargin for pre-loading. Critical for mobile performance.
- **CSS-only skeleton loaders:** Pulsing placeholders while charts load -- zero JS, matches existing design tokens, prevents layout shift (CLS).

**Critical version note:** Chart.js 4.4.x version was identified from training data. The exact patch version should be verified at CDN load time. The v4 API has been stable since late 2022.

### Expected Features

**Must have (table stakes) -- users expect these from any data detail page:**
- Interactive chart tooltips (Chart.js built-in, configure nearest/intersect mode)
- Responsive chart sizing (320px mobile through 2560px desktop)
- Data freshness badges (LIVE/Cache/Stale/Static/Offline with emoji indicators)
- Back navigation with breadcrumbs
- Loading states with skeleton loaders
- Error states with retry (three tiers, never show nothing)
- Source attribution per chart
- Context explanation text (i18n-ready DE/EN)
- Mobile touch interactions
- Print-friendly layout (`@media print` with canvas-to-image conversion)
- Keyboard navigation and screen reader accessibility
- Semantic URL routing preserving `?topic=` and `?lang=`
- Consistent glass-morphism design language via shared CSS variables

**Should have (differentiators) -- elevate beyond standard dashboard:**
- Shareable chart snapshots via Web Share API with Open Graph meta tags
- Tipping point / threshold indicators (horizontal reference lines on charts)
- Sparkline comparison rail (related topic mini-charts for cross-topic discovery)
- Animated data transitions (Chart.js update API with easing)
- Scroll-driven progressive reveal (reuse existing ScrollEngine)
- Data download (CSV/PNG export via Chart.js `toBase64Image()`)
- Automated trend narration (rule-based math-to-text, not AI)
- Keyboard shortcuts (J/K navigation, T for time range, Escape to return)

**Defer indefinitely (anti-features):**
- User-customizable dashboards (requires auth, persistent state, layout engine)
- Real-time WebSocket streaming (incompatible with GitHub Pages)
- D3.js, Leaflet, Mapbox (explicitly excluded in PROJECT.md)
- Comment/annotation system (requires backend)
- AI-powered "ask about this data" (violates project philosophy)
- Historical playback slider (storage explosion)
- Custom chart theming by users

### Architecture Approach

The detail page system is a clean parallel layer that never modifies existing main page files. It introduces five new subsystems -- Router, Module Loader, Data Layer, Chart Manager, Layout Renderer -- all contained within a `detail/` directory. Topic modules at `detail/topics/{topic}.js` export a standard contract that the infrastructure consumes. The data pipeline extends with a separate GitHub Actions workflow using matrix strategy (`max-parallel: 1`, `fail-fast: false`) to cache per-topic JSON files without touching the existing `world-state.json` pipeline.

**Major components:**
1. **Router** (`detail/js/router.js`) -- Parse `?topic=` URL param, validate against known topics set, dispatch to module loader
2. **Module Loader** (`detail/js/module-loader.js`) -- Dynamic `import()` of topic modules with cache, contract validation, and fallback error module
3. **Data Layer** (`detail/js/data-layer.js`) -- 3-tier fetch (live API with 5s timeout, cached JSON from GitHub Actions, static fallback) with tier reporting for badges
4. **Chart Manager** (`detail/js/chart-manager.js`) -- Chart.js CDN loading, WeakMap-based instance tracking, IntersectionObserver lazy init, mandatory destroy-before-create lifecycle
5. **Layout Renderer** (`detail/js/layout.js`) -- Build page sections (hero, charts, context tiles, explanation, comparison, sources) from topic module config
6. **Badge Renderer** (`detail/js/badge.js`) -- Data freshness indicators based on both fetch method AND data age
7. **Cache Pipeline** (`scripts/cache-topics.js` + GitHub Actions matrix workflow) -- Per-topic data collection, staggered to avoid rate limits, each job commits only its own file

**Key architectural decisions:**
- Single `detail/index.html` serves all topics (no per-topic HTML files)
- Topic modules import only from shared utilities, never from each other (prevents dependency chains)
- Service worker extended (not replaced) to cover detail page paths
- CSS theming per topic via CSS custom properties set by JavaScript, not per-topic stylesheets
- i18n keys namespaced by topic (`detail.co2.title`), loaded from existing i18n system

### Critical Pitfalls

The top 5 pitfalls, ordered by severity and likelihood:

1. **Chart.js instance memory leak** -- Navigating between topics without calling `.destroy()` on old Chart.js instances leaks 2-5MB per chart, accumulates RAF loops, and crashes mobile Safari after 15-20 topic switches. Prevention: enforce a cleanup function return from every topic module's `render()`, store instances in a central ChartManager with WeakMap tracking, and call `destroyAll()` before loading the next topic. This pattern must be established in the very first phase.

2. **Mobile performance collapse** -- 5 Chart.js canvases + particle system + SVG map = GPU memory exhaustion on mobile. Prevention: stagger chart initialization (200ms queue), disable animations on mobile, pause particles on detail pages, limit to 3 simultaneous canvas contexts, downsample datasets >100 points on mobile.

3. **GitHub Actions rate limit cascade** -- Adding 28 separate cache jobs could exhaust the 2,000 free-tier minutes/month (estimated 1,800-6,000 min). Prevention: keep a single workflow with matrix strategy, implement request queuing with 200ms inter-request delay, batch World Bank calls using multi-country endpoints, track minutes in workflow summary.

4. **Service worker serving schema-stale data** -- Cache version never bumps, so offline users get old-schema data that breaks new topic modules. Prevention: add `schemaVersion` to every cache file, reject mismatches in the data loader (fall through to static), bump `CACHE_NAME` on structural changes.

5. **CORS blocking live API tier** -- APIs that work in Node.js (NOAA, NASA, arXiv) fail silently in browsers due to missing CORS headers. Prevention: maintain an explicit CORS compatibility registry per API, only attempt browser-side live fetch for CORS-compatible APIs, treat GitHub Actions cache as the "live" tier for CORS-blocked sources.

## Implications for Roadmap

Based on the combined research, the project decomposes into 5 phases with clear dependency ordering. The architecture research provides a precise build order; the features research validates what belongs in each phase; the pitfalls research dictates which prevention patterns must ship with each phase.

### Phase 1: Detail Page Infrastructure

**Rationale:** Every detail page feature depends on the router, data layer, chart lifecycle manager, and layout system. These must exist and be validated before any topic content is built. The dependency graph from ARCHITECTURE.md and FEATURES.md confirms these are the foundation layer with zero optional components.

**Delivers:** A working `detail/index.html` that can route to a topic, load data via 3-tier fallback, render Chart.js charts with proper lifecycle management, show data freshness badges, display skeleton loaders during load, and handle errors gracefully.

**Addresses features:** URL parameter routing, 3-tier data fallback, data freshness badges, skeleton loaders, error states with recovery, Chart.js integration with responsive sizing and interactive tooltips, back navigation with breadcrumbs, source attribution, consistent design language (detail.css extending core.css), print CSS foundation.

**Avoids pitfalls:** Chart.js memory leak (#1 -- ChartManager with destroy-before-create enforced from day one), CDN single point of failure (#8 -- fallback chain or self-hosted copy decided here), service worker stale cache (#2 -- schema versioning built into data format), detail page routing race condition (#11 -- valid topics manifest + error fallback UI).

### Phase 2: First Topic End-to-End (CO2)

**Rationale:** One real topic must prove the entire pattern before building 27 more. CO2 is the ideal first topic: it has a clear primary data source (NOAA Mauna Loa), a well-known chart (Keeling Curve), and represents a mid-complexity case with 2-3 charts. This phase also extends the GitHub Actions pipeline for the first cache file and adds the main page navigation link.

**Delivers:** A fully functional CO2 detail page with live data, charts, context text, source attribution, and data freshness badges. Also: the topic module template/interface that all subsequent topics will follow, i18n keys for DE/EN, service worker extension for detail paths, and the first GitHub Actions cache job.

**Addresses features:** Context explanation text (i18n framework), semantic URL routing (proven with real sharing/bookmarking), mobile touch interactions.

**Avoids pitfalls:** CORS blocking (#6 -- NOAA is CORS-blocked, so CO2 immediately forces the team to handle the cache-only live tier pattern), topic module code duplication (#15 -- extract shared patterns from this first module before scaling), i18n key explosion (#9 -- establish namespace convention with the first topic).

### Phase 3: Core Topic Batch (5-8 Topics) with Differentiators

**Rationale:** With the infrastructure proven and the CO2 template extracted, scale to 5-8 topics covering each data domain (environment, society, economy, science). Add the first differentiator features that benefit from having multiple topics: sparkline comparison rail, scroll-driven reveal, animated transitions, and keyboard shortcuts.

**Delivers:** 5-8 working topic pages (temperature, biodiversity, population, conflicts, renewables recommended as the initial batch), cross-topic navigation via sparkline rail, scroll-driven progressive reveal on detail pages, animated chart transitions, keyboard shortcut navigation, and accessibility patterns (ARIA labels, hidden data tables).

**Addresses features:** Sparkline comparison rail, scroll-driven progressive reveal, animated data transitions, keyboard navigation/ARIA accessibility, tipping point threshold indicators (for temperature and CO2).

**Avoids pitfalls:** Mobile performance collapse (#5 -- with 5+ charts across topics, mobile staggering and animation-disable patterns are now exercised), SVG map performance (#4 -- conflicts or biodiversity topic likely introduces the first choropleth, requiring batched style mutations), localStorage quota (#7 -- with 5-8 cached topics, the caching strategy is tested at scale).

### Phase 4: Data Pipeline Scaling & Remaining Topics

**Rationale:** With the pattern proven for 5-8 topics, scale the GitHub Actions pipeline to handle all 28 topics and build out the remaining topic modules. This is the replication phase -- the template is validated, now apply it. Pipeline scaling must be deliberate to avoid rate limit cascades.

**Delivers:** All 28 topic pages, full GitHub Actions matrix workflow for cache updates, per-source health tracking in `meta.json`, `static-values.json` with fallbacks for all topics, main page navigation links to all topics.

**Addresses features:** Full topic coverage, shareable chart snapshots via Web Share API (now valuable with 28 shareable pages), "Did you know?" contextual facts.

**Avoids pitfalls:** GitHub Actions rate limit cascade (#3 -- matrix strategy with max-parallel:1 and request queuing tested at full scale), silent source failures (#14 -- per-source consecutive failure tracking added to pipeline), badge freshness misleading (#10 -- with 28 data sources of varying update frequencies, the badge must show data age, not fetch method).

### Phase 5: Advanced Interactions & Polish

**Rationale:** With all topics live and the data pipeline stable, add the high-complexity differentiator features that require a working foundation: historical annotations, country drill-down on maps, data export, and automated trend narration.

**Delivers:** Historical event annotations overlaid on charts, country/region drill-down on map-based topics, CSV/PNG data download, automated trend narration (rule-based), before/after comparison for select topics.

**Addresses features:** Historical trend annotations, country/region drill-down, data download (CSV/PNG), automated trend narration, before/after comparison.

**Avoids pitfalls:** These are the highest-complexity features. By deferring them to Phase 5, the infrastructure and topic patterns are stable. Map drill-down (#4) benefits from the batched rendering pattern established in Phase 3. Annotation data requires i18n, which is proven by this point (#9).

### Phase Ordering Rationale

- **Infrastructure before content:** Phases 1-2 build and prove the platform before any replication. Retrofitting destroy patterns, caching strategies, or accessibility across 28 topics is a rewrite.
- **One topic proves the pattern:** Phase 2 isolates the risk of the topic module template. If the contract is wrong, only one module needs refactoring.
- **Small batch validates scaling:** Phase 3 tests the pattern at 5-8 topics, catching localStorage limits, mobile performance, and i18n growth issues before committing to 28.
- **Pipeline scaling is deliberate:** Phase 4 explicitly addresses GitHub Actions minutes and rate limits as a first-class concern, not an afterthought.
- **Polish comes last:** Phase 5 features (annotations, drill-down, export) are valuable but non-essential. They layer on top of a working system rather than blocking it.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Chart.js lifecycle management -- the destroy/create pattern with WeakMap and IntersectionObserver interaction needs careful design. The CDN fallback strategy (self-host vs. dual-CDN) should be decided with a concrete test.
- **Phase 2:** CORS compatibility of the specific NOAA/NASA APIs must be tested from a browser context before finalizing the data source registry. The GitHub Actions cache workflow structure (matrix vs. separate jobs) should be prototyped.
- **Phase 4:** GitHub Actions minutes budget needs real measurement at 28-topic scale. Third-party API rate limits (World Bank, GBIF, Electricity Maps) should be documented per-source.
- **Phase 5:** Historical annotation data sourcing and i18n for event labels needs content research. Country drill-down feasibility depends on which topics have per-country data.

Phases with standard patterns (skip research-phase):
- **Phase 3:** Topic module authoring follows the template from Phase 2. Sparkline rail reuses existing `Charts.sparkline()`. Scroll reveal reuses existing `ScrollEngine`. These are well-documented existing patterns.
- **Phase 4 (topic authoring only):** Once the template is proven, remaining topics are content work, not architecture work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations use mature, stable Web APIs (URLSearchParams, IntersectionObserver, dynamic import). Chart.js 4.x is the only external library and its API is well-documented. Zero npm dependencies on frontend. The only MEDIUM item is the exact Chart.js patch version (verify at CDN load time). |
| Features | HIGH | Table stakes list is grounded in codebase analysis of existing patterns (data cards, SVG charts, i18n, ARIA). Differentiators are realistic given Chart.js capabilities. Anti-features align with explicit PROJECT.md constraints. Feature dependency graph is clear. |
| Architecture | HIGH | Component boundaries are cleanly defined with no circular dependencies. File system layout avoids modifying existing files. Data flow is unidirectional. Service worker extension pattern is sound. GitHub Actions matrix strategy is a documented feature. All patterns were derived from codebase analysis, not speculation. |
| Pitfalls | HIGH | 13 of 15 pitfalls rated HIGH confidence, backed by codebase evidence (specific line numbers cited for existing patterns that would cause issues). The two MEDIUM pitfalls (localStorage quota, i18n key count) are projections based on the planned 28-topic scale -- reasonable but untested. |

**Overall confidence:** HIGH -- This is a well-constrained expansion of a mature codebase using established web platform APIs and a single well-documented external library. The architecture adds a clean parallel layer without modifying the production main page. Research was conducted without WebSearch/WebFetch tools, but the findings rely on stable Web APIs and Chart.js behaviors that are well-established, not bleeding-edge.

### Gaps to Address

- **Chart.js exact version:** The 4.4.x version is from training data. Verify the latest stable 4.x release at CDN load time. The v4 API is stable so any 4.x version should work.
- **CORS compatibility registry:** Each of the ~15 external APIs must be tested from a browser context to determine which support CORS. This is Phase 2 validation work, not something researchable without live testing.
- **GitHub Actions minutes budget:** The projection (1,800-6,000 min/month for 28 topics) is a range. Actual consumption depends on job duration, which must be measured after the first cache workflow runs.
- **Open Graph meta tags on GitHub Pages:** Dynamic per-topic social preview meta tags require either pre-rendered HTML per topic or a JavaScript injection pattern. GitHub Pages has no server-side rendering. This needs a concrete solution design during Phase 2 or 3.
- **SVG world map file size:** The actual size of the SVG map file used in `maps.js` should be measured. If it exceeds 200KB, multiple maps per detail page will need the tabbed-interface approach from the pitfalls research.
- **Mobile performance baselines:** Current Lighthouse scores for the main page should be measured before detail page work begins, to establish a baseline for the Lighthouse >80 constraint.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `js/visualizations/charts.js`, `js/data-loader.js`, `js/visualizations/maps.js`, `js/visualizations/particles.js`, `js/i18n.js`, `js/app.js`
- Codebase analysis: `service-worker.js` (caching strategies, cache version)
- Codebase analysis: `scripts/collect-data.js`, `.github/workflows/data-pipeline.yml`
- Codebase analysis: `css/core.css`, `css/components.css` (design tokens, glass-morphism patterns)
- Project requirements: `.planning/PROJECT.md` (constraints, key decisions, active requirements)
- Web API specifications: URLSearchParams, IntersectionObserver, dynamic `import()`, AbortController, Fetch API, History API (all stable, baseline 2019-2020)

### Secondary (MEDIUM confidence)
- Chart.js 4.x API: destroy() lifecycle, responsive config, animation options, `toBase64Image()`, tooltip plugin (well-established API but version number unverified against live docs)
- Dashboard UX patterns: data freshness indicators, skeleton loading, error boundaries (based on established patterns in analytics dashboards)
- GitHub Actions: free tier limits (2,000 min/month, 20 concurrent jobs), matrix strategy, `continue-on-error` behavior (documented features)

### Tertiary (LOW confidence)
- Third-party API CORS status: NOAA, NASA, arXiv claimed CORS-blocked; USGS, World Bank, Open-Meteo claimed CORS-enabled -- these must be verified by browser testing before implementation
- Chart.js plugin versions: chartjs-plugin-datalabels `@2`, chartjs-chart-treemap `@2` are approximate and should be verified

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
