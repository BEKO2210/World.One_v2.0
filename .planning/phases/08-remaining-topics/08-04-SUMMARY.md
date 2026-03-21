---
phase: 08-remaining-topics
plan: 04
subsystem: ui
tags: [dom, momentum, mini-cards, navigation, change-display]

# Dependency graph
requires:
  - phase: 08-02
    provides: momentum_detail.js topic module with 24 mini-card grid
provides:
  - "% change display per momentum mini-card (14 of 24 matched from momentum.indicators)"
  - "Click-to-topic navigation for all 24 mapped indicators"
  - "INDICATOR_TOPIC_MAP constant for indicator-to-topic-ID resolution"
affects: [momentum_detail, MOM-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Alias-based name matching between data arrays with different naming conventions"
    - "Conditional card interactivity (clickable vs static) based on topic mapping"

key-files:
  created: []
  modified:
    - detail/topics/momentum_detail.js

key-decisions:
  - "Alias lookup table for matching subScores names to momentum.indicators names (names differ significantly between arrays)"
  - "24 indicators mapped to topic IDs in INDICATOR_TOPIC_MAP; unmapped indicators remain non-clickable"
  - "14 of 24 indicators receive % change; 10 without momentum counterpart gracefully omit display"

patterns-established:
  - "Pattern: Dual-strategy name matching (exact + alias map) for cross-referencing data arrays with inconsistent naming"

requirements-completed: [MOM-01]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 8 Plan 4: Momentum MOM-01 Gap Closure Summary

**Momentum mini-cards enhanced with % change values from momentum.indicators and click-to-topic navigation via INDICATOR_TOPIC_MAP**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T21:27:47Z
- **Completed:** 2026-03-21T21:30:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added % change display to 14 of 24 momentum mini-cards by cross-referencing top-level momentum.indicators array
- Added INDICATOR_TOPIC_MAP constant mapping all 24 subScores indicators to their corresponding topic detail page IDs
- Made mapped cards clickable with pointer cursor, hover highlight effect, and north-east arrow link icon
- Cards without momentum counterpart (10 of 24) gracefully omit % change; all cards retain existing layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Add % change display and click-to-topic navigation to momentum mini-cards** - `7855c51` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `detail/topics/momentum_detail.js` - Added INDICATOR_TOPIC_MAP (24 entries), MOMENTUM_ALIAS for name cross-referencing, % change element in Row 2, click handler with hover effect on clickable cards

## Decisions Made
- Used explicit alias lookup table (MOMENTUM_ALIAS) rather than fuzzy string matching, because subScores and momentum.indicators use significantly different names (e.g., "Trinkwasserzugang" vs "Trinkwasser", "Internet-Durchdringung" vs "Internet-Zugang")
- Mapped all 24 indicators including "Arktis-Eisfläche" to biodiversity and "Menschen auf der Flucht" to conflicts, providing maximum topic-page coverage
- % change color logic follows plan spec: negative values red for declining indicators, green for improving (inverted semantics)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed name matching strategy for % change cross-reference**
- **Found during:** Task 1
- **Issue:** Plan suggested normalized-key matching (lowercase, strip non-alpha), but names differ too much between arrays (e.g., "F&E Ausgaben (% BIP)" vs "F&E Ausgaben", "Mobilfunkvertrge" vs "Mobilfunk"). Only 10 of 24 matched with normalization.
- **Fix:** Replaced fuzzy normalization with explicit MOMENTUM_ALIAS lookup table mapping subScores names to their momentum.indicators counterparts. Combined with exact-match first strategy.
- **Files modified:** detail/topics/momentum_detail.js
- **Verification:** Node script confirmed 14 of 24 now match (remaining 10 have no momentum counterpart at all).
- **Committed in:** 7855c51

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix -- without the alias approach, 4 matchable indicators would have been missed. No scope creep.

## Issues Encountered
None beyond the name-matching deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MOM-01 requirement fully closed: all mini-cards show value, trend arrow, % change (where available), sparkline, assessment, and are clickable to topic detail pages
- Phase 8 is now complete with all verification gaps addressed
- Ready for Phase 9 (main page integration) or Phase 10 (polish)

---
*Phase: 08-remaining-topics*
*Completed: 2026-03-21*
