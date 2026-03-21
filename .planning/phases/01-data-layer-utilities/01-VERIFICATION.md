---
phase: 01-data-layer-utilities
verified: 2026-03-21T00:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 1: Data Layer & Utilities Verification Report

**Phase Goal:** Users never see broken or missing data -- every data request resolves through live API, cached JSON, or static fallback, with a visible badge showing which tier served the data.
**Verified:** 2026-03-21
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

All truths derive from the ROADMAP.md success criteria and the three PLAN must_haves sections.

#### Plan 01-01 Truths (Data Loader)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A data request with a working API returns live data with tier: 'live' | VERIFIED | `fetchTopicData` tier-1 block: `return { data, tier: 'live', age: 0 }` at line 55 |
| 2 | A data request with a failing API falls back to cached JSON with tier: 'cache' and an age value | VERIFIED | Tier-2 block fetches `data/cache/${topic}.json`, calls `_getCacheAge(data)`, returns `{ data, tier: 'cache', age }` at line 70 |
| 3 | A data request with no API and no cache returns static fallback with tier: 'static' | VERIFIED | Tier-3 block calls `_getStaticFallback(topic)`, returns `{ data: staticData, tier: 'static', age: null }` at line 80 |
| 4 | fetchWithTimeout aborts after 5 seconds on slow/unresponsive endpoints | VERIFIED | Uses `AbortSignal.timeout(timeoutMs)` at line 30; `fetchTopicData` passes `5000` at line 51 |
| 5 | Static fallback file contains all 28 topic keys with correct schema | VERIFIED | `node scripts/validate-fallback.js` exits 0: "All 28 topic keys present", "Validation PASSED" |
| 6 | Phase 4 topics (co2, temperature, earthquakes, population, conflicts) have real values with year and source | VERIFIED | JSON confirmed: all 5 topics have complete data points with value/year/source fields |

#### Plan 01-02 Truths (Badge Renderer)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | A LIVE tier result produces a badge with a pulsing red dot and 'LIVE' text | VERIFIED | `variantMap.live = 'data-badge--live'`; `data-badge__dot` span prepended for live tier; `.data-badge__dot` has `animation: livePulse` in CSS |
| 8 | A Cache tier result produces a gray badge with 'Cache' text | VERIFIED | `variantMap.cache = 'data-badge--cache'` (when not stale); `.data-badge--cache` CSS: gray `rgba(142,142,147)` |
| 9 | A Cache tier result older than 24 hours produces an orange badge with 'Cache' text | VERIFIED | `isStale = tier === 'cache' && age !== null && age > 86400000`; `variantMap.cache = 'data-badge--stale'`; `.data-badge--stale` CSS: orange `rgba(255,149,0)` |
| 10 | A Static tier result produces a gray badge with 'Statisch/Static' text and reference year | VERIFIED | `variantMap.static = 'data-badge--static'`; year appended as text when `year != null`; i18n key `badge.static: 'Statisch'` (DE), `'Static'` (EN) |
| 11 | Badge labels are translatable (DE/EN) via existing i18n system | VERIFIED | `i18n.t('badge.live/cache/static/staleWarning')` called in badge.js; all 4 keys present in both DE and EN objects in i18n.js |
| 12 | Badge has aria-label for accessibility | VERIFIED | `attrs['aria-label'] = label` set on every badge span at line 53 |

#### Plan 01-03 Truths (Chart Manager)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 13 | Chart.js 4.x loads from CDN on first use (not at page load) | VERIFIED | `ensureChartJs()` is exported but not called at module load; `_loadScript` injects `<script>` on first call |
| 14 | If jsDelivr CDN fails, cdnjs fallback loads Chart.js successfully | VERIFIED | `.catch(() => _loadScript('https://cdnjs.cloudflare.com/...'))` chain at lines 23-24 |
| 15 | After Chart.js loads, global dark-theme defaults are applied before any chart creation | VERIFIED | `.then(() => { _chartJsLoaded = true; _applyDarkDefaults(); ... })` at lines 26-28; `_applyDarkDefaults()` sets all Chart.defaults before resolve |
| 16 | Every Chart instance created through the registry is tracked by canvas ID | VERIFIED | `_instances.set(canvasId, chart)` at line 144; Map used for O(1) lookup |
| 17 | Destroying a chart by canvas ID calls Chart.destroy() and removes it from the registry | VERIFIED | `existing.destroy(); _instances.delete(canvasId)` at lines 157-158 |
| 18 | destroyAllCharts() cleans up every tracked instance (no orphaned canvases) | VERIFIED | Iterates `_instances`, calls `chart.destroy()`, then `_instances.clear()` at lines 168-171 |
| 19 | Creating a chart on a canvas that already has one destroys the old instance first | VERIFIED | `createChart` calls `destroyChart(canvasId)` as first statement at line 135 |

**Score:** 16/16 truths verified (truths 17-19 beyond original 16 are bonus coverage from plan 03)

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Exports | Status | Details |
|----------|-----------|--------------|---------|--------|---------|
| `js/utils/data-loader.js` | 60 | 122 | fetchTopicData, fetchWithTimeout | VERIFIED | Substantive implementation, no stubs |
| `data/fallback/static-values.json` | 50 | 55 | n/a (data file) | VERIFIED | 28 keys, 5 populated, validator passes |
| `scripts/validate-fallback.js` | 30 | 146 | n/a (script) | VERIFIED | Exits 0, ESM, full schema checks |
| `js/utils/badge.js` | 30 | 62 | createTierBadge | VERIFIED | Substantive; 4 tier variants, aria-label |
| `css/components.css` | n/a | addition | .data-badge (5 classes) | VERIFIED | All variants present: base, --live, --cache, --stale, --static, __dot |
| `js/i18n.js` | n/a | addition | badge.* keys | VERIFIED | 4 keys in both DE and EN |
| `js/utils/chart-manager.js` | 100 | 172 | ensureChartJs, createChart, destroyChart, destroyAllCharts, CHART_COLORS, toRgba | VERIFIED | All 6 exports confirmed via Node.js ESM import |

---

### Key Link Verification

#### Plan 01-01 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `js/utils/data-loader.js` | `data/cache/{topic}.json` | `fetch()` for cache tier | VERIFIED | `fetch('data/cache/${topic}.json')` at line 64 |
| `js/utils/data-loader.js` | `data/fallback/static-values.json` | `fetch()` for static tier | VERIFIED | `fetch('data/fallback/static-values.json')` at line 113 |

Note: `data/cache/` directory does not yet exist on disk. This is expected -- the cache tier uses a try/catch and falls through to static when cache files are absent. The data/cache/ directory will be populated by the GitHub Actions pipeline (Phase 3).

#### Plan 01-02 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `js/utils/badge.js` | `js/utils/dom.js` | `import { DOMUtils } from './dom.js'` | VERIFIED | Import confirmed at line 5; `DOMUtils.create()` called at lines 39, 61 |
| `js/utils/badge.js` | `js/i18n.js` | `import { i18n } from '../i18n.js'` | VERIFIED | Import confirmed at line 6; `i18n.t()` called at lines 32, 58 |
| `css/components.css` | `css/animations.css` | livePulse keyframe reference | VERIFIED | `.data-badge__dot` uses `animation: livePulse` at line 291; keyframe defined in animations.css at line 103 |

#### Plan 01-03 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `js/utils/chart-manager.js` | jsDelivr CDN | script tag injection (primary) | VERIFIED | `_loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.5.1/...')` at line 22 |
| `js/utils/chart-manager.js` | cdnjs CDN | script tag injection (fallback) | VERIFIED | `.catch(() => _loadScript('https://cdnjs.cloudflare.com/...'))` at line 24 |
| `js/utils/chart-manager.js` | `window.Chart` | UMD auto-registration after script load | VERIFIED | `Chart.defaults.*` used throughout `_applyDarkDefaults()` (lines 63-89) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 01-01-PLAN.md | Central data-loader utility with fetchWithTimeout (5s) and 3-tier fallback | SATISFIED | `js/utils/data-loader.js` implements full 3-tier chain with AbortSignal.timeout(5000) |
| INFRA-02 | 01-02-PLAN.md | Badge renderer -- LIVE pulsing red, Cache gray/orange (>24h), Static gray reference | SATISFIED | `js/utils/badge.js` + CSS variants cover all states; pulsing dot reuses livePulse keyframe |
| INFRA-03 | 01-01-PLAN.md | Static fallback values file with value, year, source for every data point | SATISFIED | `data/fallback/static-values.json` validated: 28 keys, 5 populated with correct schema |
| INFRA-04 | 01-03-PLAN.md | Chart.js 4.x loaded via CDN (jsDelivr primary, cdnjs fallback) with defer and global dark-theme defaults | SATISFIED | `ensureChartJs()` implements singleton CDN load; `_applyDarkDefaults()` sets all chart defaults before any creation |
| INFRA-05 | 01-03-PLAN.md | Chart instance registry with mandatory destroy() lifecycle to prevent canvas memory leaks | SATISFIED | `_instances` Map tracks all charts; `createChart` auto-destroys before recreating; `destroyAllCharts` clears all |

**Orphaned requirements check:** REQUIREMENTS.md maps INFRA-01 through INFRA-05 to Phase 1. No orphaned IDs -- all five are claimed by plans and verified above. INFRA-06 and INFRA-07 are correctly mapped to later phases (Phase 5 and Phase 3 respectively).

---

### Anti-Patterns Found

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| All phase 1 files | TODO/FIXME/PLACEHOLDER | -- | None found |
| All phase 1 files | return null / empty stubs | -- | No stub returns in main code paths |
| `js/utils/badge.js` | console.log only implementations | -- | No console-only handlers; all tier logic is complete |

No anti-patterns found across any of the 5 implementation files (data-loader.js, badge.js, chart-manager.js, static-values.json, validate-fallback.js) or the 2 modified files (css/components.css, js/i18n.js).

---

### Human Verification Required

The following items cannot be verified programmatically and require browser testing. They are listed for completeness but do not block PASSED status since all automated checks pass.

#### 1. LIVE Badge Visual Appearance

**Test:** Open a detail page that calls `fetchTopicData` with a valid API URL. Inspect the returned badge element in the DOM.
**Expected:** A small pill badge with a pulsing red dot on the left and the text "LIVE" (EN) or "LIVE" (DE), matching the glass-morphism design.
**Why human:** Visual animation (livePulse) and rendering context require a browser.

#### 2. Cache Stale Badge Threshold Behavior

**Test:** Construct a `data/cache/co2.json` with `_meta.fetched_at` set to 25+ hours ago. Call `fetchTopicData('co2')` with no API URL. Inspect the badge.
**Expected:** Orange badge with "Cache" text and a title tooltip showing the stale warning.
**Why human:** Requires controlled cache file state and a browser DOM environment.

#### 3. Chart.js CDN Fallback

**Test:** Block jsDelivr in DevTools network panel, then call `await ensureChartJs()` in the browser console.
**Expected:** Chart.js loads from cdnjs fallback; `[ChartManager] Loading:` log appears for the cdnjs URL; `[ChartManager] Chart.js loaded` confirms success.
**Why human:** Requires network interception in a real browser.

#### 4. Reduced Motion Chart Defaults

**Test:** Enable "Reduce motion" in OS accessibility settings, load a page that calls `ensureChartJs()`.
**Expected:** `Chart.defaults.animation` is set to `false`; charts render without animation.
**Why human:** Requires OS accessibility setting + browser observation.

---

### Verified Git Commits

All implementation commits confirmed in repository:

| Commit | Description |
|--------|-------------|
| `c8837e3` | feat(01-01): create 3-tier data fallback loader utility |
| `c128a73` | feat(01-01): add static fallback values and validation script |
| `ec99e69` | feat(01-03): add Chart.js CDN loader with dark-theme defaults and color palette |
| `398951c` | feat(01-02): create data tier badge renderer and CSS styles |
| `28734ce` | feat(01-02): add badge i18n keys to DE/EN translation system |

---

### Summary

Phase 1 goal is achieved. All three shared utility modules are substantive, complete implementations -- not stubs. The 3-tier data fallback chain is fully wired (live API -> cached JSON -> static file). The badge renderer correctly maps tier metadata to visual states and reuses existing animation infrastructure. The chart manager implements deferred CDN loading with fallback, applies dark-theme defaults before any chart creation, and tracks all instances for mandatory cleanup. The static fallback file covers all 28 planned topics with correct schema for the 5 Phase 4 topics. The validation script confirms schema integrity programmatically. No anti-patterns were found. All 5 requirement IDs (INFRA-01 through INFRA-05) are fully satisfied.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
