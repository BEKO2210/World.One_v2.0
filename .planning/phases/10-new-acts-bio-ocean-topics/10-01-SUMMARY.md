---
phase: 10-new-acts-bio-ocean-topics
plan: 01
subsystem: ui
tags: [html, i18n, scroll-engine, cinematic, nav-dots, detail-links, biodiversity, oceans]

# Dependency graph
requires:
  - phase: 09-main-page-clickable-data-points
    provides: STATIC_TOPIC_MAP pattern, detail-link class, event delegation click handler
provides:
  - Act 12 (Biodiversity) and Act 13 (Oceans) HTML sections on main page
  - All Phase 10 i18n keys for both acts and 5 detail topics (DE + EN)
  - Static fallback values for extinction, endangered, ocean_temp, ocean_ph, ocean_plastic
  - Scroll engine, nav dots, cinematic backgrounds, particle colors for new sections
  - STATIC_TOPIC_MAP entries wiring tiles to detail pages
affects: [10-02-PLAN, 10-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [section registration across 7 integration points]

key-files:
  created: []
  modified:
    - index.html
    - js/app.js
    - js/i18n.js
    - js/visualizations/cinematic.js
    - data/fallback/static-values.json

key-decisions:
  - "Biodiversity particle color reuses akt-action green (52,199,89) for nature continuity"
  - "Ocean particle color uses (0,122,255) matching Apple system blue for water association"
  - "Empty switch cases for both new acts -- no custom scroll logic needed, scroll-engine handles reveals"

patterns-established:
  - "Pattern: New acts follow 7-point registration checklist (colors, sectionIds, switch, navDots, topicMap, images, i18n)"

requirements-completed: [MAIN-03, MAIN-04, MAIN-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 10 Plan 01: New Acts & Integration Summary

**Acts 12 (Biodiversity) and 13 (Oceans) added as scroll sections with 7-point integration, 5 detail-link topic mappings, bilingual i18n for all 5 new topics, and populated static fallback values**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T22:35:40Z
- **Completed:** 2026-03-21T22:39:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Two new scroll-driven acts visible on main page in correct order (Act 11 -> Act 12 -> Act 13 -> Epilog)
- All 7 integration points updated: section colors, scroll engine IDs, progress handler switch, nav dots, STATIC_TOPIC_MAP, SECTION_IMAGES, i18n keys
- 5 STATIC_TOPIC_MAP entries wire Act 12/13 data tiles to detail pages (extinction, endangered, ocean_temp, ocean_ph, ocean_plastic)
- Bilingual i18n keys for both acts and all 5 detail topic pages in DE and EN
- Static fallback values populated for all 5 new topics (previously null)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Act 12 and Act 13 HTML sections, i18n keys, and static fallback values** - `f8a6fae` (feat)
2. **Task 2: Register new sections in app.js and cinematic.js, wire STATIC_TOPIC_MAP** - `0332458` (feat)

## Files Created/Modified
- `index.html` - Added Act 12 (akt-biodiversity) and Act 13 (akt-oceans) HTML sections with data cards
- `js/app.js` - Registered in _sectionColors, sectionIds, _onSectionProgress, _initNavDots, STATIC_TOPIC_MAP
- `js/i18n.js` - Added act12.*, act13.*, nav.biodiversity, nav.oceans, and detail.* keys for 5 topics (DE+EN)
- `js/visualizations/cinematic.js` - Added SECTION_IMAGES entries for both sections (Unsplash backgrounds)
- `data/fallback/static-values.json` - Replaced 5 null entries with real fallback data objects

## Decisions Made
- Biodiversity particle color reuses akt-action green (52,199,89) for nature continuity
- Ocean particle color uses (0,122,255) matching Apple system blue for water association
- Empty switch cases for both new acts -- no custom scroll logic needed, scroll-engine handles reveals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Act 12 and Act 13 sections are live on the main page with full scroll integration
- i18n keys and fallback values are ready for Plans 02 and 03 to build detail topic modules
- STATIC_TOPIC_MAP entries will navigate to detail/?topic=* pages once topic modules exist

## Self-Check: PASSED

All 5 modified files verified on disk. Both task commits (f8a6fae, 0332458) verified in git log.

---
*Phase: 10-new-acts-bio-ocean-topics*
*Completed: 2026-03-21*
