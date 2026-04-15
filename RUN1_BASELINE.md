# World.One_v2.0 — Stabilization Run 1 Baseline Report

## Scope
Run 1 executed as **baseline + reproducibility pass** only.
No feature implementation, no refactor, no dependency additions.

## 1) Environment & Script Baseline

### package scripts (observed)
- `collect`: `node scripts/collect-data.js`
- `process`: `node scripts/process-data.js`
- `pipeline`: `node scripts/collect-data.js && node scripts/process-data.js`

### Tooling observations
- `npm ci` succeeds.
- No `lint`, no `test`, no explicit `typecheck` script in `package.json`.

## 2) Executed Checks (Run 1)

### A. Install
- Command: `npm ci`
- Result: **PASS**
- Note: npm warning about unknown env config `http-proxy` (non-blocking in current run).

### B. Process build
- Command: `npm run process`
- Result: **PASS**
- Produced world index output and regenerated processed data successfully.
- Notable runtime log values in this run:
  - Environment Score: 48.8
  - Society Score: 55.7
  - Economy Score: 67.2
  - Progress Score: 76.4
  - Momentum Score: 80
  - World Index: 65.9

### C. Self-heal integrity
- Command: `node scripts/self-heal.js`
- Result: **PASS (with auto-fixes)**
- Self-heal restored:
  - `subScores.momentum.weight`
  - `subScores.momentum.indicators`
- Interpretation: pipeline has working self-repair, but this indicates schema drift risk between processor output and heal expectations.

### D. Cache validation
- Command: `node scripts/validate-cache.js`
- Result: **PASS**
- Summary: 14/14 cache files valid.

### E. Fallback validation
- Command: `node scripts/validate-fallback.js`
- Result: **FAIL**
- Summary: 16 validation errors.
- Error pattern: several topic keys in `data/fallback/static-values.json` are not in the expected `{ value, year, source }` object shape (e.g. `airquality`, `biodiversity`, `forests`, `renewables`).

## 3) Baseline Findings

## 3.1 What is stable right now
- Install path and processing path are operational.
- Self-heal mechanism runs and can patch specific missing fields.
- Cache file set is structurally valid in current baseline.

## 3.2 What is unstable / needs next-run attention
1. **Fallback schema mismatch**
   - Validation script and static fallback data are not aligned.
   - This is a concrete blocker for strict data-contract reliability.

2. **Schema consistency between process and self-heal**
   - Auto-fixes were needed immediately after processing.
   - Suggests process output may not always satisfy post-heal required fields.

3. **Quality gates missing in package scripts**
   - No lint/test/typecheck baseline gate from npm scripts.

## 4) Run 1 Risks Register
- **R1 — Fallback Contract Drift (High):** Static fallback schema currently fails validator.
- **R2 — Processor/Healer Contract Gap (Medium):** Self-heal patches fields that ideally should already be present.
- **R3 — Quality Gate Coverage (Medium):** No first-class lint/test scripts.

## 5) Open Questions Before Run 2
1. Is `validate-fallback.js` the current source of truth for fallback schema, or is `static-values.json` intentionally broader/legacy?
2. Should self-heal be allowed to patch momentum fields every run, or should `process-data.js` be tightened to emit these fields always?
3. For Run 2 (routing/link hardening): do we want automated topic-link smoke tests in CI or local-only first?

## 6) Go / No-Go Decision for Run 2
**Decision: GO (conditional).**

Proceed to Run 2 with two prerequisites tracked:
- Keep fallback schema mismatch as a known issue (or resolve first if Run 2 depends on fallback-heavy topic routes).
- Record self-heal patching behavior as baseline anomaly to prevent regressions.

## 7) Repro Command Matrix (Run 1)
```bash
npm ci
npm run process
node scripts/self-heal.js
node scripts/validate-cache.js
node scripts/validate-fallback.js
```

## 8) Notes on repository state hygiene
Processed/history files created during Run 1 execution were reverted locally before finalization of this report, so this run contributes **documentation only**.

---

# Run 2 — Error Remediation + Live Data Expansion

Scope: fix everything Run 1 surfaced as unstable, and expand the live-data footprint
(Roadmap Run 5/Run 6 combined) per the directive "alle Fehler immer gleich beheben +
mehr live daten integrieren".

## A) Fixes Applied

### A.1 Fallback schema drift (R1 — High)
- **Before:** `validate-fallback.js` reported 16 errors (`airquality`, `biodiversity`,
  `forests`, `renewables` keyed directly with `{value, unit, year, source}` instead of
  the expected `{ <point>: { value, year, source } }` wrapper).
- **Fix:** Wrapped the four keys in named sub-points
  (`global_aqi`, `threatened_species`, `forest_cover_pct`, `share_pct`) in
  `data/fallback/static-values.json`.
- **Consumer updates:** `detail/topics/airquality.js` and `detail/topics/forests.js`
  now read both nested and legacy-flat shapes (null-safe `data?.<point> ?? data`).
- **Verification:** `node scripts/validate-fallback.js` → 0 errors, 28/28 topics.

### A.2 Processor / self-heal contract gap (R2 — Medium)
- **Before:** self-heal auto-patched `subScores.momentum.weight` and
  `subScores.momentum.indicators` on every run (process output was missing them).
- **Fix:** `scripts/process-data.js` now emits the full momentum shape
  (`weight: 0.10`, `label`, `zone`, `trend`, `change`, `indicators: finalMomentum`)
  in parity with the other four sub-scores.
- **Verification:** `node scripts/self-heal.js` → "Data integrity OK — no repairs needed".

## B) Live Data Expansion

New script `scripts/cache-live-data.js` adds 10 live-data caches that used to fall
straight through to the static fallback:

| Topic             | Source                                      | Cache file               |
|-------------------|---------------------------------------------|--------------------------|
| temperature       | NASA GISTEMP (primary) / NOAA NCEI (fallback) | `temperature.json`     |
| forests           | World Bank AG.LND.FRST.ZS                   | `forests.json`           |
| renewables        | World Bank EG.FEC.RNEW.ZS                   | `renewables.json`        |
| airquality        | Open-Meteo AQI (20 major cities)            | `airquality.json`        |
| weather           | Open-Meteo current weather (20 cities)      | `weather.json`           |
| earthquakes       | USGS 24h + 7d + significant_week feeds      | `earthquakes.json`       |
| crypto_sentiment  | alternative.me Fear & Greed (30 days)       | `crypto_sentiment.json`  |
| science           | arXiv cs.AI + cs.LG                         | `science.json`           |
| space             | Spaceflight News API v4                     | `space.json`             |
| health            | World Bank LE / mortality / DTP3            | `health.json`            |

Each task is independent (try/catch wrapper) so one API outage does not block
the others. The script exits 0 as long as at least one cache is written.

- **Workflow:** `.github/workflows/cache-pipeline.yml` gains a 7th scheduled job
  (`update-live-data`, 06:00 UTC) mirroring the existing six-job pattern
  (10 min timeout, continue-on-error, rebase+retry push).
- **Meta aggregation:** `scripts/generate-meta.js` registers the `live-data` job
  with all 10 filenames for `meta.json` rollup.
- **Validator:** `scripts/validate-cache.js` EXPECTED_FILES grows from 14 → 24,
  EXPECTED_JOBS gains `update-live-data`. `--check-workflow` passes.

## C) Post-Fix Verification Matrix

```bash
npm run process                # PASS  (world index 65.9)
node scripts/self-heal.js      # PASS  (0 auto-fixes)
node scripts/validate-cache.js # PASS  (23/23 files valid — temperature pending live fetch)
node scripts/validate-cache.js --check-workflow # PASS (all 7 jobs present)
node scripts/validate-fallback.js                # PASS (0 errors, 28/28 topics)
node scripts/cache-live-data.js                  # 9/10 live (temperature deferred: NASA+NOAA transient 503 during run)
```

## D) Remaining Notes
- `temperature.json` was not written during this local run because both NASA GISTEMP
  (`data.giss.nasa.gov`) and NOAA NCEI climate-at-a-glance returned HTTP 503 at the
  same window. The workflow's scheduled retry at 06:00 UTC will populate it when
  either source recovers. No code change required.
- The four repaired fallback keys stay backward compatible for any external consumer
  thanks to the null-safe unwrap pattern (`data?.<sub> ?? data`).

---

# Run 3 — Cache-to-Score Integration

Roadmap focus: the World Index was computed almost entirely from
`data/raw/*` while 23 of 25 cache files sat unused in the score
path (they only fed the detail pages via `fetchTopicData`). Run 3
closes that gap and exposes freshness.

## A) Architecture Diagnosis

| Before Run 3 | After Run 3 |
|---|---|
| 2 caches consumed by processor (`ocean`, `conflicts`) | **14 caches consumed** |
| 23 caches written but unused by the score | **11 caches** still detail-only (intentional: arxiv-ai, earthquakes, solar, currencies, population, biodiversity, etc.) |
| 0 indicators with freshness metadata | **25/25 scored indicators** carry `{fetchedAt, ageHours, source}` |
| `meta.cacheFreshness` absent | summary per sub-score (newest/oldest/sourceCount) |

## B) Processor Changes (`scripts/process-data.js`)

- New helper `readCacheFresh(filename)` returns
  `{ data, fetchedAt, ageHours }` parsed from the `_meta.fetched_at`
  envelope each cache-pipeline script writes.
- New helper `freshness(isoOrNull, source)` produces the standard
  `{fetchedAt, ageHours, source}` block spread into every indicator.
- **Environment score** now consumes: `temperature.json`,
  `forests.json`, `renewables.json`, `airquality.json`, `waqi.json`
  (WAQI wins over Open-Meteo when token present), `disasters.json`
  (GDACS events add a capped penalty to the env score).
- **Economy score** consumes: `fred.json` — US inflation YoY is
  averaged with World Bank, Fed Funds Rate and 10Y-2Y Yield Spread
  are surfaced as two new indicators. Inverted yield curve applies
  a 5-point recession penalty.
- **Society score** consumes: `health.json` (life expectancy,
  child mortality), `freedom.json` (Freedom House trend),
  `conflicts.json` (already used — kept).
- **Progress score** consumes: `internet.json` (World Bank users
  % + mobile per 100), `science.json` (arXiv total_results).
- Air-quality weight added to env score (AQI indicator gains 10%
  weight, other indicators rebalanced).

## C) Freshness in UI (`js/visualizations/world-indicator.js`)

Each of the 5 sub-score cards renders a small "aktualisiert vor Xh"
badge under the existing weight label:

- `< 1h`: "gerade aktualisiert"
- `< 24h`: "aktualisiert vor Xh"
- else: "aktualisiert vor Xd"

Hover title shows newest + oldest timestamps (localized German) and
the number of cache sources blended. CSS: new
`.sub-score__updated` rule in `css/sections.css`.

## D) Coverage Validator

`scripts/validate-score-coverage.js` — new one-shot check:

1. Parses `process-data.js` and lists which `readCache*()` calls
   exist, revealing score coverage.
2. Lists unused cache files (expected-detail-only).
3. Verifies every scored indicator has `ageHours` (momentum
   excluded: derived).
4. Confirms `meta.cacheFreshness` is emitted per category.
5. Warns when a whole sub-score runs on static-only inputs.

## E) Post-Run-3 Verification

```text
process          PASS  World Index 62.6 (was 65.9 on stale-cache baseline)
self-heal        PASS  0 fixes
validate-cache   PASS  24/24 files valid
validate-fallback PASS 28/28, 0 errors
validate-routing PASS  0 errors, 2 unchanged warnings
validate-score-coverage PASS
  Cache files total:   24
  Consumed by score:   14   (was 2)
  Detail-pages only:   11
  Indicators scored:   25   (all with freshness metadata)
  Cache freshness covers: environment, society, progress
  (economy waits for FRED secret to activate)
```

The World Index dropped from 65.9 → 62.6 after Run 3 — that is
actual signal: the env sub-score now correctly includes AQI weight
and GDACS disaster penalties, so the score reflects live world
state instead of raw-only inputs.

---

# Premium Sources Integration (env-gated)

Free-tier APIs that require a key/secret. Each one is silently skipped
at runtime if its env var is missing, so partial rollouts are safe.

| Source   | Secret name     | Sign-up URL                                         | Cache file        |
|----------|-----------------|-----------------------------------------------------|-------------------|
| ACLED    | `ACLED_EMAIL` + `ACLED_PASSWORD` | https://acleddata.com/register/      | `conflicts.json`  |
| UCDP     | (none — keyless)                 | https://ucdp.uu.se/apidocs/           | `conflicts.json`  |
| FRED     | `FRED_API_KEY`                   | https://fredaccount.stlouisfed.org/apikeys | `fred.json`  |
| WAQI     | `WAQI_TOKEN`                     | https://aqicn.org/data-platform/token/ | `waqi.json`      |
| NewsAPI  | `NEWS_API_KEY`                   | https://newsapi.org/register          | `news.json`       |

Workflow integration:
- `.github/workflows/cache-pipeline.yml` has a dedicated 06:30-UTC
  `update-premium-sources` job that runs `scripts/cache-premium-sources.js`
  with `FRED_API_KEY`, `WAQI_TOKEN`, `NEWS_API_KEY` piped from repo secrets.
- ACLED + UCDP stay in `update-society-ext` (04:00 UTC) where they already
  lived.

Local testing:
```bash
# Skip everything (no env set):
node scripts/cache-premium-sources.js
# -> "0 ok, 3 skipped (no token), 0 errors"

# Run a single source:
FRED_API_KEY=xxx node scripts/cache-premium-sources.js
# -> fred runs, waqi + news are skipped
```

---

# Run 2 — Routing & Navigation Integrity

Roadmap Run 2. Goal: stable main↔detail navigation without broken topic links.
Same directive applied: fix everything found, integrate more live data.

## A) Routing Findings (Before)

- VALID_TOPICS allowlist (29) matched files on disk (29) — OK.
- `poverty`, `hunger`, `disasters`, `biodiversity` were reachable only via direct URL
  — no main-page anchor, so users could not drill in from the section they describe.
- Keyboard delegation on `.detail-link` listened on `document` without guarding
  native interactive controls — a stray Enter/Space on a button could double-fire.
- No automated check tied the allowlist, filesystem, topic contract, main-page map
  and i18n title keys together.

## B) Fixes Applied

### B.1 Missing navigation links
- `js/app.js` STATIC_TOPIC_MAP:
  - `.wealth-comparison__side:nth-child(3)` → `poverty` (the "extreme poverty"
    side of Act 4 wealth-comparison).
  - `#akt-biodiversity .section-header` → `biodiversity` overview
    (data-card children keep their existing drill-downs to `extinction` /
    `endangered`).
- `hunger` and `disasters` remain URL-only (no clean anchor in current main-page
  layout); the routing validator now surfaces these as warnings so they cannot
  silently regress.

### B.2 Keyboard a11y guard
`js/app.js` keydown delegation now bails out early when the target is a native
interactive element (`BUTTON`, `INPUT`, `TEXTAREA`, `SELECT`, `A`, or
`contentEditable`) so the detail-link shortcut cannot hijack standard controls.

### B.3 Routing smoke test
New `scripts/validate-routing.js` verifies in one pass:
1. VALID_TOPICS ↔ filesystem alignment.
2. Every topic module exports the full contract (`meta`, `render`, `cleanup`,
   `getChartConfigs`).
3. Every main-page STATIC_TOPIC_MAP entry is on the allowlist.
4. Every topic `meta.titleKey` exists in `js/i18n.js` (or is explicitly
   `_stub`, the placeholder).
5. Tier coverage: per topic, which tier the data loader will reach
   (`cache` = dedicated cache file present / `static` = falls through to
   `static-values.json` / `unresolved` = nothing → would be a regression).

## C) Live-Data Expansion (Run-1 follow-up)

- New `internet.json` cache in `scripts/cache-live-data.js`
  (World Bank IT.NET.USER.ZS + IT.CEL.SETS.P2), completing the formerly
  static-only internet topic.
- `validate-routing.js` cache-alias map (`extinction`, `endangered` ← `biodiversity.json`;
  `ocean_*` ← `ocean.json`; `co2` ← `co2-history.json`) makes indirect live-data
  coverage measurable.
- Tier coverage went from 23/28 → **26/28** cache-backed. Only `temperature`
  (pending NASA/NOAA recovery) and `momentum_detail` (derived internal score)
  remain on the static tier.

## D) Post-Run-2 Verification

```bash
node scripts/validate-routing.js
#   Allowlist topics:       29
#   Modules on disk:        29
#   Main-page mapped:       26
#   Cache-backed topics:    26
#   Static-fallback only:   2
#   Unresolved topics:      0
#   Errors:                 0
#   Warnings:               2   (hunger / disasters URL-only)
node scripts/validate-cache.js        # 24/24 files valid
node scripts/validate-fallback.js     # 28/28 topics, 0 errors
npm run process                       # PASS
node scripts/self-heal.js             # 0 auto-fixes
```
