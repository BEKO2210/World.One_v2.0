# Phase 1: Data Layer & Utilities - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the shared infrastructure that all detail pages depend on: a 3-tier data fallback system (live API -> cached JSON -> static values), a visual badge renderer showing which tier served each data point, a static fallback values file, and Chart.js lifecycle management with CDN loading and instance cleanup. This phase produces utilities only -- no detail pages, no topics, no main page changes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User reviewed all gray areas and delegated all implementation choices. Claude has full flexibility on:

**Badge design & placement:**
- Rendering approach (small chip/pill next to data values recommended -- fits dashboard aesthetic)
- Badge states: LIVE (pulsing red dot + text), Cache (gray chip, orange if >24h stale), Static (gray chip with reference year)
- Badge should be a reusable DOM element factory via utils/badge.js
- Emoji-based status indicators per PROJECT.md constraint (no icon libraries)

**Static fallback scope:**
- Build scaffold with all 28 topic keys defined but populate fully only the Phase 4 topics (co2, temperature, earthquakes, population, conflicts) with real values
- Remaining topics get placeholder structure (null values) -- filled when each topic phase is built
- This prevents blocking Phase 1 on researching 200+ data points while ensuring the file schema is complete

**Chart.js dark theme:**
- Global defaults matching existing dark aesthetic (bg: transparent, grid: rgba(255,255,255,0.08), text: rgba(255,255,255,0.7))
- Primary palette derived from existing section colors in app.js (_sectionColors)
- Dark tooltips with glass-morphism feel matching main page
- All charts rendered on transparent canvas (page background shows through)

**Data-loader architecture:**
- New utils/data-loader.js as a standalone module (not extending existing DataLoader class)
- Existing DataLoader stays untouched for main page world-state.json
- New loader: fetchWithTimeout(url, 5000) -> data/cache/{topic}.json -> data/fallback/static-values.json
- Returns { data, tier: 'live'|'cache'|'static', age?: number } so badge renderer knows which tier served

**Chart.js CDN loading:**
- jsDelivr primary, cdnjs fallback via sequential script injection
- Deferred loading -- not on page load, triggered when first chart is needed
- Chart instance registry tracks all instances for mandatory destroy() on topic cleanup/navigation

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches. User trusts Claude's judgment on all implementation details for this infrastructure phase.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/utils/dom.js` (DOMUtils): create() for DOM element factory, observe() for IntersectionObserver -- badge rendering can use create(), lazy-load can use observe()
- `js/utils/math.js` (MathUtils): clamp(), lerp(), tempToColor() -- may be useful for threshold calculations
- `js/i18n.js`: Full DE/EN i18n system with dot-notation keys -- badge labels need i18n keys

### Established Patterns
- ES6 modules with named exports (no default exports)
- Class-based for stateful modules (DataLoader, ScrollEngine), static methods for pure utilities (Charts, MathUtils)
- Vanilla JS, no framework, no bundler -- direct browser ES module imports
- localStorage for client-side caching with TTL pattern (see DataLoader._getFromCache)
- CSS custom properties for theming (see DOMUtils.setCSSVar/getCSSVar)

### Integration Points
- `service-worker.js` line 7: DATA_PATHS already includes '/data/' -- new cache files at data/cache/*.json will be caught by network-first strategy
- `data/` directory: currently has history/ and processed/ subdirectories -- new cache/ and fallback/ directories needed
- Future detail/index.html will import from utils/data-loader.js and utils/badge.js

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 01-data-layer-utilities*
*Context gathered: 2026-03-21*
