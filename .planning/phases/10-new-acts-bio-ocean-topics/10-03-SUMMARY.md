---
phase: 10-new-acts-bio-ocean-topics
plan: 03
subsystem: ui
tags: [biodiversity, extinction, endangered, iucn, detail-topics, chart-js, dom-visualization]

# Dependency graph
requires:
  - phase: 10-new-acts-bio-ocean-topics
    plan: 01
    provides: i18n keys for extinction/endangered topics, static fallback values, STATIC_TOPIC_MAP entries
provides:
  - Extinction rate topic module (BIO-01) with Big Five timeline and current rate context
  - Endangered species topic module (BIO-02) with IUCN category breakdown and species examples
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [hardcoded scientific reference data for topics without dedicated cache, shared biodiversity cache across 3 topics]

key-files:
  created:
    - detail/topics/extinction.js
    - detail/topics/endangered.js
  modified: []

key-decisions:
  - "Both modules fetch via fetchTopicData('biodiversity') not topic-specific caches (Pitfall 6)"
  - "Extinction rates and Big Five data hardcoded from IPBES 2019 and Barnosky et al. 2011 (no cache pipeline)"
  - "IUCN_CATEGORIES CR/EN/VU counts dynamically filled from biodiversity.json cache at render time"
  - "Species examples bilingual with i18n.lang selection at render time (5 per category)"

patterns-established:
  - "Pattern: Multiple detail topics sharing single cache file via fetchTopicData with same key"
  - "Pattern: Hardcoded scientific reference data arrays for historical/taxonomic context"

requirements-completed: [BIO-01, BIO-02]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 10 Plan 03: Biodiversity Detail Topics Summary

**Extinction rate module with Big Five mass extinctions timeline and 1000x rate comparison, plus endangered species module with IUCN 7-category doughnut and bilingual species examples from shared biodiversity cache**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T22:41:54Z
- **Completed:** 2026-03-21T22:45:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extinction topic (BIO-01) shows 1000x rate hero, Big Five horizontal bar chart with current Holocene comparison, log-scale background-vs-current rate visualization, 7 taxonomic group extinction cards, Sixth Mass Extinction explanation with drivers, and Then-vs-Now timeline
- Endangered topic (BIO-02) shows total threatened species hero from cache, IUCN 7-category doughnut chart with center total, proportional CR/EN/VU breakdown bars, bilingual species examples (5 per category), IUCN assessment explanation, and Assessed-vs-Unknown comparison
- Both modules correctly fetch via fetchTopicData('biodiversity') sharing the single biodiversity.json cache

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extinction.js topic module (BIO-01)** - `b6f88c5` (feat)
2. **Task 2: Create endangered.js topic module (BIO-02)** - `9d63560` (feat)

## Files Created/Modified
- `detail/topics/extinction.js` - Extinction rate topic module with Big Five mass extinctions, rate comparison, taxonomic group tiles, explanation, timeline, and sources (BIO-01)
- `detail/topics/endangered.js` - Endangered species topic module with IUCN doughnut chart, category bars, bilingual species examples, assessment explanation, and assessed-vs-unknown comparison (BIO-02)

## Decisions Made
- Both modules fetch via fetchTopicData('biodiversity') not topic-specific caches (Pitfall 6 from research)
- Extinction rates and Big Five data hardcoded from IPBES 2019 and Barnosky et al. 2011 (no cache pipeline exists)
- IUCN_CATEGORIES CR/EN/VU counts dynamically filled from biodiversity.json cache at render time with static fallbacks
- Species examples bilingual with i18n.lang selection at render time (5 per category: CR, EN, VU)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both biodiversity detail topics are fully functional and accessible via detail/?topic=extinction and detail/?topic=endangered
- Phase 10 Plan 02 (ocean topics) can proceed independently -- no cross-dependency with this plan
- All 5 new detail topics (2 biodiversity + 3 ocean) will complete Phase 10

## Self-Check: PASSED

All 2 created files verified on disk. Both task commits (b6f88c5, 9d63560) verified in git log.

---
*Phase: 10-new-acts-bio-ocean-topics*
*Completed: 2026-03-21*
