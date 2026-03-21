---
phase: 2
slug: detail-page-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser testing (no test framework configured) |
| **Config file** | none — Wave 0 creates all new files |
| **Quick run command** | Open `detail/index.html?topic=_stub` in browser |
| **Full suite command** | Manual: test all 12 scenarios listed below |
| **Estimated runtime** | ~60 seconds (manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Open `detail/?topic=_stub` in browser, verify no console errors
- **After every plan wave:** Run through all 12 test scenarios below
- **Before `/gsd:verify-work`:** All 12 scenarios must pass
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | DETAIL-01 | manual-smoke | Open `detail/?topic=_stub` in browser | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | DETAIL-02 | manual-smoke | Open `detail/?topic=_stub`, check console | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | DETAIL-03 | manual-smoke | Check _stub.js loads without errors | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | DETAIL-04 | manual-visual | Inspect DOM for 7 sections in order | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | DETAIL-05 | manual-visual | Check fixed nav, scroll for BTT button | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | DETAIL-06 | manual-interaction | Click share on mobile/desktop | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 1 | DETAIL-07 | manual-interaction | Ctrl+P, verify print preview | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | DETAIL-08 | manual-visual | Throttle network, observe shimmer | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | DETAIL-09 | manual-smoke | Open `detail/?topic=nonexistent` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 2 | DETAIL-10 | manual-interaction | Toggle DE/EN, verify labels | ❌ W0 | ⬜ pending |
| 2-03-04 | 03 | 2 | DETAIL-11 | manual-interaction | Click 1Y/5Y/20Y/Max buttons | ❌ W0 | ⬜ pending |
| 2-03-05 | 03 | 2 | DETAIL-12 | manual-visual | Compare side-by-side with main page | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `detail/index.html` — the HTML shell (does not exist yet)
- [ ] `detail/detail-app.js` — entry point script (does not exist yet)
- [ ] `detail/topics/_stub.js` — stub topic module (does not exist yet)
- [ ] `css/detail.css` — detail page stylesheet (does not exist yet)
- [ ] New i18n keys in `js/i18n.js` for detail.* namespace

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL routing loads shell | DETAIL-01 | Browser-only URLSearchParams | Open `detail/?topic=_stub` |
| Dynamic import works | DETAIL-02 | Requires browser ESM support | Check console for render log |
| 7 blocks render in order | DETAIL-04 | Visual layout verification | Inspect DOM structure |
| Back/BTT/breadcrumb | DETAIL-05 | Interactive UI behavior | Click navigation elements |
| Share functionality | DETAIL-06 | Requires HTTPS/user activation | Test on mobile + desktop |
| Print CSS | DETAIL-07 | Print preview is browser-only | Ctrl+P / Cmd+P |
| Skeleton loaders | DETAIL-08 | Visual animation timing | Throttle network in DevTools |
| Error page | DETAIL-09 | Browser routing behavior | Navigate to invalid topic |
| i18n switching | DETAIL-10 | Multi-language DOM updates | Toggle language, verify |
| Time range selector | DETAIL-11 | Interactive chart controls | Click range buttons |
| Design consistency | DETAIL-12 | Visual comparison | Side-by-side with main page |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: no 3 consecutive tasks without verification
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
