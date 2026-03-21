---
status: diagnosed
phase: 10-new-acts-bio-ocean-topics
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md]
started: 2026-03-21T23:10:00Z
updated: 2026-03-22T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Open index.html in a browser (fresh load / hard refresh). The page loads without errors in the browser console. All existing acts still render. Scrolling reaches the bottom (Epilog) without freezing or crashing.
result: pass

### 2. Act 12 and Act 13 Visible on Main Page
expected: Scrolling down past Act 11 (Solar/Renewable), you see Act 12 (Biodiversity) with a green-themed section and data cards, then Act 13 (Oceans) with a blue-themed section and data cards, before reaching the Epilog.
result: pass

### 3. Nav Dots Include New Acts
expected: The navigation dots sidebar (right side) shows entries for Biodiversity and Oceans. Clicking them scrolls to the corresponding act sections.
result: pass

### 4. Cinematic Backgrounds for New Acts
expected: Act 12 (Biodiversity) shows a nature/wildlife background image. Act 13 (Oceans) shows an ocean/underwater background image. Both load from Unsplash with the same cinematic parallax effect as other acts.
result: issue
reported: "no image, und bitte auch kein billiges image laden mach es im gleichem syle wie die webseite passend"
severity: major

### 5. Data Tile Click-Through from Act 12
expected: Clicking a data tile in Act 12 (e.g., Extinction or Endangered) navigates to the corresponding detail page (detail/?topic=extinction or detail/?topic=endangered).
result: pass

### 6. Data Tile Click-Through from Act 13
expected: Clicking a data tile in Act 13 (e.g., Ocean Temperature, Ocean pH, or Plastic) navigates to the corresponding detail page (detail/?topic=ocean_temp, ocean_ph, or ocean_plastic).
result: pass

### 7. Ocean Temperature Detail Page
expected: Navigating to detail/?topic=ocean_temp shows: a hero section with SST anomaly value, a 1880-present timeline chart, warming milestone tiles, a coral bleaching infographic, and a regional SST choropleth map with country-level data. Bilingual labels switch with DE/EN toggle.
result: pass

### 8. Ocean pH Detail Page
expected: Navigating to detail/?topic=ocean_ph shows: a hero with pH 8.08 and -0.17 change, a descending pH trend chart (1850-2025), an interactive pH scale with markers, 4 marine organism impact cards, and a then-vs-now comparison section.
result: pass

### 9. Ocean Plastic Detail Page
expected: Navigating to detail/?topic=ocean_plastic shows: a ~170 Mio t hero, an animated daily counter that ticks every second, a world map SVG with 5 pulsing garbage patch circles and continent outlines, and decomposition time bars for different materials.
result: pass

### 10. Extinction Detail Page
expected: Navigating to detail/?topic=extinction shows: a 1000x rate hero, a Big Five mass extinctions horizontal bar chart with current Holocene comparison, taxonomic group extinction cards (7 groups), a Sixth Mass Extinction explanation, and a Then-vs-Now timeline.
result: pass

### 11. Endangered Species Detail Page
expected: Navigating to detail/?topic=endangered shows: a total threatened species hero from cache data, an IUCN 7-category doughnut chart with center total, proportional CR/EN/VU bars, bilingual species examples (5 per category), and an Assessed-vs-Unknown comparison.
result: pass

### 12. i18n Language Toggle
expected: Switching language (DE/EN) on any of the 5 new detail pages updates all labels, descriptions, and species names to the selected language without page reload.
result: pass

## Summary

total: 12
passed: 11
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Act 12 (Biodiversity) and Act 13 (Oceans) show cinematic background images matching the website's existing visual style"
  status: failed
  reason: "User reported: no image, und bitte auch kein billiges image laden mach es im gleichem syle wie die webseite passend"
  severity: major
  test: 4
  root_cause: "Register-before-init ordering bug: app.js calls engine.register() before engine.init(), so IntersectionObserver is null when sections are registered. Observer never watches elements, isVisible stays false, cinematic backgrounds never reveal."
  artifacts:
    - path: "js/app.js"
      issue: "engine.init() called after sectionIds.forEach(register) — must be called before"
    - path: "js/scroll-engine.js"
      issue: "register() guards observation behind if(this._observer) which is null pre-init"
  missing:
    - "Fix call order in app.js: engine.init() before register loop, OR fix scroll-engine.js init() to retroactively observe already-registered sections"
  debug_session: ".planning/debug/cinematic-bg-acts-12-13.md"
