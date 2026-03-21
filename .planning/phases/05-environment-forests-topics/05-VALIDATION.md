---
phase: 5
slug: environment-forests-topics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing (no automated test framework) |
| **Config file** | none |
| **Quick run command** | Open `detail/?topic=biodiversity` in browser |
| **Full suite command** | Open each of 4 new topic URLs + main page in browser, verify all blocks render |
| **Estimated runtime** | ~60 seconds (manual visual inspection) |

---

## Sampling Rate

- **After every task commit:** Open topic URL in browser, verify no console errors, all blocks populated
- **After every plan wave:** Open all 4 topic URLs + verify choropleth component works across topics
- **Before `/gsd:verify-work`:** All 5 success criteria verified in browser
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | INFRA-06 | manual | Open any choropleth topic in browser | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | ENV-03,04,05,06 | manual | Check static-values.json has non-null entries | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | ENV-03,04,05,06 | manual | Check i18n.js has detail.{topic}.* keys | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | ENV-03 | manual | `detail/?topic=biodiversity` -- hero, LPI, IUCN | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | ENV-04 | manual | `detail/?topic=airquality` -- AQI, cities, scatter | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | ENV-05 | manual | `detail/?topic=forests` -- cover, loss, causes | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | ENV-06 | manual | `detail/?topic=renewables` -- energy, carbon, growth | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `data/fallback/static-values.json` — populate biodiversity, airquality, forests, renewables entries (currently null)
- [ ] `js/i18n.js` — add all Phase 5 detail.{topic}.* keys for DE and EN
- [ ] `detail/utils/choropleth.js` — new file, INFRA-06 reusable SVG choropleth component

*These three items MUST be completed before topic modules can render.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SVG choropleth colors countries correctly | INFRA-06 | Visual rendering of SVG paths | Open topic with map, verify countries are colored by data, gray for no-data |
| Tooltip follows mouse on choropleth | INFRA-06 | Mouse interaction behavior | Hover over colored countries, verify tooltip appears with correct data |
| Living Planet Index trend chart renders | ENV-03 | Chart.js visual output | Open biodiversity, verify line chart shows 1970-2020 decline |
| AQI-vs-GDP scatter plot renders | ENV-04 | Chart.js visual output | Open airquality, verify scatter shows labeled country dots |
| Deforestation causes stacked bar | ENV-05 | Chart.js visual output | Open forests, verify stacked bar shows 5 cause categories |
| Solar+wind growth curves | ENV-06 | Chart.js visual output | Open renewables, verify dual-line chart shows capacity growth |
| Data tier badge shows correctly | ALL | Visual badge rendering | Each topic shows LIVE/Cache/Static badge in hero block |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual check after each task commit
- [ ] Wave 0 covers all MISSING references (static-values, i18n, choropleth)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
