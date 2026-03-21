---
phase: 8
slug: remaining-topics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing (no automated test framework) |
| **Config file** | none |
| **Quick run command** | `Open detail/?topic={id} in browser` |
| **Full suite command** | `Visit all 5 topic URLs sequentially` |
| **Estimated runtime** | ~60 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Open topic URL in browser, verify hero renders, charts load, no console errors
- **After every plan wave:** Visit all 5 topic URLs, check Chrome DevTools for errors
- **Before `/gsd:verify-work`:** All 5 topics render correctly with tier badge showing appropriate data source
- **Max feedback latency:** ~30 seconds per topic

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-xx | 01 | 1 | RT-03 | manual-only | Browse `detail/?topic=solar` | N/A | ⬜ pending |
| 08-01-xx | 01 | 1 | RT-04 | manual-only | Browse `detail/?topic=crypto_sentiment` | N/A | ⬜ pending |
| 08-02-xx | 02 | 1 | MOM-01 | manual-only | Browse `detail/?topic=momentum_detail` | N/A | ⬜ pending |
| 08-02-xx | 02 | 1 | CRISIS-01 | manual-only | Browse `detail/?topic=hunger` | N/A | ⬜ pending |
| 08-02-xx | 02 | 1 | CRISIS-02 | manual-only | Browse `detail/?topic=disasters` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed; project uses manual browser validation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Solar hero + cycle 25 chart + Kp map | RT-03 | No automated test framework; visual verification required | Open `detail/?topic=solar`, verify hero with solar activity, solar cycle 25 chart with sunspot data, aurora Kp-index map with latitude bands |
| Crypto 30-day F&G chart with color zones | RT-04 | No automated test framework; color zone visual check | Open `detail/?topic=crypto_sentiment`, verify 30-day bar chart with red (fear) to green (greed) color zones |
| 20 momentum mini-cards with sparklines | MOM-01 | No automated test framework; 20-card grid layout check | Open `detail/?topic=momentum_detail`, verify all 20+ cards show value, trend arrow, % change, sparkline, assessment badge |
| Hunger choropleth + FAO trend | CRISIS-01 | No automated test framework; map interaction check | Open `detail/?topic=hunger`, verify choropleth colors by malnutrition rate, click popups work, FAO trend chart renders |
| Disaster timeline + dual-axis chart | CRISIS-02 | No automated test framework; dual-axis visual check | Open `detail/?topic=disasters`, verify 2026 timeline with type/country/affected/damage, historical trend chart with dual y-axes |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: every topic verified after each commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
