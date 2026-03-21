---
phase: 07-economy-progress-weather
plan: 02
subsystem: ui
tags: [chart.js, choropleth, setInterval, arXiv, Nobel, real-time-counters]

requires:
  - phase: 07-economy-progress-weather/01
    provides: "Phase 7 i18n keys for science and internet topics"
  - phase: 05-environment-topics-2/01
    provides: "Reusable choropleth component (detail/utils/choropleth.js)"
  - phase: 04-data-integration/03
    provides: "population.js setInterval/cleanup pattern for real-time counters"
provides:
  - "Science topic module with growth curve, fields bar, Nobel bubble"
  - "Internet topic module with real-time counters and choropleth"
  - "Two working detail pages: detail/?topic=science and detail/?topic=internet"
affects: [07-economy-progress-weather/03, 09-integration, 10-polish]

tech-stack:
  added: []
  patterns:
    - "Hardcoded annual data with linear interpolation for growth curves"
    - "arXiv cache category extraction with fallback to hardcoded distribution"
    - "Bubble chart with sqrt-scaled radii and per-point palette colors"
    - "Calculated real-time counters (dailyRate / 86400 * elapsed) from population.js pattern"

key-files:
  created:
    - detail/topics/science.js
    - detail/topics/internet.js
  modified: []

key-decisions:
  - "arXiv cache papers lack primary_category field -- fields bar falls back to hardcoded distribution"
  - "Internet counters use population.js setInterval pattern with startOfDay epoch for today-counter display"
  - "Digital divide choropleth reuses detail/utils/choropleth.js with 4-tier color gradient"
  - "Growth curve rendered directly in render() for timerangechange; fields bar + Nobel lazy via getChartConfigs"

patterns-established:
  - "Calculated real-time counter: dailyRate / 86400 per second with MathUtils.formatCompact display"
  - "Bubble chart pattern: x=index, y=count, r=sqrt(count/max)*maxRadius with BUBBLE_PALETTE array"

requirements-completed: [PROG-01, PROG-02]

duration: 4min
completed: 2026-03-21
---

# Phase 7 Plan 02: Science & Internet Topics Summary

**Science topic with arXiv growth curve + Nobel bubble chart, Internet topic with real-time counters + digital divide choropleth**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T20:01:01Z
- **Completed:** 2026-03-21T20:05:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Science detail page with 4 visualizations: exponential growth curve (timerangechange), hot fields bar, Nobel bubble, context tiles
- Internet detail page with 3 real-time counters ticking every second (emails, Google, YouTube) plus digital divide SVG choropleth
- Both modules properly export meta, render, getChartConfigs, cleanup per topic contract
- Internet module cleanup clears all intervals and choropleth listeners on navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement science topic module** - `1839041` (feat)
2. **Task 2: Implement internet topic module** - `0b08b08` (feat)

## Files Created/Modified
- `detail/topics/science.js` - Science topic module: arXiv growth curve, research fields bar, Nobel prizes bubble chart
- `detail/topics/internet.js` - Internet topic module: real-time counters, digital divide choropleth, proper cleanup

## Decisions Made
- arXiv cache papers lack primary_category field, so fields bar chart falls back to hardcoded distribution (AI & ML 45%, Physics 20%, etc.)
- Internet counters use startOfDay epoch to display "today so far" values, matching population.js births/deaths pattern
- Growth curve rendered directly for timerangechange interactivity; fields bar + Nobel bubble lazy via getChartConfigs for scroll loading
- Digital divide uses 4-tier color gradient: red (<20%) to green (>80%) matching standard choropleth conventions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Progress category complete (PROG-01 science, PROG-02 internet)
- Plan 03 (weather, space, solar) can now proceed -- no dependencies on Plan 02 output
- Both modules proven and following established topic contract patterns

## Self-Check: PASSED

- FOUND: detail/topics/science.js
- FOUND: detail/topics/internet.js
- FOUND: 07-02-SUMMARY.md
- FOUND: commit 1839041
- FOUND: commit 0b08b08

---
*Phase: 07-economy-progress-weather*
*Completed: 2026-03-21*
