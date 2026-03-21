# Codebase Concerns

**Analysis Date:** 2026-03-21

## Tech Debt

**Monolithic Frontend Controller:**
- Issue: `js/app.js` is 1,355 lines — a single class (BelkisOne) handles all initialization, scroll events, section rendering, interactions, and timeline logic with 80+ private methods
- Files: `js/app.js`
- Impact: Difficult to test, modify, or reuse components. Adding new sections requires touching the main controller. Risk of side-effects across unrelated features.
- Fix approach: Extract visualization builders into separate classes (`EnvironmentBuilder`, `SocietyBuilder`, etc.). Move timeline logic to separate module. Create composition-based architecture instead of monolithic class.

**Hardcoded Constants in Maps:**
- Issue: Large lookup tables for climate risk, hunger risk, nature scores, and renewable energy are embedded as static objects in `js/visualizations/maps.js` (lines 11-68). These are 180+ lines of hardcoded country data with approximation-based values.
- Files: `js/visualizations/maps.js`
- Impact: Updates require code changes and redeploy. Data inconsistency risk if same metrics exist elsewhere. No single source of truth for geospatial metadata.
- Fix approach: Move all country metadata to `data/processed/` as `country-index.json`. Load dynamically at app start. Update from centralized source during data pipeline.

**Data Pipeline Tightly Coupled to Hardcoded APIs:**
- Issue: `scripts/collect-data.js` defines 40+ fetcher functions as individual async functions in a single 1,000+ line file. Adding/removing sources requires editing the script and the main() function.
- Files: `scripts/collect-data.js` (lines 100-950+)
- Impact: No plugin system. Source registration is manual. Failure in one fetcher doesn't gracefully degrade. Adding regional datasources requires duplicating logic.
- Fix approach: Create a registry pattern. Define sources as objects: `{ name, url, parser, retries, category }`. Loop registry in main(). Allow source enable/disable via config file.

**Error Handling Uses Silent Failures:**
- Issue: Multiple `catch` blocks in both client and server code silently swallow errors with try-catch that catches errors but continues execution. Examples:
  - `data-loader.js` line 72: `catch { return null; }` (no error logged)
  - `process-data.js` line 19: `catch { return null; }` silently fails to read raw files
  - `collect-data.js` line 188: `catch { /* skip */ }` in city iteration
- Files: `js/data-loader.js`, `scripts/collect-data.js`, `scripts/process-data.js`
- Impact: Bugs buried in logs or logs never reviewed. Data quality degradation goes unnoticed. Pipeline may produce partial/stale output without warning.
- Fix approach: Implement proper error tracking. Log all failures with context (URL, attempt #, error message). Emit errors to monitoring system. Fail fast on critical paths, graceful degrade on optional ones.

**XSS Vulnerability in innerHTML Usage:**
- Issue: Multiple uses of `innerHTML` with mixed escaped and unescaped content. Examples:
  - `js/app.js` line 280-283: `trendEl.innerHTML` using template with variable interpolation
  - `js/app.js` line 312-318: AQI card built with `innerHTML` — uses `this._esc()` for city/country but inline styles not validated
  - `js/app.js` line 365-385: Refugee flows table uses `this._esc()` on names but HTML structure injected directly
- Files: `js/app.js` (lines 280, 306, 312, 324, 333, 365, 442, 462, 496, 539, 557, 570, 583, 668, 764, 770, 798-813)
- Impact: If any API returns malicious content (compromised source or man-in-the-middle), script injection possible. Refugee flow names, news headlines, country names could all be vectors.
- Fix approach: Use `textContent` + `appendChild` instead of `innerHTML`. For complex layouts, use template literals with validation. Implement CSP header: `script-src 'self'`. Validate all external data against schema before rendering.

## Known Bugs

**Infinite Reveal Element Fallback:**
- Symptoms: If IntersectionObserver doesn't fire in 1.5 seconds, all .reveal elements forced visible at once instead of staggered reveal
- Files: `js/scroll-engine.js` line 114-121
- Trigger: Slow performance on low-end devices or when observer is blocked. Causes jumpy page layout shift.
- Workaround: Disable fallback by removing setTimeout or increase threshold from 20 to 1 element before fallback triggers.

**Timeline Snapshot Cache Memory Leak:**
- Symptoms: Switching through timeline snapshots indefinitely causes memory to grow. After ~50-100 snapshots, observable slowdown on low-memory devices.
- Files: `js/data-loader.js` line 147-162 (snapshot cache LRU)
- Trigger: User repeatedly clicking timeline slider or programmatic snapshot loading. Cache is bounded to 20 entries but entries are never explicitly freed.
- Workaround: Reload page after viewing many snapshots. Browser garbage collection eventually clears old snapshots but not immediately.

**Dark Mode CSS Custom Properties Undefined on Load:**
- Symptoms: First paint of app may show incorrect particle colors if CSS custom properties not yet evaluated
- Files: `js/app.js` line 109-118 (particle initialization), `css/core.css`
- Trigger: Race condition if particle system initializes before CSSOM is fully parsed
- Workaround: Delay `_initParticles()` or use fallback color values from JavaScript instead of CSS variables

**Service Worker Cache Strategy Mismatch:**
- Symptoms: Users may see stale data (6+ hours old) even after refresh if service worker serves old cached response
- Files: `service-worker.js` line 50-87
- Trigger: User goes offline, returns online, page doesn't refetch because service worker returns stale data without revalidation
- Workaround: Hard refresh (Ctrl+Shift+R) bypasses cache, or manually clear site data from browser settings

## Security Considerations

**No Content Security Policy:**
- Risk: XSS attacks through compromised data sources. Malicious content in earthquake locations, news headlines, country names could inject scripts.
- Files: `index.html`, all JS files rendering external data
- Current mitigation: HTML escaping in some places (`this._esc()` function in `js/app.js`), but inconsistently applied
- Recommendations:
  1. Add CSP header: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';` (unsafe-inline needed for dynamic styles)
  2. Audit all `innerHTML` calls — use `textContent` or template cloning instead
  3. Validate all API responses against strict JSON schemas before use
  4. Use Subresource Integrity (SRI) for any CDN assets if added

**API Keys in Fetch Headers:**
- Risk: No sensitive API keys currently hardcoded, but potential if migration to authenticated APIs occurs
- Files: `scripts/collect-data.js` line 25, 61 (User-Agent header safe, but pattern established)
- Current mitigation: Using only free APIs; no secrets in code
- Recommendations:
  1. If adding authenticated sources, use `process.env` variables only in scripts
  2. Never commit `.env` files; maintain example `.env.example` in repo
  3. Use GitHub Secrets for automated pipeline execution
  4. Rotate API keys monthly; document rotation process

**localStorage Used Without Expiry Validation:**
- Risk: Stale data persisted in localStorage indefinitely if TTL check fails. Old cache could be served as current.
- Files: `js/data-loader.js` line 59-75, `js/i18n.js` line 739-748
- Current mitigation: 6-hour TTL for world-state cache; no expiry for language preference (acceptable)
- Recommendations:
  1. Add explicit console warning if cached data age > 24 hours
  2. Implement cache versioning: prepend version to cache key (`world-one-v1-data`)
  3. On version bump, old cached data is automatically ignored

**No HTTPS Requirement / Mixed Content:**
- Risk: If deployed over HTTP, all external API calls to HTTPS sources create mixed-content warnings; user data (GDPR) not encrypted in transit
- Files: All fetch calls assume HTTPS but no enforcement
- Current mitigation: Assumes HTTPS deployment (manifest.json, GitHub Pages deploy)
- Recommendations:
  1. Add `<meta http-equiv="upgrade-insecure-requests">` to ensure HTTP→HTTPS redirect
  2. Enable HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  3. Ensure all API URLs use HTTPS; fail fetch if HTTP requested

## Performance Bottlenecks

**Canvas Particle System with 1000+ Particles on Desktop:**
- Problem: ParticleSystem creates 1000 particles on desktop (300 on mobile) and animates all via `requestAnimationFrame`. Each frame: update position, velocity, render to canvas. No spatial partitioning or culling.
- Files: `js/visualizations/particles.js` line 47-118
- Cause: Naive O(n) particle update loop; no GPU acceleration; unthrottled mouse tracking at 16ms intervals
- Improvement path:
  1. Reduce particle count: 600 desktop / 200 mobile (visual difference minimal)
  2. Implement simple grid-based spatial partitioning to skip far-away particles
  3. Use OffscreenCanvas if workers support available for parallel updates
  4. Cache particle state to minimize DOM queries per frame

**Main App init() Runs All Visualizations Immediately:**
- Problem: `js/app.js` lines 44-87 calls `_initVisualizations()`, `_primeInitialRender()`, and 8+ section builders in sequence before user scrolls to them. Loading time appears slow.
- Files: `js/app.js` line 62, 200-241 (lazy-build flags suggest intent but not implemented)
- Cause: Sections are built in `_primeInitialRender()` even if user never scrolls to them; maps, charts, and counters created off-screen
- Improvement path:
  1. Build visualizations only on first scroll into view (IntersectionObserver callback)
  2. Keep current pre-render for above-the-fold content only (prolog + indicator)
  3. Defer environment/society/economy/progress builds to scroll event
  4. Measure: log build time per section to identify real bottlenecks

**SVG Maps Rendered with 200+ Country Paths:**
- Problem: Full world map with all countries rendered as SVG paths. Each scroll event may trigger map re-coloring. Maps are built in `_updateEnvironment`, `_updateSociety`, etc. with full DOM manipulation.
- Files: `js/visualizations/maps.js`, used from `js/app.js` line 668+
- Cause: Full re-render of map on every section scroll progress. No incremental updates or batching.
- Improvement path:
  1. Build map once, store DOM references
  2. Update colors only via style attribute or CSS class toggle, not full innerHTML
  3. Use requestAnimationFrame to batch color updates
  4. Consider SVG sprite or canvas fallback for 5000+ pixel viewport (though unlikely)

**Data Validation Happens in Process Pipeline, Not Frontend:**
- Problem: Large JSON responses from APIs (earthquake data, news feeds) validated only during collection. Frontend receives unvalidated data and renders directly to DOM.
- Files: `scripts/process-data.js`, `js/app.js`
- Cause: Trust boundary crossed — assumes processed data is always valid
- Improvement path:
  1. Add lightweight runtime validation on frontend: check array length, number ranges, required fields
  2. Fail gracefully if data invalid (skip rendering, show "Data unavailable" instead of crashing)
  3. Log validation failures to console for debugging

## Fragile Areas

**Data Processing Pipeline (scripts/process-data.js):**
- Files: `scripts/process-data.js` (1,400+ lines)
- Why fragile:
  - Complex scoring algorithm with 3 interdependent checks (existence, balance, cascading) — line 66-132 — with magic numbers (15, 25, 0.6, etc.)
  - Hardcoded category order matters (environment, society, economy, progress, realtime, momentum)
  - Fallback values throughout assume specific data structure; if API changes, defaults hide the problem
  - No version control on output schema — if processed data structure changes, frontend breaks without obvious cause
- Safe modification:
  1. Document all magic numbers with references (e.g., "15 = existence floor per World Health Org threshold")
  2. Extract magic numbers to config object at top of file
  3. Add schema version to `world-state.json`: `{ version: 1, data: {...} }`
  4. Frontend must validate version and fail loudly if mismatch
- Test coverage: No test files found; integration tests should verify:
  - Empty/missing source data doesn't crash processor
  - Output schema is always valid
  - World index stays in 0-100 range
  - Sum of weighted subscores equals world index

**Scroll Engine Progress Calculation (js/scroll-engine.js):**
- Files: `js/scroll-engine.js` line 142-170 (main loop)
- Why fragile:
  - Depends on DOM elements existing with exact selectors (`#prolog`, `[data-section="..."]`)
  - Progress calculated from intersection ratio — if CSS changes scroll height, calculations break
  - Two separate observers (section observer + reveal observer) with different thresholds — easy to create reveal elements that never trigger
  - 1.5-second fallback hardcoded — if network slow, false positive fallback triggers
- Safe modification:
  1. Never remove or rename sections without updating scroll engine registration
  2. Test scroll on low-end device: ensure reveal elements appear without fallback
  3. Adjust fallback threshold based on actual network performance, not arbitrary time
  4. Log when fallback triggers for debugging

**i18n System with String Keys (js/i18n.js):**
- Files: `js/i18n.js` (800 lines, 200+ translation keys)
- Why fragile:
  - String keys are typo-prone (`data-i18n="act1.title"` vs `act1.titel`)
  - No key validation at build time; missing keys silently show as `[missing: act1.titel]`
  - HTML attributes with `data-i18n` and JavaScript i18n.t() calls duplicate logic
  - Adding new language requires copying all 200+ keys; risk of incomplete translation
- Safe modification:
  1. Use TypeScript with i18n key union types (e.g., `type I18nKey = 'act1.title' | 'act1.desc' | ...`)
  2. Add linter rule to fail if key not found in translations object
  3. Generate key list at build time; fail deploy if keys don't match JS calls
  4. Create i18n validation test: iterate all `data-i18n` attributes, verify keys exist

## Scaling Limits

**localStorage Size Limit (5-10 MB):**
- Current capacity: World-state JSON ~108 KB, plus snapshots × 20 entries × 107 KB = ~2.1 MB total
- Limit: Typically 5-10 MB per origin in browsers; some old devices 2-3 MB
- Scaling path:
  1. Current snapshot cache uses 20-entry LRU — adequate for 2.1 MB
  2. If expanding to 100+ snapshots, switch to IndexedDB (larger quota, async)
  3. Implement compression: gzip snapshots before caching (reduce 107 KB → ~20 KB per snapshot)

**Particle System Frame Rate on Mobile:**
- Current: 300 particles on mobile, 1000 on desktop; 60 FPS target
- Limit: Low-end devices (2018 mid-range phones) struggle to sustain 60 FPS above 500 particles
- Scaling path:
  1. Profile on Pixel 4a / iPhone 11 (representative mid-range): measure FPS, identify if canvas or scroll is bottleneck
  2. Adaptive particle count based on FPS: start with 300, increase to 500 if stable 60 FPS maintained for 5 seconds
  3. Disable particles entirely on devices with < 2GB RAM if available via navigator.deviceMemory API

**Timeline Manifest File Growth:**
- Current: 20-30 snapshots per day × 365 days = ~11K snapshots/year
- Limit: Manifest JSON with 11K entries becomes unwieldy to parse; data/history/ directory with 11K JSON files slow to serve
- Scaling path:
  1. Implement snapshot archival: move snapshots >90 days old to `data/history/archive/YYYY-MM/`
  2. Split manifest: monthly manifests instead of one global manifest
  3. Implement snapshot downsampling: keep 1-per-hour for recent week, 1-per-day for recent month, 1-per-week older

## Dependencies at Risk

**Open-Meteo Air Quality API (Free Tier Unstable):**
- Risk: No SLA; free tier throttling increased 2025. Jan 2025 peak requests blocked.
- Impact: Air quality data missing from report; section shows "Data unavailable"
- Migration plan:
  1. Add fallback to World Air Quality Index (waqi.info) but requires API key (free tier available but limited)
  2. Cache last successful response indefinitely (currently 6h TTL); serve stale data rather than fail

**rss-parser Package (3.13.0):**
- Risk: Low maintenance; 50+ open issues on GitHub; security patch lag
- Impact: RSS parsing from news feeds (UN, WHO, etc.) fails silently; breaking change in feed format causes crash
- Migration plan:
  1. Replace with native DOMParser for simple RSS parsing (don't need full parser)
  2. Implement custom RSS→JSON converter specific to expected feed structure
  3. Add fallback: if RSS parsing fails, fetch and parse Atom feeds instead

## Missing Critical Features

**No Retry-on-Stale Data:**
- Problem: If one data source fails, entire pipeline skips that category. User sees 24h old data without warning.
- Blocks: Can't reliably detect data freshness; users don't know if displayed info is current or cached
- Feature: Add `_age` field to each category: `{ environment: { _age: "2 minutes ago", ... } }`. If age > 2 hours, show warning badge.

**No Data Validation Schema:**
- Problem: Process pipeline outputs world-state.json with no schema validation. A typo in processing produces invalid JSON accepted by frontend.
- Blocks: Impossible to safely refactor data structure; changes are fragile
- Feature: Add JSON Schema file (schema.json) defining world-state structure. Validate in process pipeline before writing; fail if invalid. Frontend loads schema and validates received data.

**No Offline Mode:**
- Problem: Service worker caches static assets but data endpoint requires network. If offline, app crashes on load.
- Blocks: Can't view historical snapshots offline; can't browse at all without network
- Feature: Pre-load 3-5 most recent snapshots into service worker cache during install. Offer "last snapshot" mode if offline.

## Test Coverage Gaps

**Frontend Unit Tests Missing:**
- What's not tested: All visualization classes (ParticleSystem, WorldIndicator, Charts, Maps) have no unit tests. Scroll engine logic untested.
- Files: `js/visualizations/particles.js`, `js/visualizations/world-indicator.js`, `js/scroll-engine.js` (entire files untested)
- Risk: Refactoring particle system breaks animations but isn't caught until manual testing. Maps color logic has no regression tests.
- Priority: **High** — visualizations are core experience; bugs here are immediately visible to users

**Integration Tests Missing:**
- What's not tested: Data loader cache fallback logic, snapshot switching, language toggle persistence, scroll section binding
- Files: `js/data-loader.js`, `js/app.js` (critical paths untested)
- Risk: Break cache fallback (serve empty data), add language but forget to wire in app init, refactor scroll logic and break section detection
- Priority: **High** — these are failure paths; don't surface until user experiences them

**Pipeline End-to-End Tests Missing:**
- What's not tested: collect-data.js → process-data.js → world-state.json validation. No tests verify:
  - Each data source producer returns expected structure
  - Missing source doesn't crash processor
  - Output world-state.json is always valid and world index ∈ [0, 100]
  - Processed data matches frontend schema expectations
- Files: `scripts/collect-data.js`, `scripts/process-data.js` (no tests found)
- Risk: Source API changes silently produce invalid data; world index calculations drift; frontend crashes on startup due to bad data
- Priority: **Critical** — entire dashboard depends on data pipeline; bugs here break the app for all users

---

*Concerns audit: 2026-03-21*
