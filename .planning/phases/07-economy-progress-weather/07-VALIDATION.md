---
phase: 7
slug: economy-progress-weather
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing (no automated test framework configured) |
| **Config file** | none |
| **Quick run command** | Open `detail/?topic=currencies` in browser |
| **Full suite command** | Open all 5 topic URLs sequentially |
| **Estimated runtime** | ~60 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Open the implemented topic URL in browser, verify renders without console errors
- **After every plan wave:** Open all 5 topic URLs, verify interactivity (converter, counters, ISS tracking)
- **Before `/gsd:verify-work`:** Full suite must be green — all 5 topics render with correct data
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-xx | 01 | 1 | ECON-03 | manual | Open `detail/?topic=currencies`, test converter, verify charts | N/A | ⬜ pending |
| 07-02-xx | 02 | 1 | PROG-01 | manual | Open `detail/?topic=science`, verify 4 visualization blocks | N/A | ⬜ pending |
| 07-03-xx | 03 | 1 | PROG-02 | manual | Open `detail/?topic=internet`, verify counters tick, map colors | N/A | ⬜ pending |
| 07-04-xx | 04 | 2 | PROG-03 | manual | Open `detail/?topic=space`, wait 30s, verify ISS moved 3+ times | N/A | ⬜ pending |
| 07-05-xx | 05 | 2 | RT-02 | manual | Open `detail/?topic=weather`, count city cards, check sparklines | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no automated test infrastructure exists for the project. All validation is manual browser testing following the pattern established in Phases 4-6.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Currency converter produces correct results | ECON-03 | Interactive widget, requires user input | Enter amount, select currencies, verify output matches cached rate |
| ISS position updates every 10s with orbit trail | PROG-03 | Live API + SVG animation, timing-dependent | Open space topic, wait 30s, verify dot moved 3+ times and trail visible |
| Real-time counters increment smoothly | PROG-02 | requestAnimationFrame-based, requires visual check | Open internet topic, verify counters tick up continuously |
| Weather sparklines render for all 24 cities | RT-02 | 24 SVG polylines, visual layout check | Open weather topic, count city cards, verify each has sparkline SVG |
| Hyperinflation countries highlighted | ECON-03 | Visual styling check | Open currencies topic, verify Venezuela/Zimbabwe/Argentina visually distinct |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without verification
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
