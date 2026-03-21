---
phase: 9
slug: main-page-clickable-data-points
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing (no automated test framework in project) |
| **Config file** | none |
| **Quick run command** | Open index.html in browser, click 3-5 tiles per act |
| **Full suite command** | Manual walkthrough all 13 sections, all clickable elements |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual spot-check 3-5 tiles per act
- **After every plan wave:** Full walkthrough all acts, all clickable elements
- **Before `/gsd:verify-work`:** Every mapped element verified clickable, hover effects visible, tooltip shows in both DE and EN
- **Max feedback latency:** ~30 seconds per spot-check

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | MAIN-02 | manual | Hover over tiles, verify brightness/glow/cursor/tooltip | N/A | pending |
| 09-01-02 | 01 | 1 | MAIN-01 | manual | Click each static tile, verify detail/?topic={id} navigation | N/A | pending |
| 09-02-01 | 02 | 1 | MAIN-01 | manual | Click dynamic momentum/realtime items, verify navigation | N/A | pending |
| 09-02-02 | 02 | 1 | MAIN-02 | manual | Hover dynamic items, verify tooltip in DE and EN | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install — all verification is manual browser testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Click tile -> detail page | MAIN-01 | No automated test framework; requires browser navigation | Open index.html, click each mapped tile, verify URL changes to detail/?topic={id} |
| Hover brightness + glow | MAIN-02 | Visual CSS effect, requires human eye | Hover over each tile, verify +10% brightness filter, border glow, pointer cursor |
| Tooltip text DE/EN | MAIN-02 | Requires language toggle and visual verification | Toggle DE/EN, hover tiles, verify tooltip reads correct language |
| Scroll animations intact | Regression | Requires visual verification of scroll-driven animations | Scroll through all sections, verify reveal animations still trigger |
| Counter animations intact | Regression | Requires visual verification of animated counters | Scroll to counter sections, verify numbers animate up |
| Chart interactivity intact | Regression | Requires mouse interaction with Chart.js canvases | Hover over chart data points, verify tooltips still appear |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual spot-check after every commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per spot-check
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
