---
phase: 03-github-actions-pipeline
plan: 01
subsystem: infra
tags: [node, esm, gbif, noaa, world-bank, ucdp, cache-pipeline, fetch, retry]

# Dependency graph
requires:
  - phase: 01-data-layer-utilities
    provides: "data-loader Tier 2 cache contract (_meta.fetched_at)"
provides:
  - "Shared cache-utils.js module (fetchJSON, fetchText, extractWorldBankEntries, saveCache, CACHE_DIR)"
  - "biodiversity.json cache from GBIF species API"
  - "co2-history.json, ocean.json, solar.json caches from NOAA APIs"
  - "population.json, freedom.json, conflicts.json caches from World Bank/static/UCDP"
  - "data/cache/ directory ready for pipeline output"
affects: [03-02, 03-03, 04-co2, 04-population, 04-conflicts, 05-biodiversity]

# Tech tracking
tech-stack:
  added: []
  patterns: [cache-utils shared module, saveCache _meta envelope, ESM cache script structure, graceful API fallback]

key-files:
  created:
    - scripts/cache-utils.js
    - scripts/cache-biodiversity.js
    - scripts/cache-environment-ext.js
    - scripts/cache-society-ext.js
    - data/cache/.gitkeep
  modified: []

key-decisions:
  - "AbortController for timeout (not AbortSignal.timeout) for cross-environment portability"
  - "UCDP conflicts uses static fallback when API returns 401 (token required since Feb 2026)"
  - "Freedom House data is static in-script array (no API available, updates annually)"
  - "Ocean SST uses Climate at a Glance fallback when Coral Reef Watch is unavailable"

patterns-established:
  - "Cache script template: shebang, ESM import from cache-utils.js, async main(), per-topic try/catch, saveCache() calls, exit(1) on total failure"
  - "saveCache envelope: _meta.fetched_at + source + version spread before topic data"
  - "API fallback chain: try primary API, catch and log, fall back to alternative or static data"

requirements-completed: [ACTIONS-02, ACTIONS-03, ACTIONS-04]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 3 Plan 01: Cache Utilities and First Cache Scripts Summary

**Shared cache-utils.js with fetchJSON/fetchText/extractWorldBankEntries/saveCache plus 3 cache scripts producing 7 JSON files from GBIF, NOAA, World Bank, and UCDP APIs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T14:55:20Z
- **Completed:** 2026-03-21T14:58:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Shared cache-utils.js extracts reusable fetch/retry/save patterns from collect-data.js as ESM exports
- 3 cache scripts fetch from 8 distinct API endpoints producing 7 cache JSON files
- All cache files satisfy the Tier 2 contract: valid JSON with _meta.fetched_at ISO timestamp
- Graceful degradation: UCDP auth failure falls back to static dataset, Coral Reef Watch falls back to Climate at a Glance

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared cache-utils.js and data/cache directory** - `754e2c7` (feat)
2. **Task 2: Create cache-biodiversity.js, cache-environment-ext.js, and cache-society-ext.js** - `f3e8250` (feat)

## Files Created/Modified
- `scripts/cache-utils.js` - Shared module: fetchJSON, fetchText, extractWorldBankEntries, saveCache, CACHE_DIR
- `scripts/cache-biodiversity.js` - GBIF threatened species counts (vulnerable, endangered, critically endangered)
- `scripts/cache-environment-ext.js` - NOAA CO2 monthly history, ocean SST anomaly, solar cycle predictions
- `scripts/cache-society-ext.js` - World Bank population/urban, Freedom House trend (static), UCDP conflicts (static fallback)
- `data/cache/.gitkeep` - Directory placeholder for cache output

## Decisions Made
- AbortController used for timeout instead of AbortSignal.timeout for Node.js portability
- UCDP API returns 401 without token -- static fallback with 56 active conflicts (2024 dataset v24.1) is acceptable since data-loader has Tier 3 fallback as well
- Freedom House global freedom scores stored as in-script const array (2006-2025) since no API exists
- Ocean SST parser handles both string and object response formats from NOAA Climate at a Glance API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ocean SST anomaly parser for object response format**
- **Found during:** Task 2 (cache-environment-ext.js)
- **Issue:** NOAA Climate at a Glance API returns `{ anomaly: number }` objects per year, not plain strings. parseFloat on an object produces NaN, resulting in 0 records.
- **Fix:** Added type check: if value is an object, extract `.anomaly` property before parseFloat
- **Files modified:** scripts/cache-environment-ext.js
- **Verification:** Re-ran script, now produces 146 annual SST anomaly records
- **Committed in:** f3e8250 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for correct ocean data. No scope creep.

## Issues Encountered
- Coral Reef Watch primary endpoint returns non-JSON -- gracefully caught and falls back to Climate at a Glance as designed in the plan
- UCDP API requires authentication token (401) -- falls back to static dataset as designed in the plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- cache-utils.js ready for import by the 3 remaining cache scripts (03-02: economy-ext, progress-ext, disasters)
- data/cache/ directory exists for all cache file output
- 7 of 14 planned cache files now produced
- UCDP_API_TOKEN environment variable can be added as GitHub Secret if live conflict data is desired (optional)

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (754e2c7, f3e8250) verified in git log.

---
*Phase: 03-github-actions-pipeline*
*Completed: 2026-03-21*
