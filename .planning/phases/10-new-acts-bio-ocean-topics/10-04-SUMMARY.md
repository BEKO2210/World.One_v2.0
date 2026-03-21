---
phase: 10-new-acts-bio-ocean-topics
plan: 04
subsystem: ui
tags: [intersection-observer, scroll-engine, cinematic-backgrounds, parallax, unsplash]

# Dependency graph
requires:
  - phase: 10-new-acts-bio-ocean-topics
    provides: "Act 12 (Biodiversity) and Act 13 (Oceans) HTML sections and scroll registration"
provides:
  - "Working cinematic parallax backgrounds on all 15 sections"
  - "Curated editorial-quality Unsplash images for biodiversity and oceans acts"
  - "Resilient scroll-engine init() that supports both register-before-init and register-after-init patterns"
affects: [scroll-engine, cinematic-backgrounds]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retroactive observer pattern: init() loops over pre-registered sections to observe them"

key-files:
  created: []
  modified:
    - js/scroll-engine.js
    - js/visualizations/cinematic.js

key-decisions:
  - "Fixed in scroll-engine.js init() (not app.js call order) to make engine resilient to either call order"
  - "Replaced tiger portrait with sunlight-through-canopy forest for biodiversity (dramatic depth, grayscale-friendly)"
  - "Replaced flat ocean surface with underwater light rays for oceans (volumetric light, editorial quality)"

patterns-established:
  - "Retroactive observer: init() observes all sections already in this.sections Map after creating observer"

requirements-completed: [MAIN-03, MAIN-04]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 10 Plan 04: Cinematic Background Observer Fix Summary

**Fixed register-before-init IntersectionObserver bug affecting all 15 section backgrounds, curated editorial images for biodiversity and oceans acts**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T23:20:06Z
- **Completed:** 2026-03-21T23:22:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed root cause bug: IntersectionObserver never observed any section because register() was called before init() created the observer
- Added retroactive observation loop in init() so all pre-registered sections get observed after _setupObservers()
- Replaced biodiversity image (tiger portrait, too zoomed-in) with dramatic sunlight-through-forest-canopy
- Replaced oceans image (flat surface, too bland under filter) with underwater volumetric light rays

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix register-before-init observer bug in scroll-engine.js** - `42f3eb6` (fix)
2. **Task 2: Curate high-quality cinematic images for biodiversity and oceans** - `78eb821` (feat)

## Files Created/Modified
- `js/scroll-engine.js` - Added retroactive observer loop in init() after _setupObservers() to observe all pre-registered sections
- `js/visualizations/cinematic.js` - Updated SECTION_IMAGES URLs for akt-biodiversity and akt-oceans with editorial-quality cinematic photos

## Decisions Made
- Fixed in scroll-engine.js init() rather than reordering calls in app.js -- the engine's API should support both call orders (register-before-init is a valid pattern: collect sections, then start engine)
- Biodiversity: sunlight-through-canopy (photo-1441974231531) -- dramatic rays and depth that render beautifully under grayscale+brightness(0.3) filter
- Oceans: underwater light rays (photo-1518020382113) -- volumetric underwater light with editorial quality matching existing cinematic style

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 15 sections now have working cinematic parallax backgrounds
- UAT Test 4 (cinematic backgrounds on Acts 12-13) should pass
- No regressions expected -- existing register-after-init behavior preserved by the existing `if (this._observer)` guard in register()

## Self-Check: PASSED

- FOUND: js/scroll-engine.js
- FOUND: js/visualizations/cinematic.js
- FOUND: 10-04-SUMMARY.md
- FOUND: commit 42f3eb6 (Task 1)
- FOUND: commit 78eb821 (Task 2)

---
*Phase: 10-new-acts-bio-ocean-topics*
*Completed: 2026-03-22*
