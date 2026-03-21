---
phase: 6
slug: society-economy-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser validation (no automated test framework in project) |
| **Config file** | none |
| **Quick run command** | `open detail/?topic=health` in browser |
| **Full suite command** | Visit all 4 topic URLs: health, freedom, inequality, poverty |
| **Estimated runtime** | ~60 seconds (manual page load + visual check per topic) |

---

## Sampling Rate

- **After every task commit:** Open the relevant topic URL in browser, verify hero renders
- **After every plan wave:** Visit all implemented topic URLs, check all visualization blocks
- **Before `/gsd:verify-work`:** All 4 topic URLs render without JS errors, all success criteria visualizations visible
- **Max feedback latency:** ~15 seconds per topic page load

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SOC-03 | manual | `open detail/?topic=health` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | SOC-03 | manual | `open detail/?topic=health` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | SOC-04 | manual | `open detail/?topic=freedom` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | ECON-02 | manual | `open detail/?topic=poverty` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | ECON-01 | manual | `open detail/?topic=inequality` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | ECON-01 | manual | `open detail/?topic=inequality` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `data/fallback/static-values.json` — populate health, freedom, inequality, poverty (currently null)
- [ ] `js/i18n.js` — add ~60 keys per language for all 4 Phase 6 topics
- [ ] `detail/topics/health.js` — new file
- [ ] `detail/topics/freedom.js` — new file
- [ ] `detail/topics/inequality.js` — new file
- [ ] `detail/topics/poverty.js` — new file

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Life expectancy hero renders with badge | SOC-03 | Visual check, no test framework | Open detail/?topic=health, verify hero shows ~73.4 years with tier badge |
| Causes-of-death treemap shows proportional blocks | SOC-03 | DOM-based visual, no assertion framework | Open health topic, verify treemap has colored blocks with labels |
| Health spending bubble chart renders | SOC-03 | Chart.js canvas, visual only | Open health topic, verify scatter with bubbles (x=spending, y=life exp) |
| Vaccination choropleth colors countries | SOC-03 | SVG visual, no pixel-level test | Open health topic, verify world map with gradient coloring |
| Freedom score hero and trend chart | SOC-04 | Visual check | Open detail/?topic=freedom, verify score ~42.3 and 18-year line chart |
| Freedom choropleth green/yellow/red | SOC-04 | SVG visual | Open freedom topic, verify 3-color world map |
| Gini hero and wealth animation | ECON-01 | DOM animation, visual only | Open detail/?topic=inequality, verify ~38.5 hero and 100-person grid |
| Income/wealth Gini toggle works | ECON-01 | Interaction test | Click toggle buttons, verify ranking chart updates |
| Poverty trend animated line | ECON-02 | Canvas animation | Open detail/?topic=poverty, verify 43.4%->10.3% trend line |
| Regional stacked area chart | ECON-02 | Chart.js canvas | Open poverty topic, verify stacked area with regional colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
