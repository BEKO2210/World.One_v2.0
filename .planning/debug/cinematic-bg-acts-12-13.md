---
status: diagnosed
trigger: "Act 12 (Biodiversity) and Act 13 (Oceans) have no cinematic background images"
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Current Focus

hypothesis: IntersectionObserver never observes any section elements because register() is called before init() creates the observer
test: Traced code path through app.js -> scroll-engine.js -> cinematic.js
expecting: All cinematic backgrounds affected, not just acts 12-13
next_action: Return diagnosis

## Symptoms

expected: Acts 12 and 13 should show cinematic Unsplash background images like existing acts
actual: No background images visible on acts 12 and 13
errors: None reported (silent failure)
reproduction: Load main page, scroll to acts 12 and 13
started: Since these acts were added

## Eliminated

- hypothesis: Missing SECTION_IMAGES entries in cinematic.js
  evidence: Both 'akt-biodiversity' and 'akt-oceans' present in SECTION_IMAGES (lines 22-23)
  timestamp: 2026-03-22

- hypothesis: Wrong section IDs in HTML
  evidence: HTML has id="akt-biodiversity" (line 951) and id="akt-oceans" (line 988), matching SECTION_IMAGES keys exactly
  timestamp: 2026-03-22

- hypothesis: Missing scroll engine registration
  evidence: Both sections in sectionIds array at app.js lines 131-132, registered with engine.register()
  timestamp: 2026-03-22

- hypothesis: Broken Unsplash image URLs
  evidence: Both URLs return HTTP 200 (verified via curl)
  timestamp: 2026-03-22

- hypothesis: Missing CSS for cinematic-bg
  evidence: sections.css has .cinematic-bg and .cinematic-bg__img rules (lines 6-25), file loaded in HTML (line 17)
  timestamp: 2026-03-22

- hypothesis: HTML markup structure differs from working acts
  evidence: Both new acts use identical pattern (section.section > div.container.section__content > div.section-header.reveal)
  timestamp: 2026-03-22

- hypothesis: Missing nav dot registration
  evidence: Both sections in _initNavDots sections array at app.js lines 1179-1180
  timestamp: 2026-03-22

## Evidence

- timestamp: 2026-03-22
  checked: cinematic.js SECTION_IMAGES
  found: Both 'akt-biodiversity' and 'akt-oceans' have valid Unsplash URLs (lines 22-23)
  implication: Image config is correct

- timestamp: 2026-03-22
  checked: index.html section markup
  found: Both sections have correct id, class="section", data-section attributes matching SECTION_IMAGES keys
  implication: DOM elements exist and are findable

- timestamp: 2026-03-22
  checked: app.js _initScrollEngine() call order
  found: register() called at lines 135-139 BEFORE engine.init() at line 141
  implication: this._observer is null when register() runs, so observer.observe(element) is never called

- timestamp: 2026-03-22
  checked: scroll-engine.js register() method
  found: Line 58 checks "if (this._observer)" before observing — observer is null pre-init, so no elements are observed
  implication: IntersectionObserver never watches any section elements

- timestamp: 2026-03-22
  checked: scroll-engine.js _updateSections()
  found: Line 155 checks "if (!section.isVisible) { continue; }" — isVisible only set by observer callback which never fires
  implication: All section progress callbacks are skipped, including cinematic.updateSection()

- timestamp: 2026-03-22
  checked: cinematic.js _createBgLayer() and updateSection()
  found: _createBgLayer creates div with opacity:0, updateSection sets opacity:1 when progress > 0.05
  implication: Bg layers are created in DOM but never revealed because updateSection never runs with non-zero progress

## Resolution

root_cause: |
  PRIMARY: scroll-engine.js register-before-init ordering bug.
  In app.js _initScrollEngine() (line 125), engine.register() is called for all 15 sections
  (lines 135-139) BEFORE engine.init() (line 141). The register() method at scroll-engine.js
  line 58 checks "if (this._observer)" before calling observer.observe(element), but
  this._observer is null because init() -> _setupObservers() hasn't run yet. As a result,
  the IntersectionObserver never watches ANY section element. The _updateSections() loop
  (line 155) checks section.isVisible (only set by the observer callback) and skips all
  sections because isVisible stays false. This means cinematic.updateSection() is never
  called with progress > 0 for ANY section, so all bg images remain at opacity: 0.

  This bug affects ALL sections, not just acts 12-13. The reason it's noticed only on acts
  12-13 is likely because existing acts have rich data visualizations (charts, warming stripes,
  maps) that dominate visually, making the missing background less obvious. Acts 12-13 have
  minimal content (just data cards), making the missing atmospheric background much more apparent.

fix:
verification:
files_changed: []
