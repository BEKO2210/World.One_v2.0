# Phase 9: Main Page Clickable Data Points - Research

**Researched:** 2026-03-21
**Domain:** DOM event delegation, CSS hover effects, main-page-to-detail-page navigation
**Confidence:** HIGH

## Summary

Phase 9 transforms every data tile, counter, chart section, and widget on the existing World.One main page (index.html) into clickable links that navigate to the corresponding detail page (detail/?topic={id}). This is a pure UI wiring phase -- no new data fetching, no new visualizations, no new topic modules. The work consists of: (1) building a mapping from main page DOM elements to detail topic IDs, (2) attaching click handlers via event delegation, (3) adding CSS hover states (+10% brightness, border glow, pointer cursor), (4) adding a bilingual tooltip ("Klicken fur Details" / "Click for details"), and (5) ensuring zero visual or behavioral regressions.

The main page has 13 sections (prolog through epilog). Of these, Acts 2-7 contain data tiles, charts, and widgets that map to the 24 existing detail topics. Acts 1, 8, 9, 10, 11, and epilog contain structural content (world indicator overview, crisis map, scenarios, sources, actions, epilog) that either have no corresponding detail page or span multiple topics. The key technical challenge is attaching click handlers to dynamically-generated DOM (momentum items, comparison grid, earthquake lists, news feeds) without breaking the existing scroll-driven animations, counters, or map interactions.

**Primary recommendation:** Use a single CSS class `.detail-link` applied via JavaScript to all clickable elements, with event delegation at the section level. Add `data-topic` attributes to map each element to its detail topic ID. CSS handles all hover effects via the `.detail-link` class. The tooltip uses a CSS `::after` pseudo-element with `content: attr(data-tooltip)` driven by the current language.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAIN-01 | All data points, tiles, and chart sections become clickable -> detail/?topic={id} | Element-to-topic mapping table (Section: Architecture Patterns), event delegation pattern, click handler implementation |
| MAIN-02 | Hover state: +10% brightness, border glow, tooltip "Klicken fur Details ->" | CSS `.detail-link` class with filter/box-shadow/cursor/::after tooltip, i18n integration for DE/EN |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020+ | Event delegation, DOM traversal | Project convention -- no framework dependencies |
| CSS Custom Properties | CSS3 | Hover effects, transitions | Already used throughout core.css |
| data-i18n | existing | Tooltip text localization | Project's i18n.js system already handles `data-i18n` attributes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMUtils | existing (js/utils/dom.js) | create(), debounce(), throttle() | For any DOM manipulation |
| i18n | existing (js/i18n.js) | Language-aware tooltip text | For DE/EN tooltip rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-element click listeners | Event delegation at section level | Delegation is better: fewer listeners, works with dynamically-created DOM |
| JavaScript hover effects | Pure CSS :hover on .detail-link class | CSS is better: no JS execution during hover, GPU-accelerated filter |
| `<a>` tag wrapping | click handler + window.location | Click handler is better: avoids restructuring existing DOM, avoids breaking scroll animations |

**Installation:**
```bash
# No new dependencies -- all existing project code
```

## Architecture Patterns

### Element-to-Topic Mapping

This is the critical mapping. Every main page element that should link to a detail page needs a `data-topic` attribute. Below is the complete inventory derived from examining index.html and app.js.

**Act 1 -- World Indicator (akt-indicator)**
| Element | Selector / Identifier | Topic ID | Notes |
|---------|----------------------|----------|-------|
| Sub-score: Umwelt | `.sub-score[data-subscore="environment"]` | (no single topic) | Links to akt-environment section scroll, NOT a detail page |
| Sub-score: Gesellschaft | `.sub-score[data-subscore="society"]` | (no single topic) | Links to akt-society section scroll |
| Sub-score: Wirtschaft | `.sub-score[data-subscore="economy"]` | (no single topic) | Links to akt-economy section scroll |
| Sub-score: Fortschritt | `.sub-score[data-subscore="progress"]` | (no single topic) | Links to akt-progress section scroll |
| Sub-score: Momentum | `.sub-score[data-subscore="momentum"]` | `momentum_detail` | Momentum has its own detail page |

**Decision needed:** Sub-scores for environment/society/economy/progress are aggregate categories, not individual topics. Two options: (a) scroll to the corresponding act section on the main page, or (b) skip clickability for these 4. Recommendation: scroll to corresponding section, since they are "gateways" to that act.

**Act 2 -- Environment (akt-environment)**
| Element | Selector / Identifier | Topic ID |
|---------|----------------------|----------|
| CO2 data-card (featured) | `.akt-environment .data-card--featured` (first) | `co2` |
| Temperature anomaly card | `.akt-environment .bento-grid--2 .data-card:nth-child(2)` | `temperature` |
| Warming stripes | `#warming-stripes` parent .reveal | `temperature` |
| CO2 full chart | `#co2-chart` parent .reveal | `co2` |
| Arctic ice card | `.akt-environment .bento-grid--3 .data-card:nth-child(1)` | `temperature` |
| Forest card | `.akt-environment .bento-grid--3 .data-card:nth-child(2)` | `forests` |
| Renewable energy card | `.akt-environment .bento-grid--3 .data-card:nth-child(3)` | `renewables` |
| Air quality grid | `.akt-environment .air-quality-grid` parent | `airquality` |
| Weather grid | `.akt-environment .weather-grid` parent | `weather` |

**Act 3 -- Society (akt-society)**
| Element | Selector / Identifier | Topic ID |
|---------|----------------------|----------|
| Population card | `.akt-society .bento-grid--4 .data-card:nth-child(1)` | `population` |
| Conflicts card | `.akt-society .bento-grid--4 .data-card:nth-child(2)` | `conflicts` |
| Life expectancy card | `.akt-society .bento-grid--4 .data-card:nth-child(3)` | `health` |
| Child mortality card | `.akt-society .bento-grid--4 .data-card:nth-child(4)` | `health` |
| Conflict map | `#conflict-map` parent .reveal | `conflicts` |
| Refugee counter | `.refugee-counter` | `conflicts` |
| Freedom section | `.akt-society .freedom-legend` parent .reveal | `freedom` |
| Life expectancy chart | `#life-expectancy-chart` parent .data-card | `health` |
| Infrastructure card | `.akt-society .infra-bars` parent .data-card | (no topic) |

**Decision needed:** Infrastructure bars (electricity/water/education) have no dedicated detail page. Recommendation: skip clickability for this card, or link to `health` as closest topic.

**Act 4 -- Economy (akt-economy)**
| Element | Selector / Identifier | Topic ID |
|---------|----------------------|----------|
| Wealth comparison (billionaires side) | `.wealth-comparison__side:first-child` | `inequality` |
| Wealth comparison (poverty side) | `.wealth-comparison__side:last-child` | `poverty` |
| Wealth distribution bar | `#inequality-bar` parent .reveal | `inequality` |
| GDP growth card | `.akt-economy .bento-grid--4 .data-card:nth-child(1)` | (no topic) |
| Inflation card | `.akt-economy .bento-grid--4 .data-card:nth-child(2)` | (no topic) |
| Unemployment card | `.akt-economy .bento-grid--4 .data-card:nth-child(3)` | (no topic) |
| GDP per capita card | `.akt-economy .bento-grid--4 .data-card:nth-child(4)` | (no topic) |
| Gini chart card | `#gini-chart` parent .data-card | `inequality` |
| Trade card | `#trade-sparkline` parent .data-card | (no topic) |
| Exchange rates card | `#exchange-rates` parent .data-card | `currencies` |
| Regional GDP card | `#regional-gdp` parent .data-card | (no topic) |

**Note:** Several economy cards (GDP growth, inflation, unemployment, GDP per capita, trade, regional GDP) have no individual detail pages. Recommendation: make the wealth-comparison as a whole link to `inequality`, and skip cards with no topic match. Alternatively, link the whole `.wealth-comparison` element to `inequality`.

**Act 5 -- Progress (akt-progress)**
| Element | Selector / Identifier | Topic ID |
|---------|----------------------|----------|
| Internet users card | `.akt-progress .bento-grid--4 .data-card:nth-child(1)` | `internet` |
| Literacy card | `.akt-progress .bento-grid--4 .data-card:nth-child(2)` | (no topic) |
| Mobile card | `.akt-progress .bento-grid--4 .data-card:nth-child(3)` | (no topic) |
| R&D card | `.akt-progress .bento-grid--4 .data-card:nth-child(4)` | `science` |
| Publications chart | `#publications-chart` parent .reveal | `science` |
| GitHub pulse | `.akt-progress .data-card--featured` (github) | (no topic) |
| Internet chart card | `#internet-chart` parent .data-card | `internet` |
| Literacy chart card | `#literacy-stairs` parent .data-card | (no topic) |
| Spaceflight news card | `#spaceflight-news` parent .data-card | `space` |
| arXiv papers card | `#arxiv-papers` parent .data-card | `science` |

**Act 6 -- Realtime (akt-realtime)**
| Element | Selector / Identifier | Topic ID |
|---------|----------------------|----------|
| Earthquakes widget | widget containing `#earthquake-list` | `earthquakes` |
| Clean cities widget | widget containing `#clean-cities` | `airquality` |
| Dirty cities widget | widget containing `#dirty-cities` | `airquality` |
| Sentiment widget | widget containing `#sentiment-wave` | (no topic) |
| Fear & Greed widget | widget containing `#fear-greed-gauge` | `crypto_sentiment` |
| Solar widget | widget containing `#solar-activity` | `solar` |
| Volcanic widget | widget containing `#volcanic-activity` | (no topic) |
| News widget | widget containing `#global-news` | (no topic) |

**Act 7 -- Momentum (akt-momentum)**
| Element | Selector / Identifier | Topic ID |
|---------|----------------------|----------|
| Each momentum-item | `.momentum-item` (dynamically created) | varies per indicator |
| Comparison grid items | `.comparison-item` (dynamically created) | varies |
| Momentum gauge | `#momentum-gauge` parent .reveal | `momentum_detail` |

**Note:** Momentum items are dynamically created in `_updateMomentum()`. The Phase 8 work already added an `INDICATOR_TOPIC_MAP` in the detail momentum module. A similar mapping is needed here for the main page momentum items (mapping indicator name -> topic ID).

### Recommended Implementation Structure

```
js/
  app.js                    # Modified: add _initDetailLinks() method
css/
  components.css            # Modified: add .detail-link hover styles
js/i18n.js                  # Modified: add tooltip translation keys
```

No new files needed. All changes go into existing files.

### Pattern 1: Event Delegation with data-topic Attributes

**What:** Add `data-topic` attributes to clickable elements, use event delegation at section level to handle clicks.
**When to use:** For all static DOM elements (data-cards, widgets, sub-scores, warming stripes container).

```javascript
// In app.js, new method called from init()
_initDetailLinks() {
  // Static elements: add data-topic + detail-link class
  const ELEMENT_TOPIC_MAP = [
    // Act 2 - Environment
    { selector: '#akt-environment .data-card--featured', topic: 'co2' },
    { selector: '#warming-stripes', topic: 'temperature', closest: '.reveal' },
    // ... full mapping
  ];

  ELEMENT_TOPIC_MAP.forEach(({ selector, topic, closest }) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const target = closest ? el.closest(closest) || el : el;
    target.dataset.topic = topic;
    target.classList.add('detail-link');
    target.setAttribute('role', 'link');
    target.setAttribute('tabindex', '0');
    target.dataset.tooltip = i18n.t('main.clickForDetails');
  });

  // Delegate click at document level
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.detail-link');
    if (!link) return;
    const topic = link.dataset.topic;
    if (!topic) return;
    // Prevent navigation if user was selecting text or interacting with controls
    if (window.getSelection().toString()) return;
    window.location.href = `detail/?topic=${topic}`;
  });

  // Keyboard accessibility
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const link = e.target.closest('.detail-link');
      if (link && link.dataset.topic) {
        e.preventDefault();
        window.location.href = `detail/?topic=${link.dataset.topic}`;
      }
    }
  });
}
```

### Pattern 2: Dynamic Element Wiring (Momentum Items)

**What:** For elements created dynamically by `_updateMomentum()`, `_buildRealtime()`, etc., add `data-topic` and `.detail-link` class at creation time.
**When to use:** For momentum-items, comparison-items, and any other DOM created in JS.

```javascript
// In _updateMomentum, modify the item creation:
const INDICATOR_TOPIC_MAP = {
  'CO2': 'co2',
  'Temperatur': 'temperature',
  'Waldflache': 'forests',
  // ... full map from indicator names to topic IDs
};

mom.indicators.forEach((ind, i) => {
  const topic = INDICATOR_TOPIC_MAP[ind.name] || null;
  const item = DOMUtils.create('div', {
    className: `momentum-item reveal swoosh-right ${topic ? 'detail-link' : ''}`,
    // ... existing innerHTML
  });
  if (topic) {
    item.dataset.topic = topic;
    item.dataset.tooltip = i18n.t('main.clickForDetails');
    item.setAttribute('role', 'link');
    item.setAttribute('tabindex', '0');
  }
  momList.appendChild(item);
});
```

### Pattern 3: CSS-Only Hover Effects

**What:** All hover styling is pure CSS via `.detail-link` class. No JS needed for hover.
**When to use:** Always -- CSS hover is more performant than JS-driven hover.

```css
/* components.css addition */
.detail-link {
  cursor: pointer;
  position: relative;
  transition:
    filter var(--duration-fast) var(--ease-out-quart),
    box-shadow var(--duration-fast) var(--ease-out-quart),
    border-color var(--duration-fast) var(--ease-out-quart);
}

.detail-link:hover,
.detail-link:focus-visible {
  filter: brightness(1.1);
  box-shadow: 0 0 16px rgba(0, 212, 255, 0.2), 0 0 4px rgba(0, 212, 255, 0.1);
  border-color: rgba(0, 212, 255, 0.3);
}

/* Tooltip via ::after */
.detail-link::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 4px 10px;
  background: rgba(10, 10, 15, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
  z-index: 10;
}

.detail-link:hover::after {
  opacity: 1;
}

/* Reduced motion: skip filter animation */
@media (prefers-reduced-motion: reduce) {
  .detail-link:hover {
    filter: none;
    outline: 2px solid var(--progress);
  }
}
```

### Anti-Patterns to Avoid

- **Wrapping elements in `<a>` tags:** This would restructure the DOM, potentially breaking the ScrollEngine's section registration, IntersectionObserver targets, and CSS grid layouts. Use click handlers instead.
- **Inline onclick handlers:** Against project conventions. Use event delegation.
- **JS-driven hover effects (mouseenter/mouseleave):** CSS :hover is more performant and handles edge cases (touch, rapid mouse movement) automatically.
- **Modifying the data-card :hover that already exists:** The existing `.data-card:hover` adds `translateY(-2px)` and shadow. The `.detail-link` class ADDS to this, it does not replace it. Both should coexist.
- **Breaking chart interactivity:** Charts (CO2 line chart, Gini chart, etc.) have their own click/hover interactions. The `.detail-link` should be on the parent `.data-card` or `.reveal` wrapper, not on the `<canvas>` itself. This way, clicking the card area outside the chart navigates, while chart-internal interactions are preserved.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip positioning | Custom JS tooltip with getBoundingClientRect | CSS `::after` with `attr(data-tooltip)` | No JS needed, automatically positions, no z-index management |
| Language-aware tooltip | Manual text swap on language change | `data-tooltip` attribute updated in `_rebuildDynamic()` | Integrates with existing language toggle flow |
| Click-outside-chart detection | Complex event target analysis | Click handler on parent container, let chart canvas consume its own events | Event bubbling handles this naturally |

## Common Pitfalls

### Pitfall 1: Breaking Scroll-Driven Animations
**What goes wrong:** Adding click handlers or DOM modifications disrupts the ScrollEngine's IntersectionObserver, causing sections to not animate on scroll.
**Why it happens:** Changing element structure, adding wrapper divs, or altering CSS `position` values.
**How to avoid:** ONLY add classes and data attributes to existing elements. Never wrap elements in new containers. The `.detail-link` class must not change `position` from its inherited value unless the element already has `position: relative`.
**Warning signs:** Sections no longer fade in on scroll, nav dots stop updating.

### Pitfall 2: Counter Animations Break on Click
**What goes wrong:** Clicking a data-card with a `data-counter` attribute causes navigation before the counter animation completes, or the counter never starts because the element has a click handler.
**Why it happens:** Event listener order conflicts.
**How to avoid:** The click handler is on the parent `.detail-link` element (the data-card), not on the counter span itself. Counters are children inside the card -- they animate independently. The CounterManager uses IntersectionObserver, not click events.

### Pitfall 3: Dynamic DOM Not Wired
**What goes wrong:** Momentum items, comparison grid items, earthquake lists, and other dynamically-generated elements are not clickable because `_initDetailLinks()` ran before the DOM was created.
**Why it happens:** `_initDetailLinks()` runs in `init()`, but momentum list is built lazily in `_updateMomentum()` when the section scrolls into view. Similarly, `_buildRealtime()` creates widget contents.
**How to avoid:** Two strategies: (1) For elements created in `_updateMomentum()` / `_buildRealtime()`, add the `detail-link` class and `data-topic` at creation time inside those methods. (2) For `_rebuildDynamic()` (language toggle, timeline), re-apply the wiring.
**Warning signs:** Clicking momentum items or realtime widgets does nothing.

### Pitfall 4: Tooltip Clipped by overflow:hidden
**What goes wrong:** The CSS `::after` tooltip is cut off because the parent container has `overflow: hidden`.
**Why it happens:** `.section`, `.data-card`, and `.widget` all have `overflow: hidden` in their CSS.
**How to avoid:** Position the tooltip inside the element bounds (bottom of element rather than above), or use `overflow: visible` on the `.detail-link` element specifically. Best approach: position tooltip INSIDE the element (bottom-right corner) rather than above/outside, eliminating clipping entirely.
**Warning signs:** Tooltips appear cut off or don't show at all on hover.

### Pitfall 5: Wealth-Comparison Split Navigation
**What goes wrong:** The wealth-comparison section has two sides (billionaires vs poverty) that should link to different topics, but they share a parent container.
**Why it happens:** The HTML structure uses a single `.wealth-comparison` div with two child `.wealth-comparison__side` divs.
**How to avoid:** Apply `.detail-link` to each `.wealth-comparison__side` independently with different `data-topic` values. Alternatively, make the entire comparison link to `inequality` (the more natural choice since the section is about wealth distribution).

### Pitfall 6: Chart Canvas Clicks Intercepted
**What goes wrong:** Clicking on a Chart.js canvas element triggers navigation instead of chart interaction (tooltip, point hover).
**Why it happens:** Click event bubbles from canvas to the `.detail-link` parent.
**How to avoid:** Add `e.stopPropagation()` is NOT needed because Chart.js canvas interactions are typically `mousemove`/`mouseenter` hover-based, not click-based. However, if any charts have click handlers, those handlers call `stopPropagation()` themselves. Verify: the existing charts (CO2 line, Gini, life expectancy, internet, publications) use Chart.js `hover.mode` but no `onClick` callbacks, so this is safe.

### Pitfall 7: Language Toggle Tooltip Text Stale
**What goes wrong:** After toggling DE/EN, tooltips still show the previous language.
**Why it happens:** `data-tooltip` attribute was set once in `_initDetailLinks()` and never updated.
**How to avoid:** In `_rebuildDynamic()`, re-set all `data-tooltip` attributes: `document.querySelectorAll('.detail-link').forEach(el => el.dataset.tooltip = i18n.t('main.clickForDetails'))`.

## Code Examples

### i18n Keys to Add

```javascript
// In js/i18n.js, add to both de and en objects:

// German
'main.clickForDetails': 'Klicken fur Details ->',

// English
'main.clickForDetails': 'Click for details ->',
```

### Complete Element-to-Topic Map (for _initDetailLinks)

```javascript
// Static elements wired once at init
const STATIC_TOPIC_MAP = [
  // Act 1 - Sub-scores (scroll-to-section, not detail pages)
  // Momentum sub-score links to detail page
  { selector: '.sub-score[data-subscore="momentum"]', topic: 'momentum_detail' },

  // Act 2 - Environment
  { selector: '#akt-environment .bento-grid--2 .data-card--featured', topic: 'co2' },
  { selector: '#akt-environment .bento-grid--2 .data-card:not(.data-card--featured)', topic: 'temperature' },
  { selector: '#co2-chart', topic: 'co2', wrapClosest: '.reveal' },
  { selector: '#warming-stripes', topic: 'temperature', wrapClosest: '.reveal' },
  // Arctic ice, forest, renewable cards in bento-grid--3
  // (need nth-child or data-attribute-based selection)

  // Act 3 - Society
  // Population, conflicts, life exp, child mortality cards

  // Act 4 - Economy
  { selector: '.wealth-comparison', topic: 'inequality' },
  { selector: '#gini-chart', topic: 'inequality', wrapClosest: '.data-card' },
  { selector: '#exchange-rates', topic: 'currencies', wrapClosest: '.data-card' },

  // Act 5 - Progress
  { selector: '#publications-chart', topic: 'science', wrapClosest: '.reveal' },
  { selector: '#spaceflight-news', topic: 'space', wrapClosest: '.data-card' },
  { selector: '#arxiv-papers', topic: 'science', wrapClosest: '.data-card' },

  // Act 6 - Realtime (widgets)
  // Handled by finding parent .widget of known child IDs

  // Act 7 - Momentum
  { selector: '#momentum-gauge', topic: 'momentum_detail', wrapClosest: '.reveal' },
];
```

### Dynamic Wiring in _updateMomentum

```javascript
// Indicator name -> topic ID mapping for momentum items
const MAIN_INDICATOR_TOPIC_MAP = {
  'CO2-Konzentration': 'co2',
  'Temperaturanomalie': 'temperature',
  'Erneuerbare Energien': 'renewables',
  'Waldfläche': 'forests',
  'Artenvielfalt': 'biodiversity',
  'Lebenserwartung': 'health',
  'Kindersterblichkeit': 'health',
  'Alphabetisierung': 'internet',
  'Internet-Zugang': 'internet',
  'Extreme Armut': 'poverty',
  'Ungleichheit (Gini)': 'inequality',
  'Demokratie-Index': 'freedom',
  'Konflikte': 'conflicts',
  'Hunger': 'hunger',
  'Sauberes Wasser': 'health',
  'Strom-Zugang': 'renewables',
  'Mobilfunk': 'internet',
  'Wissenschaftl. Publikationen': 'science',
  'BIP pro Kopf': 'currencies',
  'Arbeitslosigkeit': 'poverty',
};
```

### Tooltip Positioning (Inside Element)

```css
/* Position tooltip inside bottom-right to avoid overflow clipping */
.detail-link::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 3px 8px;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
  z-index: 10;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wrap in `<a>` tags | data attributes + event delegation | Standard since 2020+ | Cleaner separation, no DOM restructuring |
| JS tooltips (Tippy.js, etc.) | CSS `::after` with `attr()` | Always available | Zero dependencies, no JS overhead |
| Per-element event listeners | Event delegation on parent | Standard practice | Better memory, works with dynamic DOM |

**Deprecated/outdated:**
- None relevant. The patterns used here are stable web platform features.

## Open Questions

1. **Sub-score category links (environment/society/economy/progress)**
   - What we know: These 4 sub-scores in Act 1 represent aggregate categories with no single detail topic.
   - What's unclear: Should they scroll to the corresponding section on the main page, or link to no detail page?
   - Recommendation: Make them scroll to the corresponding section (e.g., clicking "Umwelt" scrolls to `#akt-environment`). The momentum sub-score should link to `detail/?topic=momentum_detail`. Implementation: use `data-scroll-to` attribute instead of `data-topic` for the 4 category sub-scores.

2. **Economy cards without detail pages (GDP, inflation, unemployment, trade, regional GDP)**
   - What we know: 6 economy cards have no corresponding detail topic module.
   - What's unclear: Should they be clickable at all?
   - Recommendation: Skip clickability for these cards. Only make cards with a matching detail topic clickable. This avoids dead links and user confusion.

3. **Infrastructure card in society section**
   - What we know: Shows electricity/water/education access percentages, no dedicated detail page.
   - What's unclear: Best link target.
   - Recommendation: Skip clickability. No natural detail page match.

4. **News/sentiment/volcanic widgets**
   - What we know: Global news, sentiment analysis, and volcanic activity widgets have no detail pages.
   - What's unclear: Whether to make them clickable.
   - Recommendation: Skip. Only widgets with matching detail pages get `.detail-link`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework in project) |
| Config file | none |
| Quick run command | Open index.html in browser, click each data tile |
| Full suite command | Manual walkthrough of all 13 sections |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAIN-01 | Clicking any data tile navigates to detail/?topic={id} | manual | Open index.html, click each mapped tile, verify URL | N/A |
| MAIN-02 | Hover shows brightness, glow, cursor, tooltip | manual | Hover over each tile, verify visual effects | N/A |

### Sampling Rate
- **Per task commit:** Manual spot-check 3-5 tiles per act
- **Per wave merge:** Full walkthrough all acts, all clickable elements
- **Phase gate:** Every mapped element verified clickable, hover effects visible, tooltip shows in both DE and EN

### Wave 0 Gaps
None -- this phase modifies existing files only, no test infrastructure needed.

## Sources

### Primary (HIGH confidence)
- index.html -- Full HTML structure examined (lines 1-1000+)
- js/app.js -- All section builders, momentum, realtime, scroll engine registration examined
- js/scroll-engine.js -- IntersectionObserver and section progress system examined
- css/components.css -- data-card, widget, sub-score hover styles examined
- css/sections.css -- bento-grid, momentum-item, comparison-item, warming-stripes styles examined
- css/core.css -- CSS custom properties, transitions, reduced motion examined
- css/animations.css -- reveal animations, scroll-triggered effects examined
- js/i18n.js -- Translation system and existing key patterns examined
- detail/topics/ -- All 24 topic modules confirmed present

### Secondary (MEDIUM confidence)
- CSS `::after` tooltip pattern -- Standard CSS technique, well-documented in MDN
- Event delegation pattern -- Standard DOM pattern, used elsewhere in project (crisis map layer buttons)
- `filter: brightness()` for hover -- Well-supported CSS property (caniuse 98%+)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all vanilla JS/CSS, no new dependencies, existing project patterns
- Architecture: HIGH -- full DOM inventory completed from source code analysis, every element mapped
- Pitfalls: HIGH -- identified from actual code analysis (overflow:hidden, dynamic DOM, language toggle)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- no external dependencies or version concerns)
