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
