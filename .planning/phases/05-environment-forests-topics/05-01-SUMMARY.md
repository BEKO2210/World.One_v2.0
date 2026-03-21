---
phase: 05-environment-forests-topics
plan: 01
subsystem: ui
tags: [choropleth, svg, biodiversity, i18n, static-fallback, living-planet-index, iucn, nature-score, reusable-component]

# Dependency graph
requires:
  - phase: 04-01
    provides: Topic module contract pattern, data-loader _basePath, i18n key convention, chart-manager utilities
  - phase: 04-02
    provides: SVG choropleth pattern from temperature.js, CLASS_TO_ISO mapping, TOOLTIP_STYLE
provides:
  - Reusable SVG choropleth component (INFRA-06) eliminating ~100 lines duplication per map topic
  - Biodiversity topic module (ENV-03) with LPI trend, IUCN browser, and threat choropleth
  - Phase 5 i18n keys for all 4 topics (biodiversity, airquality, forests, renewables) in DE and EN
  - Static fallback values for all 4 Phase 5 topics
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [reusable-choropleth-component, parameterized-svg-map, choropleth-event-cleanup]

key-files:
  created:
    - detail/utils/choropleth.js
    - detail/topics/biodiversity.js
  modified:
    - js/i18n.js
    - data/fallback/static-values.json

key-decisions:
  - "Extracted SVG choropleth into detail/utils/choropleth.js with parameterized dataMap, colorFn, tooltipFn, legendItems -- accepts any ISO-2 data map"
  - "CLASS_TO_ISO mapping in choropleth.js merges temperature.js (110 entries) and maps.js (35 entries) for maximum country coverage"
  - "Choropleth returns { wrapper, cleanup } where cleanup removes all tracked event listeners for proper disposal"
  - "Phase 5 i18n keys added upfront for all 4 topics (matching Phase 4 pattern) to unblock parallel plan execution"
  - "LPI chart rendered directly in render() for timerangechange interactivity; getChartConfigs returns empty array"
  - "NATURE_SCORE data copied inline from maps.js to avoid cross-importing main page module into detail pages"

patterns-established:
  - "Reusable choropleth: import renderChoropleth from detail/utils/choropleth.js, pass dataMap + colorFn + tooltipFn + legendItems"
  - "Choropleth cleanup pattern: store cleanup function from renderChoropleth result, call in module cleanup()"
  - "CR species examples: hardcoded bilingual strings selected by i18n.lang at render time"

requirements-completed: [INFRA-06, ENV-03]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 5 Plan 1: Choropleth Component, Phase 5 i18n/Fallbacks, and Biodiversity Topic Summary

**Reusable SVG choropleth component (INFRA-06) with parameterized data/color/tooltip, biodiversity module with Living Planet Index trend chart (73% decline), IUCN category browser, and threat choropleth map; all Phase 5 i18n keys and static fallback values pre-populated**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T18:12:06Z
- **Completed:** 2026-03-21T18:17:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Reusable SVG choropleth component (detail/utils/choropleth.js) extracts and parameterizes the temperature.js map pattern, eliminating ~100 lines per future choropleth
- Biodiversity topic module (detail/topics/biodiversity.js, 549 lines) with all 7 blocks: hero, LPI trend, IUCN browser, tiles, explanation, choropleth, sources
- 60+ i18n keys added for all 4 Phase 5 topics (biodiversity, airquality, forests, renewables) in both DE and EN
- Static fallback values populated for all 4 Phase 5 topics, preventing null hero displays

## Task Commits

Each task was committed atomically:

1. **Task 1: Create reusable choropleth component, add Phase 5 i18n keys, and populate static fallback values** - `8ced3be` (feat)
2. **Task 2: Implement biodiversity topic module (ENV-03)** - `a32c001` (feat)

## Files Created/Modified
- `detail/utils/choropleth.js` - Reusable SVG choropleth: renderChoropleth(container, {dataMap, colorFn, tooltipFn, legendItems, title})
- `detail/topics/biodiversity.js` - Biodiversity topic: hero (species count), LPI trend chart, IUCN category browser, tiles, choropleth map, sources
- `js/i18n.js` - Added 60+ Phase 5 detail.{topic}.* keys for biodiversity, airquality, forests, renewables in DE and EN
- `data/fallback/static-values.json` - Replaced null entries with proper fallback objects for 4 Phase 5 topics

## Decisions Made
- Extracted SVG choropleth from temperature.js into a parameterized reusable component rather than duplicating the pattern in each topic module
- Merged CLASS_TO_ISO mappings from both temperature.js and maps.js into the choropleth component for maximum country coverage
- Choropleth returns cleanup function that removes all tracked event listeners (mouseenter/mousemove/mouseleave) for proper disposal
- NATURE_SCORE data copied inline from maps.js to avoid importing the main page maps module into detail pages (anti-pattern noted in research)
- LPI chart rendered directly in render() (not via getChartConfigs) to support timerangechange event handling
- CR species examples stored as bilingual object, selected by i18n.lang at render time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Reusable choropleth component is ready for air quality and renewables topics (Plans 02/03)
- All Phase 5 i18n keys are pre-populated, unblocking parallel plan execution
- Static fallback values ensure hero blocks display properly even without cache data
- Biodiversity topic fully functional at detail/?topic=biodiversity

## Self-Check: PASSED

All 4 files verified present on disk. Both commit hashes (8ced3be, a32c001) verified in git log.

---
*Phase: 05-environment-forests-topics*
*Completed: 2026-03-21*
