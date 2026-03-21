---
phase: 09-main-page-clickable-data-points
verified: 2026-03-21T23:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 9: Main Page Clickable Data Points — Verification Report

**Phase Goal:** Make main-page data-points clickable links to their detail pages
**Verified:** 2026-03-21T23:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Hovering any detail-link shows +10% brightness, border glow, pointer cursor | VERIFIED | `css/sections.css` lines 1343-1355: `.detail-link` cursor:pointer, `.detail-link:hover` filter:brightness(1.1), box-shadow glow |
| 2 | Hovering shows tooltip "Klicken fur Details ->" (DE) / "Click for details ->" (EN) | VERIFIED | `css/sections.css` lines 1363-1385: `::after` uses `content: attr(data-tooltip)`; `js/i18n.js` lines 807, 1611: both language keys present |
| 3 | Clicking any static data tile navigates to `detail/?topic={id}` | VERIFIED | `js/app.js` line 1473: `window.location.href = \`detail/?topic=${link.dataset.topic}\`` inside click event delegation handler |
| 4 | Keyboard Enter/Space on a focused detail-link triggers navigation | VERIFIED | `js/app.js` lines 1479-1490: `keydown` handler checks `e.key !== 'Enter' && e.key !== ' '`, then navigates or scrolls |
| 5 | Sub-score categories scroll to their act section; momentum sub-score navigates to detail/?topic=momentum_detail | VERIFIED | `js/app.js` lines 1444-1461: `SECTION_SCROLL_MAP` sets `dataset.scrollTo` on environment/society/economy/progress sub-scores; momentum sub-score has `topic: 'momentum_detail'` in STATIC_TOPIC_MAP |
| 6 | Elements without matching detail topics remain unchanged — no click handler, no hover effect | VERIFIED | STATIC_TOPIC_MAP excludes GDP, inflation, unemployment, trade, regional GDP, infrastructure, literacy, GitHub, sentiment, volcanic, news. No `.detail-link` class is added to those elements. Event delegation only activates on `.detail-link` |
| 7 | Clicking a momentum indicator item navigates to correct detail topic page | VERIFIED | `js/app.js` lines 866-873: `MAIN_INDICATOR_TOPIC_MAP` keyed by German indicator name; `item.dataset.topic` set at DOM creation time in `_updateMomentum()` |
| 8 | Clicking a comparison-grid item navigates to correct detail topic page | VERIFIED | `js/app.js` lines 911-918: same `MAIN_INDICATOR_TOPIC_MAP` used for `card.dataset.topic` inside `mom.comparison2000.forEach` |
| 9 | After language toggle, all detail-link tooltips update to new language | VERIFIED | `js/app.js` lines 1365-1368: `_rebuildDynamic()` ends with `querySelectorAll('.detail-link[data-tooltip]').forEach(el => { el.dataset.tooltip = i18n.t('main.clickForDetails'); })` |
| 10 | Dynamic elements survive rebuild cycles (language toggle, section re-render) | VERIFIED | `_rebuildDynamic()` resets `_momentumBuilt = false` and calls `_updateMomentum()` again, which re-runs the MAIN_INDICATOR_TOPIC_MAP wiring code for newly created items |
| 11 | Reduced-motion accessibility fallback present | VERIFIED | `css/sections.css` lines 1387-1396: `@media (prefers-reduced-motion: reduce)` disables filter/transitions and uses outline instead |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `css/sections.css` | `.detail-link` hover styles with brightness, glow, cursor, `::after` tooltip, reduced-motion fallback | VERIFIED | Lines 1342-1396; all required CSS present and substantive (54 lines of purposeful CSS) |
| `js/i18n.js` | `main.clickForDetails` key in both DE and EN | VERIFIED | Line 807 (DE: `'Klicken fur Details ->'`), line 1611 (EN: `'Click for details ->'`) |
| `js/app.js` (Plan 01) | `_initDetailLinks()` method with `STATIC_TOPIC_MAP`, event delegation, keyboard accessibility | VERIFIED | Lines 1378-1491; method called from `init()` at line 69; 36-entry STATIC_TOPIC_MAP + SECTION_SCROLL_MAP + click/keydown delegation |
| `js/app.js` (Plan 02) | `MAIN_INDICATOR_TOPIC_MAP` in `_updateMomentum`, comparison wiring, tooltip refresh in `_rebuildDynamic` | VERIFIED | Lines 828-850 (map with 21 entries); lines 866-873 (momentum items); lines 911-918 (comparison items); lines 1365-1368 (tooltip refresh) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `js/app.js` | `css/sections.css` | `classList.add('detail-link')` on elements | WIRED | `classList.add('detail-link')` called 4 times: lines 868, 913, 1437, 1456 |
| `js/app.js` | `js/i18n.js` | `i18n.t('main.clickForDetails')` for tooltip text | WIRED | Called 5 times: lines 870, 915, 1367, 1440, 1459 |
| `js/app.js` | `detail/?topic={id}` | `window.location.href` on click | WIRED | Lines 1473 and 1486 — both click and keyboard paths navigate correctly |
| `js/app.js _updateMomentum` | `detail/?topic={id}` | `item.dataset.topic` set at DOM creation | WIRED | Line 869 sets `item.dataset.topic = topic`; event delegation (line 1472) picks it up |
| `js/app.js _rebuildDynamic` | `js/i18n.js` | `querySelectorAll('.detail-link[data-tooltip]')` refresh | WIRED | Line 1366-1368; executed at end of `_rebuildDynamic()` after momentum/realtime re-renders |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MAIN-01 | 09-01-PLAN, 09-02-PLAN | All data points, tiles, and chart sections with matching detail topics navigate to `detail/?topic={id}` on click | SATISFIED | STATIC_TOPIC_MAP (36 entries, Acts 1-7) + MAIN_INDICATOR_TOPIC_MAP (21 entries, dynamic elements) + event delegation. Non-topic elements correctly excluded. |
| MAIN-02 | 09-01-PLAN, 09-02-PLAN | Hover state: +10% brightness, border glow, tooltip "Klicken fur Details ->" | SATISFIED | `css/sections.css` `.detail-link:hover` has `filter: brightness(1.1)` and `box-shadow` glow; `::after` tooltip via `content: attr(data-tooltip)` reads `i18n.t('main.clickForDetails')` from both DE/EN translations |

No orphaned requirements found. REQUIREMENTS.md traceability table marks both MAIN-01 and MAIN-02 as Complete / Phase 9.

---

### Anti-Patterns Found

None detected. Scanned `css/sections.css`, `js/i18n.js`, and `js/app.js` for TODO, FIXME, XXX, HACK, PLACEHOLDER, `return null`, empty handlers, and console-only stubs. The only `console.log` is a diagnostic count (`[BelkisOne] Detail links wired: N`) which is appropriate for a production-oriented app of this type.

---

### Human Verification Required

The following items require browser testing and cannot be verified programmatically:

**1. Hover visual appearance**
Test: Open `index.html` in browser, hover over the CO2 data-card in Act 2.
Expected: Pointer cursor, visible brightness increase, subtle blue glow around card borders, tooltip "Klicken fur Details ->" appears in bottom-right corner of the card.
Why human: CSS filter/box-shadow rendering and tooltip overflow behaviour depend on browser paint engine.

**2. Click navigation end-to-end**
Test: Click the CO2 card, earthquake widget, and wealth-comparison section.
Expected: Browser navigates to `detail/?topic=co2`, `detail/?topic=earthquakes`, `detail/?topic=inequality` respectively.
Why human: `window.location.href` navigation in a file:// or localhost context may differ; detail page existence and topic module loading must be confirmed.

**3. Excluded elements confirmed unchanged**
Test: Hover over GDP growth card (Act 4), inflation widget, news widget (Act 6).
Expected: No brightness increase, no glow, no tooltip, no pointer cursor change.
Why human: Requires visual confirmation that excluded elements are visually inert.

**4. Dynamic momentum items (Act 7)**
Test: Scroll to Act 7, wait for momentum section to appear. Hover and click a CO2-Konzentration item.
Expected: Hover shows tooltip and glow; click navigates to `detail/?topic=co2`.
Why human: Requires the data pipeline to have returned momentum data; items are created lazily on scroll.

**5. Language toggle tooltip update**
Test: Hover a detail-link (note DE tooltip), switch to EN, hover same element.
Expected: Tooltip text changes to "Click for details ->".
Why human: `_rebuildDynamic()` tooltip refresh requires the DOM mutation to be confirmed visually.

---

### Summary

Phase 9 goal is fully achieved. The codebase contains a complete, substantive, and wired implementation across all three modified files:

- `css/sections.css` — `.detail-link` hover class with brightness glow, `::after` tooltip, focus-visible outline, and reduced-motion fallback (54 lines, appended at end of file without breaking existing styles).
- `js/i18n.js` — `main.clickForDetails` key present in both DE and EN language objects.
- `js/app.js` — `_initDetailLinks()` called from `init()`, wires 36 static elements via `STATIC_TOPIC_MAP` and 4 category scroll links via `SECTION_SCROLL_MAP`; `_updateMomentum()` wires dynamic momentum and comparison items via `MAIN_INDICATOR_TOPIC_MAP` (21 entries); `_rebuildDynamic()` refreshes all tooltips on language toggle.

All three commits (4a09516, c7a3cc1, 8274473) are present in git history with correct attribution and scope.

Both MAIN-01 and MAIN-02 requirements are satisfied. No orphaned requirements. No anti-patterns. No placeholder or stub code detected. Five human verification items are noted for browser-side confirmation of visual and navigational behavior.

---

_Verified: 2026-03-21T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
