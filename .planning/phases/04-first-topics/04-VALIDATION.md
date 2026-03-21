---
phase: 4
slug: first-topics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Browser-based manual + Node.js script validation |
| **Config file** | none — no test framework in project |
| **Quick run command** | `node -e "require('./scripts/process-data.js')"` |
| **Full suite command** | `node scripts/collect-data.js && node scripts/process-data.js` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Open `detail/?topic={topic}` in browser, verify render
- **After every plan wave:** Run full data pipeline + check all 5 topic pages
- **Before `/gsd:verify-work`:** All 5 topics render correctly with data
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ENV-01 | manual | Open `detail/?topic=co2` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | ENV-02 | manual | Open `detail/?topic=temperature` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | RT-01 | manual | Open `detail/?topic=earthquakes` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | SOC-01 | manual | Open `detail/?topic=population` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 2 | SOC-02 | manual | Open `detail/?topic=conflicts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `detail/index.html` and `detail-app.js` load correctly
- [ ] Verify `data-loader.js` resolves paths from `detail/` subdirectory
- [ ] Verify `_stub.js` topic module contract works end-to-end

*Existing infrastructure (detail page shell from Phase 2, pipeline from Phase 3) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CO2 ppm display + Keeling Curve | ENV-01 | Visual chart rendering | Open detail/?topic=co2, verify ppm value and chart |
| Warming stripes + tooltips | ENV-02 | Interactive DOM elements | Open detail/?topic=temperature, hover stripes |
| Earthquake SVG map + popups | RT-01 | SVG interaction + live data | Open detail/?topic=earthquakes, click dots |
| Population pyramid toggle | SOC-01 | Interactive year switching | Open detail/?topic=population, toggle years |
| Conflict map + trend chart | SOC-02 | SVG + Chart.js rendering | Open detail/?topic=conflicts, verify all sections |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
