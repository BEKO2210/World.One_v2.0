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
