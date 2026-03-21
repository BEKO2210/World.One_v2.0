---
phase: 01-data-layer-utilities
plan: 01
subsystem: infra
tags: [fetch, fallback, data-loader, timeout, json-schema, validation]

# Dependency graph
requires: []
provides:
  - "3-tier data fallback fetcher (fetchTopicData, fetchWithTimeout)"
  - "Static fallback values for all 28 topics (5 populated, 23 placeholders)"
  - "Schema validation script for static-values.json"
affects: [02-detail-shell, 04-prove-five-topics, badge-renderer]

# Tech tracking
tech-stack:
  added: [AbortSignal.timeout]
  patterns: [3-tier-fallback, module-level-cache, tier-metadata-response]

key-files:
  created:
    - js/utils/data-loader.js
    - data/fallback/static-values.json
    - scripts/validate-fallback.js

key-decisions:
  - "Standalone data-loader module separate from existing js/data-loader.js"
  - "Module-level cache for static-values.json (fetched once, reused)"
  - "ESM imports in validation script to match project type:module convention"

patterns-established:
  - "3-tier fallback pattern: live API -> cached JSON -> static values with { data, tier, age } response shape"
  - "Console logging with [DataLoader] prefix for all data fetch operations"
  - "Private helpers prefixed with underscore (_getCacheAge, _getStaticFallback)"

requirements-completed: [INFRA-01, INFRA-03]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 1 Plan 1: Data Loader & Static Fallback Summary

**3-tier data fallback fetcher with AbortSignal.timeout and static fallback JSON covering all 28 topics**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T12:49:48Z
- **Completed:** 2026-03-21T12:52:23Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Built fetchWithTimeout using AbortSignal.timeout(5000) for clean timeout handling
- Built fetchTopicData with 3-tier fallback (live -> cache -> static) returning { data, tier, age } metadata
- Created static-values.json with all 28 topic keys, 5 fully populated with real data (co2, temperature, earthquakes, population, conflicts)
- Created schema validation script that verifies all topic keys, _meta structure, and data point schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data-loader utility with 3-tier fallback** - `c8837e3` (feat)
2. **Task 2: Create static fallback values file and validation script** - `c128a73` (feat)

## Files Created/Modified
- `js/utils/data-loader.js` - 3-tier data fallback fetcher with fetchTopicData and fetchWithTimeout exports
- `data/fallback/static-values.json` - Static fallback values for all 28 topics (5 populated, 23 null placeholders)
- `scripts/validate-fallback.js` - Node.js schema validation script for static-values.json

## Decisions Made
- Standalone data-loader module: Created as new js/utils/data-loader.js, completely separate from the existing js/data-loader.js which handles main page world-state.json
- Module-level cache: static-values.json is fetched once and cached in a module-level variable (_staticCache) to avoid repeated network requests
- ESM convention: Validation script uses ESM imports (import from 'fs') to match the project's package.json type:module setting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ESM module incompatibility in validation script**
- **Found during:** Task 2 (validation script creation)
- **Issue:** Initial validation script used CommonJS require() but project has "type": "module" in package.json
- **Fix:** Converted to ESM imports (import { readFileSync } from 'fs') matching existing scripts/ convention
- **Files modified:** scripts/validate-fallback.js
- **Verification:** node scripts/validate-fallback.js exits 0 successfully
- **Committed in:** c128a73 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for script execution. No scope creep.

## Issues Encountered
None beyond the ESM fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- fetchTopicData and fetchWithTimeout are ready for use by future detail pages
- Static fallback file is in place with complete schema; future topic phases only need to fill in their null entries
- Validation script can be run anytime to verify fallback file integrity
- Badge renderer (Plan 01-02) can use the { data, tier, age } response shape to render appropriate tier badges

## Self-Check: PASSED

All 3 created files verified on disk. Both task commits (c8837e3, c128a73) verified in git log.

---
*Phase: 01-data-layer-utilities*
*Completed: 2026-03-21*
