---
phase: 10
slug: new-acts-bio-ocean-topics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing (no automated test framework) |
| **Config file** | none |
| **Quick run command** | Open index.html in browser, scroll to new sections |
| **Full suite command** | Manual walkthrough of all 5 success criteria |
| **Estimated runtime** | ~5 minutes |

---

## Sampling Rate

- **After every task commit:** Open browser, verify changed section/module renders correctly
- **After every plan wave:** Full scroll-through of new acts + visit all 5 detail pages
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (page reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | MAIN-03 | manual | Browser scroll past Act 11 | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | MAIN-04 | manual | Browser scroll past Act 12 | N/A | ⬜ pending |
| 10-01-03 | 01 | 1 | MAIN-05 | manual | Click each tile, verify URL | N/A | ⬜ pending |
| 10-02-01 | 02 | 2 | BIO-01 | manual | Navigate to detail/?topic=extinction | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | BIO-02 | manual | Navigate to detail/?topic=endangered | N/A | ⬜ pending |
| 10-03-01 | 03 | 2 | OCEAN-01 | manual | Navigate to detail/?topic=ocean_temp | N/A | ⬜ pending |
| 10-03-02 | 03 | 2 | OCEAN-02 | manual | Navigate to detail/?topic=ocean_ph | N/A | ⬜ pending |
| 10-03-03 | 03 | 2 | OCEAN-03 | manual | Navigate to detail/?topic=ocean_plastic | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no automated test framework exists in this project; all validation is manual browser testing, consistent with Phases 1-9.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Act 12 renders with biodiversity tiles on scroll | MAIN-03 | Visual/scroll behavior | Scroll past Act 11, verify Act 12 appears with extinction rate + endangered species tiles |
| Act 13 renders with ocean tiles on scroll | MAIN-04 | Visual/scroll behavior | Scroll past Act 12, verify Act 13 appears with SST anomaly, pH trend, plastic estimate tiles |
| Tiles navigate to detail pages on click | MAIN-05 | Click interaction | Click each tile in Acts 12/13, verify correct detail/?topic= URL |
| ocean_temp detail page | OCEAN-01 | Visual + SVG | Visit detail/?topic=ocean_temp, verify SST anomaly, heatmap choropleth, coral bleaching explainer |
| ocean_ph detail page | OCEAN-02 | Visual | Visit detail/?topic=ocean_ph, verify pH trend, scale, infographic |
| ocean_plastic detail page | OCEAN-03 | Visual + animation | Visit detail/?topic=ocean_plastic, verify estimate, animated counter, SVG map, decomposition animation |
| extinction detail page | BIO-01 | Visual | Visit detail/?topic=extinction, verify rate + mass extinction context |
| endangered detail page | BIO-02 | Visual | Visit detail/?topic=endangered, verify IUCN categories with counts |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: no 3 consecutive tasks without verification
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
