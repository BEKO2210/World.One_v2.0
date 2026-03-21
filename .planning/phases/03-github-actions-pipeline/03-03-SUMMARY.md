---
phase: 03-github-actions-pipeline
plan: 03
subsystem: infra
tags: [github-actions, cron, workflow, service-worker, cache-pipeline, meta-json]

# Dependency graph
requires:
  - phase: 03-github-actions-pipeline
    plan: 01
    provides: "cache-biodiversity.js, cache-environment-ext.js, cache-society-ext.js"
  - phase: 03-github-actions-pipeline
    plan: 02
    provides: "cache-economy-ext.js, cache-progress-ext.js, cache-disasters.js, validate-cache.js"
provides:
  - "cache-pipeline.yml workflow with 6 staggered cron jobs (03:00-05:30 UTC)"
  - "generate-meta.js producing data/cache/meta.json with pipeline health stats"
  - "Service worker v2 with detail page assets and data/cache routing"
affects: [04-co2, 04-population, 04-biodiversity, 04-economy, 04-progress, 04-disasters]

# Tech tracking
tech-stack:
  added: []
  patterns: [staggered cron with github.event.schedule conditionals, incremental meta.json aggregation, versioned SW cache name]

key-files:
  created:
    - .github/workflows/cache-pipeline.yml
    - scripts/generate-meta.js
  modified:
    - service-worker.js

key-decisions:
  - "Single workflow file with 6 cron triggers and github.event.schedule conditionals (not 6 separate workflow files)"
  - "UCDP_API_TOKEN env var only on society-ext job (only job needing it)"
  - "data/cache/ routing reuses existing /data/ entry in DATA_PATHS via includes() match"
  - "Detail page assets added to PRECACHE_ASSETS alongside cache name bump"

patterns-established:
  - "Staggered cron pattern: 30-min gaps, conditional execution via github.event.schedule, shared env/permissions block"
  - "Meta aggregation: incremental update per job, recount totals from job_details statuses and filesystem scan"
  - "Cache name versioning: bump triggers activate handler to purge old caches"

requirements-completed: [ACTIONS-01, ACTIONS-08, ACTIONS-09, INFRA-07]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 3 Plan 03: Workflow, Meta Script, and Service Worker Summary

**cache-pipeline.yml with 6 staggered cron jobs (03:00-05:30 UTC), generate-meta.js producing pipeline health meta.json, and service worker bumped to worldone-v2 with detail page assets**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T15:10:53Z
- **Completed:** 2026-03-21T15:13:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- cache-pipeline.yml defines 6 staggered cron jobs with timeout-minutes: 10, continue-on-error: true, and if: always() on meta/commit steps
- workflow_dispatch input allows manual trigger with selectable job group (all, biodiversity, environment-ext, etc.)
- generate-meta.js produces meta.json with last_full_update, jobs_ok, jobs_failed, total_cache_files, total_data_points
- Service worker CACHE_NAME bumped to worldone-v2, purging old v1 cache on activate
- Detail page assets (detail/index.html, css/detail.css, detail/detail-app.js) added to PRECACHE_ASSETS

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cache-pipeline.yml workflow and generate-meta.js script** - `c11b352` (feat)
2. **Task 2: Update service worker with versioned cache and data/cache routing** - `b2e46bd` (feat)

## Files Created/Modified
- `.github/workflows/cache-pipeline.yml` - 6 staggered cron jobs wiring cache scripts from Plans 01/02 into automated pipeline
- `scripts/generate-meta.js` - Meta aggregator producing data/cache/meta.json with pipeline health stats, exports generateMeta()
- `service-worker.js` - CACHE_NAME bumped to worldone-v2, detail page assets added to PRECACHE_ASSETS

## Decisions Made
- Single workflow file with 6 cron triggers rather than 6 separate workflow files -- reduces YAML duplication and keeps shared config (env, permissions, concurrency) in one place
- UCDP_API_TOKEN env var only added to the update-society-ext job since it is the only job that needs it (the secret is optional -- the script falls back to static data)
- data/cache/ routing confirmed to work via existing `/data/` entry in DATA_PATHS using `url.pathname.includes('/data/')` -- no additional DATA_PATHS entry needed
- Detail page assets added to PRECACHE_ASSETS alongside cache name bump to worldone-v2, ensuring browsers pick up all Phase 2 shell files on next SW update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. The workflow will run automatically on GitHub Actions. UCDP_API_TOKEN can optionally be added as a GitHub Secret for live conflict data.

## Next Phase Readiness
- All 6 cache scripts wired into automated pipeline with staggered cron scheduling
- meta.json tracks pipeline health (jobs_ok/failed, total files, data points)
- Service worker ready to serve cached data via network-first strategy
- Phase 3 (GitHub Actions Pipeline) complete -- all 3 plans delivered
- Ready for Phase 4 (Topic Modules) which builds detail page content on top of the cache infrastructure

## Self-Check: PASSED

All 5 files verified on disk. Both task commits (c11b352, b2e46bd) verified in git log.

---
*Phase: 03-github-actions-pipeline*
*Completed: 2026-03-21*
