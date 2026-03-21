---
phase: 08-remaining-topics
plan: 01
subsystem: detail-pages
tags: [i18n, fallback, solar, noaa, aurora, kp-index, topic-module]
dependency_graph:
  requires: [data-loader, badge, chart-manager, i18n, detail-shell, math-utils]
  provides: [solar-topic-module, phase8-i18n-keys, phase8-fallback-values]
  affects: [detail-app, i18n-translations, static-values]
tech_stack:
  added: [NOAA SWPC observed solar indices API, NOAA planetary Kp index API]
  patterns: [live NOAA augmentation with cache fallback, SVG aurora latitude bands via geoToSVG, Chart.js confidence bands with fill between datasets]
key_files:
  created:
    - detail/topics/solar.js
  modified:
    - js/i18n.js
    - data/fallback/static-values.json
decisions:
  - "Phase 8 i18n keys added upfront for all 5 topics to unblock parallel execution of Plans 02 and 03"
  - "Solar module uses two separate NOAA SWPC live fetches (observed sunspots + Kp index) with independent fallbacks"
  - "Aurora Kp bands draw from pole to latitude (not latitude to equator) for correct aurora visibility representation"
  - "Chart confidence bands use fill:+1 between high and low bound datasets with transparent borders"
metrics:
  duration: 5min
  completed: 2026-03-21
---

# Phase 8 Plan 01: Phase 8 i18n + Fallbacks & Solar Topic Module Summary

**Solar topic module with live NOAA SWPC sunspot data, solar cycle 25 chart with observed+predicted confidence bands, and SVG aurora Kp-index latitude map**

## What Was Built

### Task 1: Phase 8 i18n Keys and Static Fallback Values
- Added 62 DE and 62 EN translation keys covering all 5 Phase 8 topics: solar (14 keys), crypto_sentiment (10 keys), momentum_detail (12 keys), hunger (14 keys), disasters (12 keys)
- Populated static-values.json with structured fallback objects for all 5 topics (replaced null placeholders)
- Keys follow established Phase 4-7 naming convention: `detail.{topic}.{key}`

### Task 2: Solar Topic Module
- Created `detail/topics/solar.js` implementing full DETAIL-03 topic contract (meta, render, getChartConfigs, cleanup)
- **Hero block:** Fetches live observed sunspot count from NOAA SWPC (`observed-solar-cycle-indices.json`), displays most recent SSN with tier badge, shows current cycle phase (Maximum 2024-2026)
- **Chart block:** Canvas for Solar Cycle 25 chart with observed SSN (solid line) + predicted SSN (dashed line) + confidence envelope (high/low bounds as filled region)
- **Trend block:** Aurora Kp-Index SVG map (900x450) fetching live planetary Kp from NOAA SWPC (`planetary_k_index_1m.json`), draws colored latitude bands from poles to aurora visibility latitude using MathUtils.geoToSVG, with continent outlines and interactive legend
- **Tiles:** Flare risk (computed from SSN), solar wind speed, cycle phase
- **Error handling:** Each NOAA fetch wrapped in try/catch with independent fallbacks (cache for sunspots, static Kp=3 for aurora map)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 239c883 | Phase 8 i18n keys (62 DE + 62 EN) and static fallback values |
| 2 | 3f31dda | Solar topic module with NOAA SWPC live data, cycle chart, aurora map |

## Deviations from Plan

None - plan executed exactly as written.

## Key Patterns Used
- **Live API augmentation:** Two separate NOAA SWPC live fetches (observed sunspots + Kp index) with independent 3-tier fallback paths
- **SVG latitude bands:** KP_BANDS array maps Kp values to aurora visibility latitudes; bands rendered as rectangles from pole to latitude using MathUtils.geoToSVG
- **Chart.js confidence bands:** High/low bound datasets with `fill: '+1'` to create shaded envelope between prediction bounds
- **Shared continent outlines:** CONTINENT_PATHS reused from earthquakes.js/space.js (same 900x450 viewport)

## Verification Results
- All 5 static fallback topics populated (non-null): PASS
- DE i18n keys: 62 (PASS)
- EN i18n keys: 62 (PASS)
- Solar module exports: meta (id=solar), render, getChartConfigs, cleanup: PASS
- NOAA observed URL, Kp URL, fetchTopicData, geoToSVG usage: PASS
- solar already in VALID_TOPICS allowlist: confirmed

## Self-Check: PASSED

All created files exist. All commits (239c883, 3f31dda) verified in git log.
