---
phase: 01-data-layer-utilities
plan: 02
subsystem: ui
tags: [badge, dom, i18n, css, data-tier]

# Dependency graph
requires:
  - phase: 01-data-layer-utilities (plan 01)
    provides: DOMUtils.create() factory from js/utils/dom.js
provides:
  - createTierBadge(tier, options) DOM element factory for live/cache/stale/static badges
  - Data-badge CSS component with 4 visual variants
  - Badge i18n keys (badge.live, badge.cache, badge.static, badge.staleWarning) in DE/EN
affects: [detail-page-shell, first-topics, all-topic-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-tier badge pattern, CSS BEM component with variant modifiers]

key-files:
  created: [js/utils/badge.js]
  modified: [css/components.css, js/i18n.js]

key-decisions:
  - "Badge uses inline-flex pill design matching existing live-badge and zone-badge patterns"
  - "Stale cache threshold set at 86400000ms (24h) with orange visual warning and title tooltip"
  - "Static badge appends reference year as text suffix rather than separate element"

patterns-established:
  - "data-badge BEM component: .data-badge base + --live/--cache/--stale/--static variant modifiers"
  - "Badge factory pattern: single function returns configured DOM element using DOMUtils.create()"

requirements-completed: [INFRA-02]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 1 Plan 02: Badge Renderer Summary

**Data tier badge factory with 4 CSS variants (live/cache/stale/static), pulsing dot animation, and DE/EN i18n labels**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T12:50:07Z
- **Completed:** 2026-03-21T12:52:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Badge factory creates correct DOM element for each tier with DOMUtils.create() and i18n.t()
- CSS styles follow existing badge pattern (.live-badge, .zone-badge) with BEM naming
- Pulsing dot animation reuses existing livePulse keyframe from animations.css
- Stale cache badges (>24h) get orange styling and title tooltip warning

## Task Commits

Each task was committed atomically:

1. **Task 1: Create badge renderer and add CSS styles** - `398951c` (feat)
2. **Task 2: Add badge i18n keys to translation system** - `28734ce` (feat)

## Files Created/Modified
- `js/utils/badge.js` - Data tier badge DOM element factory exporting createTierBadge()
- `css/components.css` - Added .data-badge base + 4 variant classes + .data-badge__dot
- `js/i18n.js` - Added badge.live, badge.cache, badge.static, badge.staleWarning to DE and EN

## Decisions Made
- Badge uses inline-flex pill design (2px 8px padding, 20px border-radius) matching existing badge aesthetics
- Stale cache threshold is 86400000ms (24h) -- produces orange badge with title tooltip via i18n.t('badge.staleWarning')
- Static badge appends reference year as text suffix (e.g., "Statisch 2023") rather than a separate DOM element
- data-badge--static shares visual styling with --cache (gray) as specified in plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Badge renderer is ready for use by detail page topics (Phase 4+)
- createTierBadge() accepts the { data, tier, age } shape from the data-loader (Plan 01-01)
- CSS loaded via existing components.css link in index.html

## Self-Check: PASSED

- All 3 created/modified files verified on disk
- Commit 398951c (Task 1) verified in git log
- Commit 28734ce (Task 2) verified in git log

---
*Phase: 01-data-layer-utilities*
*Completed: 2026-03-21*
