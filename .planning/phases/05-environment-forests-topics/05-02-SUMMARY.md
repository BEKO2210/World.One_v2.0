---
phase: 05-environment-forests-topics
plan: 02
subsystem: ui
tags: [airquality, forests, scatter-chart, horizontal-bar, stacked-bar, open-meteo, who, fao, aqi, deforestation]

# Dependency graph
requires:
  - phase: 05-01
    provides: Phase 5 i18n keys for airquality/forests, static fallback values, chart-manager utilities, topic module contract
provides:
  - Air quality topic module (ENV-04) with live AQI, city rankings bar, AQI-vs-GDP scatter, pollutant explainer cards
  - Forests topic module (ENV-05) with cover % hero, annual loss bar, deforestation causes stacked bar, top-5 ranking
affects: [05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [scatter-chart-with-logarithmic-axis, pollutant-explainer-cards, proportional-bar-ranking, lazy-stacked-bar-via-getChartConfigs]

key-files:
  created:
    - detail/topics/airquality.js
    - detail/topics/forests.js
  modified: []

key-decisions:
  - "Air quality uses fetchWithTimeout for live Open-Meteo AQI with 3-tier fallback (live -> cache -> static 42)"
  - "City AQI rankings rendered as horizontal bar chart directly in render() (not lazy) for sorting interactivity"
  - "AQI-vs-GDP scatter uses logarithmic x-axis for GDP to spread low/high income countries evenly"
  - "AQI color thresholds: green <= 50, yellow 51-100, orange 101-150, red > 150 -- used in hero dot and scatter points"
  - "Pollutant explainer cards use glass-morphism cards with left color border, matching IUCN browser pattern from biodiversity"
  - "Forest loss chart displays absolute values (positive bars) with tooltip showing negative net loss for clarity"
  - "Deforestation causes stacked bar rendered via getChartConfigs() for lazy loading (supplementary chart)"
  - "Top-5 forest countries use proportional DOM bars (not Chart.js) to avoid chart overhead for simple ranking"

patterns-established:
  - "Scatter chart pattern: type scatter + logarithmic x-axis + per-point AQI color mapping"
  - "Explainer card pattern: flexbox column cards with color border, name/threshold header, health effects, sources"
  - "DOM-based ranking bars: proportional width bars using DOMUtils.create for simple country rankings"
  - "Lazy stacked bar: getChartConfigs returns stacked bar config for detail-app.js IntersectionObserver"

requirements-completed: [ENV-04, ENV-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 5 Plan 2: Air Quality and Forests Topic Modules Summary

**Air quality module with live Open-Meteo AQI, city rankings bar chart, AQI-vs-GDP scatter plot (25 countries), and WHO pollutant explainer cards; forests module with annual loss bar (2001-2022), deforestation causes stacked bar (5 categories), and top-5 country proportional ranking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T18:20:43Z
- **Completed:** 2026-03-21T18:24:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Air quality topic module (detail/topics/airquality.js, 621 lines) with live AQI fetch, 2 Chart.js charts (horizontal bar + scatter), pollutant explainer cards, and WHO guideline tiles
- Forests topic module (detail/topics/forests.js, 528 lines) with annual loss bar chart, lazy-loaded deforestation causes stacked bar, proportional top-5 country ranking, and context tiles
- First scatter chart type in the detail page system (AQI vs GDP with logarithmic x-axis and per-point color coding)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement air quality topic module (ENV-04)** - `8b7ce3a` (feat)
2. **Task 2: Implement forests topic module (ENV-05)** - `a3566d2` (feat)

## Files Created/Modified
- `detail/topics/airquality.js` - Air quality topic: hero with live AQI + colored dot, city rankings horizontal bar (20 cities), AQI-vs-GDP scatter (25 countries), WHO tiles, pollutant explainer cards, sources
- `detail/topics/forests.js` - Forests topic: hero with forest cover %, annual loss bar chart (2001-2022), deforestation causes stacked bar (lazy), tiles, top-5 country ranking, sources

## Decisions Made
- Air quality fetches live European AQI from Open-Meteo (Berlin coordinates) with 5s timeout, falling back to cache then static value 42
- City AQI and AQI-vs-GDP charts rendered directly in render() for interactivity (getChartConfigs returns empty array)
- AQI color mapping shared between hero dot indicator and scatter plot point colors for visual consistency
- Pollutant explainer cards follow the same card pattern as biodiversity IUCN browser (color border, structured content)
- Forest loss chart uses absolute values for bar heights with tooltip clarifying negative net loss
- Deforestation causes stacked bar is the only chart returned via getChartConfigs() for lazy IntersectionObserver loading
- Top-5 country forest ranking uses DOM-based proportional bars instead of Chart.js to keep it lightweight

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 3 of 4 Phase 5 topics complete (biodiversity, air quality, forests)
- Only renewables topic (Plan 03) remains to complete Phase 5
- Scatter chart pattern established and can be reused in future topics
- All Phase 5 i18n keys and static fallbacks were pre-populated in Plan 01

## Self-Check: PASSED

All 2 files verified present on disk. Both commit hashes (8b7ce3a, a3566d2) verified in git log.

---
*Phase: 05-environment-forests-topics*
*Completed: 2026-03-21*
