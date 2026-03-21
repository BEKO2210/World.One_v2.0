---
phase: 04-first-topics
plan: 01
subsystem: ui
tags: [co2, chart.js, i18n, data-loader, keeling-curve, topic-module]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: data-loader.js, chart-manager.js, badge.js, dom.js, math.js utilities
  - phase: 02-detail-shell
    provides: detail-app.js shell, topic module contract, _stub.js reference
  - phase: 03-github-pipeline
    provides: data/cache/co2-history.json with 800+ monthly records
provides:
  - Fixed data-loader.js path resolution for detail/ subdirectory (unblocks all topic modules)
  - Complete i18n keys for all 5 Phase 4 topics (co2, temperature, earthquakes, population, conflicts)
  - CO2 topic module implementing full topic contract (meta, render, getChartConfigs, cleanup)
  - Keeling Curve line chart config and emissions per-capita bar chart config
affects: [04-02-temperature, 04-03-earthquakes-population-conflicts, all-future-topic-modules]

# Tech tracking
tech-stack:
  added: []
  patterns: [topic-module-pattern, _basePath-fetch-resolution, lazy-chart-config, greenhouse-infographic-dom]

key-files:
  created:
    - detail/topics/co2.js
  modified:
    - js/utils/data-loader.js
    - js/i18n.js

key-decisions:
  - "Added _basePath() helper using window.location.pathname check instead of hardcoded prefix"
  - "All topic i18n keys added upfront in one task to unblock parallel plan execution"
  - "CO2 tries Open-Meteo Air Quality API for live ppm, falls back to cache monthly[-1], then static 427.5"
  - "Greenhouse infographic uses DOMUtils.create with styled divs (no SVG, no images)"
  - "Top 10 emitters hardcoded from World Bank 2020 data -- no live API call for this chart"

patterns-established:
  - "Topic module pattern: import utilities, export {meta, render, getChartConfigs, cleanup}, store chart data in module state for lazy getChartConfigs()"
  - "_basePath() pattern: detect /detail/ in URL pathname for correct relative fetch() paths"
  - "Chart container pattern: canvas inside div with style='position:relative; height:350px;' for Chart.js responsive mode"

requirements-completed: [ENV-01]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 4 Plan 1: CO2 Topic Module Summary

**Fixed data-loader subdirectory path resolution, added 90+ i18n keys for 5 topics, and built complete CO2 topic module with Keeling Curve line chart, emissions bar chart, and greenhouse effect infographic**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T16:09:03Z
- **Completed:** 2026-03-21T16:13:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed data-loader.js path resolution bug that blocked ALL topic modules from loading data in the detail/ subdirectory
- Added ~90 i18n translation keys (DE+EN) for co2, temperature, earthquakes, population, and conflicts -- unblocking Plans 02 and 03 for parallel execution
- Implemented complete CO2 topic module (617 lines) proving the end-to-end topic pattern: live API fallback, Keeling Curve chart, emissions bar chart, tiles, greenhouse infographic, sources

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix data-loader path resolution and add Phase 4 i18n keys** - `d454cd5` (feat)
2. **Task 2: Implement CO2 topic module (ENV-01)** - `4b7753c` (feat)

## Files Created/Modified
- `js/utils/data-loader.js` - Added _basePath() helper; updated cache and static fallback fetch URLs to use dynamic prefix
- `js/i18n.js` - Added ~90 new keys across 5 topics (co2, temperature, earthquakes, population, conflicts) in both DE and EN
- `detail/topics/co2.js` - Complete CO2 topic module: hero with live ppm, Keeling Curve line chart, top 10 emitters bar chart, 2x2 tiles, greenhouse effect infographic, comparison block, sources with links

## Decisions Made
- Used `window.location.pathname.includes('/detail')` for path detection -- simple and robust for the project's URL structure
- All 5 topic i18n keys added in Task 1 (not just CO2) to enable Plans 02 and 03 to work in parallel without i18n dependencies
- CO2 Open-Meteo Air Quality API used as non-blocking live data source with graceful 3-tier fallback
- Greenhouse effect infographic built purely with DOMUtils.create (no innerHTML, no external images) for security and portability
- Top 10 emitters data hardcoded from World Bank 2020 dataset as specified in research -- avoiding API complexity for supplementary visualization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- data-loader.js path fix is in place -- Plans 02 and 03 topic modules will resolve data paths correctly
- All i18n keys for temperature, earthquakes, population, and conflicts are ready
- CO2 topic module proves the complete pattern: other modules can follow the same import/export/render/chart structure
- The topic module contract (meta, render, getChartConfigs, cleanup) is validated end-to-end

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 04-first-topics*
*Completed: 2026-03-21*
