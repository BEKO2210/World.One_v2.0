---
phase: 1
slug: data-layer-utilities
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None -- vanilla JS project, no test framework |
| **Config file** | none -- Wave 0 creates test harness |
| **Quick run command** | `node scripts/validate-fallback.js` |
| **Full suite command** | `node scripts/validate-fallback.js && manual browser verification` |
| **Estimated runtime** | ~2 seconds (schema validation only) |

---

## Sampling Rate

- **After every task commit:** Manual browser console verification
- **After every plan wave:** Manual verification of all 5 INFRA requirements in browser
- **Before `/gsd:verify-work`:** All 5 success criteria verified manually
- **Max feedback latency:** 5 seconds (schema validation script)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-01 | integration | Manual browser test | N/A | pending |
| 01-01-02 | 01 | 1 | INFRA-01 | integration | Manual browser test | N/A | pending |
| 01-02-01 | 02 | 1 | INFRA-02 | integration | Manual browser test | N/A | pending |
| 01-02-02 | 02 | 1 | INFRA-02 | integration | Manual browser test | N/A | pending |
| 01-03-01 | 03 | 1 | INFRA-03 | automated | `node scripts/validate-fallback.js` | No -- W0 | pending |
| 01-03-02 | 03 | 1 | INFRA-04 | integration | Manual browser test | N/A | pending |
| 01-03-03 | 03 | 1 | INFRA-05 | integration | Manual browser test | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `scripts/validate-fallback.js` -- Node.js script to validate static-values.json schema (all 28 topic keys, required fields: value, year, source)
- [ ] No test framework install needed -- vanilla JS project uses manual browser verification + Node.js validation scripts

*Existing service worker and CSS infrastructure covers integration points.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3-tier fallback chain (live -> cache -> static) | INFRA-01 | Requires browser fetch API + network simulation | 1. Open detail page with valid API -> verify LIVE badge 2. Block API (DevTools offline) -> verify Cache badge 3. Clear cache + block API -> verify Static badge |
| Badge visual states (pulsing, orange, gray) | INFRA-02 | Visual rendering requires browser | Inspect badge DOM elements, verify CSS classes and animations |
| Chart.js CDN load + dark defaults | INFRA-04 | Requires browser script loading | 1. Load page -> verify Chart global exists 2. Check Chart.defaults.color is light text 3. Block jsDelivr -> verify cdnjs fallback |
| Chart instance registry destroy() | INFRA-05 | Requires canvas element lifecycle | 1. Create chart 2. Navigate away 3. Verify no orphaned canvas via Chart.getChart() |

---

## Validation Sign-Off

- [ ] All tasks have manual verification steps or Wave 0 dependencies
- [ ] Sampling continuity: manual browser check after each task
- [ ] Wave 0 covers schema validation script
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
