---
phase: 3
slug: github-actions-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js native test runner / validation scripts |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node scripts/validate-cache.js` |
| **Full suite command** | `node scripts/validate-cache.js --full` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/validate-cache.js`
- **After every plan wave:** Run `node scripts/validate-cache.js --full`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ACTIONS-01 | smoke | `node -e "require('fs').readFileSync('.github/workflows/cache-pipeline.yml','utf8')"` | No — W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | ACTIONS-02 | integration | `node scripts/cache-biodiversity.js && node -e "const d=JSON.parse(require('fs').readFileSync('data/cache/biodiversity.json','utf8')); if(!d._meta?.fetched_at) process.exit(1)"` | No — W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | ACTIONS-03 | integration | `node scripts/cache-environment-ext.js && ls data/cache/co2-history.json data/cache/ocean.json data/cache/solar.json` | No — W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | ACTIONS-04 | integration | `node scripts/cache-society-ext.js && ls data/cache/population.json data/cache/freedom.json data/cache/conflicts.json` | No — W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | ACTIONS-05 | integration | `node scripts/cache-economy-ext.js && ls data/cache/currencies.json data/cache/inequality.json data/cache/poverty.json` | No — W0 | ⬜ pending |
| 03-02-05 | 02 | 1 | ACTIONS-06 | integration | `node scripts/cache-progress-ext.js && ls data/cache/arxiv-ai.json data/cache/space-news.json` | No — W0 | ⬜ pending |
| 03-02-06 | 02 | 1 | ACTIONS-07 | integration | `node scripts/cache-disasters.js && ls data/cache/disasters.json data/cache/hunger.json` | No — W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | ACTIONS-08 | unit | `node scripts/validate-cache.js --check-workflow` | No — W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | ACTIONS-09 | unit | `node -e "const m=JSON.parse(require('fs').readFileSync('data/cache/meta.json','utf8')); ['last_full_update','jobs_ok','jobs_failed','total_cache_files','total_data_points'].forEach(k=>{if(!(k in m))process.exit(1)})"` | No — W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | INFRA-07 | unit | `node -e "const sw=require('fs').readFileSync('service-worker.js','utf8'); if(!sw.includes('worldone-v2'))process.exit(1)"` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/validate-cache.js` — validates all cache files have _meta.fetched_at, valid JSON, expected fields
- [ ] `data/cache/.gitkeep` — ensure directory exists in repo
- [ ] YAML validation for workflow file syntax

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cron triggers fire at correct UTC times | ACTIONS-01 | Requires waiting for GitHub scheduler | Push workflow, wait for 03:00 UTC, verify Actions tab shows triggered run |
| continue-on-error doesn't block deployment | ACTIONS-08 | Requires simulating API failure in live environment | Temporarily break one API call, verify other jobs and deployment succeed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
