---
phase: 09-main-page-clickable-data-points
plan: 01
subsystem: ui
tags: [css-hover, i18n, event-delegation, accessibility, detail-links]

# Dependency graph
requires:
  - phase: 08-remaining-topics
    provides: detail page infrastructure and topic modules
provides:
  - .detail-link CSS class with brightness glow, tooltip, reduced-motion fallback
  - main.clickForDetails i18n key (DE/EN)
  - _initDetailLinks() method with STATIC_TOPIC_MAP for 36 static elements
  - SECTION_SCROLL_MAP for 4 category sub-score scroll links
  - Event delegation for click and keyboard navigation
affects: [09-02-dynamic-detail-links]

# Tech tracking
tech-stack:
  added: []
  patterns: [detail-link class pattern, wrapClosest parent targeting, event delegation for navigation]

key-files:
  created: []
  modified: [css/sections.css, js/i18n.js, js/app.js]

key-decisions:
  - "dataset.* API for data attributes (standard JS API maps to data-* in DOM)"
  - "wrapClosest pattern to target parent containers instead of canvas elements"
  - "Single event delegation on document for all detail-link clicks and keyboard events"

patterns-established:
  - "detail-link pattern: add .detail-link class + data-topic attr to make any element clickable to its detail page"
  - "SECTION_SCROLL_MAP pattern: data-scrollTo for elements that scroll to sections instead of navigating"

requirements-completed: [MAIN-01, MAIN-02]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 9 Plan 01: Static Clickable Data Points Summary

**CSS .detail-link hover effects with brightness glow and tooltip, plus _initDetailLinks() wiring 36 static elements across Acts 1-7 to their detail pages via event delegation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T21:57:12Z
- **Completed:** 2026-03-21T22:00:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- .detail-link CSS class with +10% brightness, blue glow box-shadow, cursor:pointer, ::after tooltip, focus-visible outline, and prefers-reduced-motion fallback
- main.clickForDetails i18n key in both DE ("Klicken fur Details ->") and EN ("Click for details ->")
- _initDetailLinks() method with STATIC_TOPIC_MAP (36 entries) covering Acts 1-7 data-cards, widgets, sub-scores, and chart containers
- SECTION_SCROLL_MAP for 4 category sub-scores (environment/society/economy/progress) that scroll to their act sections
- Event delegation for click navigation to detail/?topic={id} and keyboard Enter/Space accessibility
- Elements without matching topics (GDP, inflation, unemployment, trade, regional GDP, infrastructure, literacy, GitHub, sentiment, volcanic, news) correctly excluded

## Task Commits

Each task was committed atomically:

1. **Task 1: Add .detail-link CSS hover styles and i18n tooltip key** - `4a09516` (feat)
2. **Task 2: Add _initDetailLinks() for static elements and integrate into init()** - `c7a3cc1` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `css/sections.css` - Added .detail-link hover states section (brightness, glow, tooltip, reduced-motion)
- `js/i18n.js` - Added main.clickForDetails key to both DE and EN translation objects
- `js/app.js` - Added _initDetailLinks() method with STATIC_TOPIC_MAP, SECTION_SCROLL_MAP, event delegation

## Decisions Made
- Used JavaScript `dataset.*` API (maps to `data-*` attributes in DOM) rather than `setAttribute('data-*')` for cleaner code
- wrapClosest pattern ensures chart canvas elements are never directly targeted -- the parent container gets the click handler
- Single event delegation listener on document rather than per-element handlers for performance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Static detail links foundation complete for Plan 02 (dynamic elements: momentum items, comparison grid)
- .detail-link CSS class and event delegation ready for reuse by Plan 02
- All static elements in Acts 1-7 are wired with hover effects and navigation

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 09-main-page-clickable-data-points*
*Completed: 2026-03-21*
