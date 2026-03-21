---
phase: 09-main-page-clickable-data-points
plan: 02
subsystem: ui
tags: [dynamic-elements, momentum, comparison-grid, i18n-tooltip, event-delegation]

# Dependency graph
requires:
  - phase: 09-main-page-clickable-data-points
    plan: 01
    provides: .detail-link CSS class, event delegation, _initDetailLinks() for static elements
provides:
  - MAIN_INDICATOR_TOPIC_MAP mapping 20 indicator names to detail topic IDs
  - Dynamic momentum-item wiring with .detail-link + data-topic at DOM creation time
  - Dynamic comparison-item wiring with .detail-link + data-topic at DOM creation time
  - Tooltip text refresh in _rebuildDynamic() for language toggle
affects: [10-new-acts-biodiversity-ocean]

# Tech tracking
tech-stack:
  added: []
  patterns: [indicator-topic-map for dynamic element wiring, tooltip refresh on language rebuild]

key-files:
  created: []
  modified: [js/app.js]

key-decisions:
  - "MAIN_INDICATOR_TOPIC_MAP with 20+ entries including umlaut variants (Waldflaeche/Waldflache) for robust matching"
  - "Tooltip refresh as safety net at end of _rebuildDynamic after momentum/realtime re-renders"

patterns-established:
  - "Dynamic element wiring: add .detail-link + data-topic at DOM creation time inside forEach loops"
  - "Tooltip refresh pattern: querySelectorAll('.detail-link[data-tooltip]') at end of _rebuildDynamic()"

requirements-completed: [MAIN-01, MAIN-02]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 9 Plan 02: Dynamic Clickable Data Points Summary

**MAIN_INDICATOR_TOPIC_MAP wiring 20 momentum indicators and comparison grid items to detail pages at DOM creation time, with tooltip refresh on language toggle**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T22:01:39Z
- **Completed:** 2026-03-21T22:05:50Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- MAIN_INDICATOR_TOPIC_MAP maps all 20 German indicator names (with umlaut variants) to their detail topic IDs
- Every dynamically-created momentum-item div gets .detail-link, data-topic, data-tooltip, role=link, and tabindex=0 when a mapping exists
- Every dynamically-created comparison-item div gets matching detail-link wiring via the same indicator map
- _rebuildDynamic() refreshes tooltip text on all .detail-link elements after language toggle, ensuring bilingual correctness
- Dynamic elements survive rebuild cycles since _rebuildDynamic resets _momentumBuilt and re-calls _updateMomentum with the new wiring code
- Full Phase 9 verified by user: all static and dynamic clickable data points navigate correctly, hover effects visible, tooltips bilingual, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire dynamic momentum/comparison elements and add tooltip refresh** - `8274473` (feat)
2. **Task 2: Verify complete Phase 9 -- all clickable data points working** - user-approved checkpoint (no code commit)

**Plan metadata:** `ef819d2` (docs: complete plan)

## Files Created/Modified
- `js/app.js` - Added MAIN_INDICATOR_TOPIC_MAP, wired momentum-item and comparison-item divs with .detail-link at creation time, added tooltip refresh in _rebuildDynamic()

## Decisions Made
- MAIN_INDICATOR_TOPIC_MAP includes both umlaut and non-umlaut variants (Waldflaeche/Waldflache) for robust matching regardless of data source encoding
- Tooltip refresh placed at end of _rebuildDynamic as safety net -- dynamic elements already get correct tooltip from creation code, but static elements from Plan 01 also need refresh

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 complete: all main page data points are clickable links to their detail pages
- Phase 10 can proceed with new Acts 12+13 knowing the .detail-link pattern and event delegation are proven
- Dynamic wiring pattern (add at DOM creation time) is available for any new dynamic elements in Phase 10

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 09-main-page-clickable-data-points*
*Completed: 2026-03-21*
