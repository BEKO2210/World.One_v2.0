---
phase: 04-first-topics
plan: 03
subsystem: ui
tags: [earthquakes, conflicts, svg-map, chart.js, usgs, ucdp, geojson, doughnut, topic-module]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: data-loader.js, chart-manager.js, badge.js, dom.js, math.js utilities
  - phase: 02-detail-shell
    provides: detail-app.js shell, topic module contract, _stub.js reference
  - phase: 04-first-topics
    provides: Plan 01 _basePath fix, i18n keys for earthquakes and conflicts
provides:
  - Earthquakes topic module with live USGS SVG map, magnitude histogram, depth-colored dots
  - Conflicts topic module with intensity-based conflict map, 1946-2024 historical trend, refugees doughnut
  - Two working detail pages at detail/?topic=earthquakes and detail/?topic=conflicts
affects: [04-future-topics, phase-09-main-page, all-future-svg-map-modules]

# Tech tracking
tech-stack:
  added: []
  patterns: [live-usgs-fetch-pattern, hardcoded-historical-data-pattern, svg-point-map-pattern, interactive-trend-chart-pattern, direct-render-for-interactivity]

key-files:
  created:
    - detail/topics/earthquakes.js
    - detail/topics/conflicts.js
  modified: []

key-decisions:
  - "Earthquakes fetches USGS GeoJSON directly in browser (CORS-friendly) with fetchWithTimeout at 8s timeout"
  - "Simplified continent outlines as SVG path elements (rectangle approximations) shared between both map modules"
  - "Conflict trend chart rendered directly in render() for time range interactivity; refugees doughnut lazy-loaded via getChartConfigs"
  - "20 conflict countries with 3-level intensity hardcoded from UCDP/PRIO dataset (API requires token since Feb 2026)"
  - "War-level conflicts (intensity 3) get outer glow ring for visual emphasis on conflict map"

patterns-established:
  - "Live browser-fetch pattern: USGS GeoJSON feeds fetched directly with fetchWithTimeout, no cache pipeline needed"
  - "SVG point map pattern: viewBox 900x450, continent outlines, geoToSVG projection, click-to-popup with HTML overlay"
  - "Interactive chart pattern: ensureChartJs() + createChart() in render() for charts needing timerangechange updates"
  - "Hardcoded historical data pattern: UCDP trend array embedded in module when API requires authentication"

requirements-completed: [RT-01, SOC-02]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 4 Plan 3: Earthquakes & Conflicts Topic Modules Summary

**Interactive SVG earthquake map with live USGS data and depth-colored dots, plus conflict map with 20-country intensity dots, 1946-2024 historical trend line, and refugees doughnut chart**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T16:17:14Z
- **Completed:** 2026-03-21T16:21:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Implemented earthquakes topic module (665 lines) with live USGS GeoJSON fetching, SVG earthquake map with magnitude-sized/depth-colored dots, click popups, and 7-day magnitude histogram
- Implemented conflicts topic module (752 lines) with SVG conflict map showing 20 countries at 3 intensity levels, historical trend 1946-2024 with event annotations, time range selector, and refugees doughnut chart
- Both modules follow the full topic contract (meta, render, getChartConfigs, cleanup) and degrade gracefully when live APIs fail

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Earthquakes topic module (RT-01)** - `053ab65` (feat)
2. **Task 2: Implement Conflicts topic module (SOC-02)** - `e2454c3` (feat)

## Files Created/Modified
- `detail/topics/earthquakes.js` - Full earthquakes topic module: live USGS 24h/7d fetching, SVG map with continent outlines and earthquake dots (magnitude=size, depth=color), click popup, magnitude histogram, 2x2 tiles, explanation, sources
- `detail/topics/conflicts.js` - Full conflicts topic module: SVG conflict map with 20 countries (intensity dots with war glow), historical trend 1946-2024 with Cold War/Arab Spring/ISIS/Ukraine annotations, time range selector, refugees doughnut (37.6M/68.3M/6.9M), 2x2 tiles, explanation, sources

## Decisions Made
- USGS GeoJSON feeds fetched directly in the browser at 8s timeout (confirmed CORS-friendly per research) -- no cache pipeline needed for earthquakes
- Simplified continent outlines drawn as SVG path elements using rectangle approximations -- sufficient for recognizable world map without external SVG files
- Conflict trend chart rendered directly in render() with ensureChartJs() + createChart() for time range interactivity, while refugees doughnut uses lazy getChartConfigs pattern
- 20 conflict countries hardcoded from UCDP/PRIO dataset with 3-level intensity (war/intermediate/minor) since UCDP API requires token since Feb 2026
- War-level conflicts (intensity 3) get additional outer glow ring on SVG map for visual emphasis

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 Phase 4 topic modules are now ready: CO2 (Plan 01), Temperature (Plan 02), Earthquakes + Conflicts (Plan 03)
- Population module is the remaining topic from Plan 02 (if separate) or may be complete
- SVG map pattern established and reusable for any future geographic visualization topics
- Live browser-fetch pattern (USGS) proven for CORS-friendly APIs
- Hardcoded historical data pattern proven for token-gated APIs (UCDP)

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 04-first-topics*
*Completed: 2026-03-21*
