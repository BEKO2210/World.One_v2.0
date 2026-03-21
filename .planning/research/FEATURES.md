# Feature Landscape: Detail/Drill-Down Pages

**Domain:** Data dashboard detail pages for global indicator exploration
**Researched:** 2026-03-21
**Context:** World.One -- a public, static-site global dashboard (1M+ visitors) expanding from scroll-driven overview to deep-dive detail pages for 26+ topics. Vanilla JS, Chart.js via CDN, GitHub Pages.

## Table Stakes

Features users expect from any data detail page. Missing = product feels broken or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Interactive chart tooltips** | Users hover/tap a data point and expect to see the exact value, date, and unit. Without tooltips, charts are decoration, not data. | Low | Chart.js provides this out of the box via its tooltip plugin. Configure: display mode "nearest", intersect false for line charts. Custom HTML tooltips for dark-theme styling. |
| **Responsive chart sizing** | Charts must render cleanly on 320px mobile through 2560px desktop. Non-responsive charts break layout on mobile immediately. | Low | Chart.js `responsive: true` + `maintainAspectRatio: false` with container height constraints. Already have responsive SVG patterns in existing charts.js. |
| **Data freshness badge** | Users seeing "live data" need to know whether it is truly live, cached, or fallback. Without this, trust erodes when stale data is presented as current. | Medium | Already planned: 3-tier badge system (LIVE green / Cache orange / Static gray). Render via utils/badge.js. Badge must show age ("2h ago", "Last updated: ..."). |
| **Back navigation** | Detail pages are drill-downs. Users must be able to return to the main dashboard instantly. Browser back button alone is insufficient for SPA-like routing. | Low | Fixed back button in top bar. Use `history.back()` with fallback to main page URL. Also: breadcrumb trail ("World.One > Environment > CO2"). |
| **Loading states (skeleton loaders)** | Charts take time to render (Chart.js initialization, data fetch, canvas paint). Blank space during load feels broken. | Medium | Skeleton screens matching chart dimensions with pulsing animation. Use the existing `reveal` CSS pattern. Show skeleton immediately, swap in chart when data + Chart.js are both ready. |
| **Error states with recovery** | API failures happen. A blank chart or JS error visible to 1M users is unacceptable. Every data component needs a graceful failure mode. | Medium | Three tiers: (1) show cached data with orange badge, (2) show static fallback with gray badge + "data unavailable" message, (3) show explanatory empty state with retry button. Never show nothing. |
| **Time axis labels** | Users must orient themselves temporally. Unlabeled x-axes on time series charts make data unreadable. | Low | Chart.js time scale with `luxon` or manual label arrays. Given no-dependency constraint, use pre-formatted label strings rather than adding a date library. |
| **Source attribution** | Data credibility depends on source visibility. "Source: NASA GISTEMP" under every chart is expected in serious data products. | Low | Already patterned in main page (`data-card__source`). Extend to detail pages: source name, link to original data, last-updated timestamp. |
| **Mobile touch interactions** | Pinch-zoom on charts, swipe between sections, tap-to-reveal tooltips. Mobile is likely 40-60% of traffic for a public dashboard. | Medium | Chart.js handles touch tooltips natively. Add `touch-action: pan-y` on chart containers. Disable chart zoom on mobile (too fiddly on small screens). |
| **Print-friendly layout** | Journalists, researchers, and educators want to print or PDF data pages. Without print CSS, dark backgrounds waste ink and text is invisible. | Medium | `@media print` stylesheet: white background, black text, hide particles/animations, force chart colors to print-safe palette, show URLs for links. Add print button in action bar. |
| **Keyboard navigation** | Accessibility requirement. Users must be able to tab through chart elements, read data via screen readers. | Medium | Chart.js has limited built-in keyboard support. Add: (1) `aria-label` on chart containers with data summary, (2) hidden data table as `sr-only` fallback, (3) tab stops on interactive elements. Extend existing ARIA patterns from main page. |
| **Semantic URL routing** | `detail/?topic=co2` must work when shared, bookmarked, or opened in new tab. URL must fully encode the page state. | Low | Already planned: `detail/index.html` with `?topic=` parameter. Also consider `?lang=de` to preserve language choice. Use `history.replaceState` for state changes without full reloads. |
| **Context explanation text** | Raw numbers mean nothing without context. "421 ppm" needs "highest in 800,000 years" next to it. Every metric needs a one-line human explanation. | Low | Already patterned as `data-card__explain` on main page. On detail pages, expand to 2-3 sentences plus a "Why this matters" section. Must be i18n'd (DE/EN). |
| **Consistent design language** | Detail pages must feel like the same product as the main page. Same glass-morphism, same color system, same typography. | Medium | Reuse `core.css` and `components.css`. Create `detail.css` that extends (never overrides) the design system. Same `--glass-bg`, `--text-primary`, `--font-mono` variables. |

## Differentiators

Features that elevate World.One detail pages beyond a standard dashboard. Not expected, but make users come back and share.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Shareable chart snapshots** | Users can share a specific chart state (topic, time range) via URL. Drives organic traffic and citations. For a site with 1M+ visitors, this is growth fuel. | Medium | Web Share API (already planned) with fallback to clipboard copy. Generate share URL with query params encoding current state: `?topic=co2&range=10y`. Add Open Graph meta tags dynamically per topic for rich social previews. |
| **Historical trend view with annotations** | Show key events on timeline (e.g., Paris Agreement, COVID lockdowns, volcanic eruptions) overlaid on data charts. Turns data into narrative. | High | Chart.js annotation plugin or manual overlay. Annotation data stored per topic in topic module. Render as vertical lines with labels. Events stored in i18n for DE/EN. This is what separates "data tool" from "data storytelling." |
| **Before/after comparison sliders** | "How does X look now vs. 10 years ago?" Slider or toggle that morphs the chart between two time periods. Memorable and shareable interaction. | High | Implement as two Chart.js instances with animated transition, or single chart with data swap animation. Chart.js `update()` with `transitions.active.animation.duration`. Scope to 3-4 topics first (temperature, forest cover, inequality). |
| **Country/region drill-down on maps** | Click a country on the SVG choropleth to see that country's data in the chart below. "How does Germany compare to global average?" | High | Extend existing `maps.js` SVG click handlers. On country click: filter chart data to that country, show comparison line. Requires per-country data availability -- feasible for some topics (CO2 emissions, renewables) but not all. |
| **Animated data transitions** | When switching time ranges or toggling data series, charts animate smoothly rather than jumping. Fluid motion reinforces premium feel. | Medium | Chart.js animation config: `transitions.active.animation.duration: 800, easing: 'easeOutQuart'`. Already using cubic-bezier easing throughout the existing CSS. Match existing `--ease-out-expo`. |
| **Data download (CSV/PNG)** | Let users export the underlying data as CSV or the chart as PNG image. Researchers and journalists need this. Positions World.One as a credible data source, not just a visualization. | Medium | Chart.js `toBase64Image()` for PNG export. CSV generation from the data arrays already in memory. Trigger via download button in chart action bar. Use existing emoji convention for button icons. |
| **Tipping points / threshold indicators** | Horizontal reference lines on charts showing critical thresholds (1.5C warming, 350 ppm CO2 "safe" level, poverty line). Makes abstract numbers concrete and alarming. | Medium | Chart.js annotation plugin or manual `afterDraw` hook. Draw dashed horizontal line with label. Per-topic threshold config in topic module. Powerful for environmental topics. |
| **Sparkline comparison rail** | A row of mini-sparklines at the top of a detail page showing related indicators. "CO2 is rising -- but so is renewable energy, and temperature anomaly is..." Contextualizes the single metric. | Medium | Reuse existing `Charts.sparkline()` from main page. Render 3-5 related topic sparklines in a horizontal strip. Each is clickable to navigate to that topic's detail page. Creates discovery path. |
| **Scroll-driven progressive reveal** | As user scrolls down the detail page, charts and context blocks animate into view progressively, matching the cinematic feel of the main page. | Low | Already built: `ScrollEngine`, `reveal` CSS class, `CinematicScroll`. Apply same `IntersectionObserver`-based reveal pattern to detail page sections. Lazy-load charts via `IntersectionObserver` (already planned). |
| **"Did you know?" contextual facts** | Short, striking facts near charts. "If CO2 were visible, you'd see a brown haze as thick as smog over every major city." Emotional engagement alongside data. | Low | i18n text blocks, no technical complexity. 2-3 facts per topic, randomized on load. Style as highlighted callout boxes using existing `data-card--featured` pattern. |
| **Automated trend narration** | Below each chart, a generated sentence: "CO2 has risen 2.4 ppm in the last year, continuing a 66-year upward trend." Turns data into language. | Medium | Compute from data: direction (up/down/stable), magnitude, duration of trend, comparison to historical average. Template-based sentence generation in JS. Must be i18n'd. No LLM needed -- pure math-to-text. |
| **Keyboard shortcut navigation** | `J/K` to move between charts, `T` to toggle time range, `Escape` to return to main page. Power user feature that signals polish. | Low | Global keyboard event listener on detail page. Map keys to actions. Show shortcut hints in a `?` help overlay. Minimal code, high perceived quality. |

## Anti-Features

Features to explicitly NOT build. Each has a clear rationale tied to project constraints.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User-customizable dashboards** | Requires user accounts, persistent state, complex layout engine. Violates "no authentication" and "static site" constraints. 10x complexity for a feature most visitors won't use. | Fixed, curated layouts per topic. The editorial curation IS the value -- not letting users rearrange widgets. |
| **Real-time streaming data (WebSocket)** | GitHub Pages cannot serve WebSocket connections. Would require a backend server, violating the "static site" constraint. Also: 1M users * persistent connections = infrastructure nightmare. | 6-hour cached data with freshness badges. "Near-real-time" via the badge system is honest and sufficient. For the few truly live APIs (earthquakes, ISS), use fetch polling on detail page load only. |
| **Complex chart library (D3.js)** | D3 is 250KB+, requires custom bindngs for every chart type, has a steep learning curve, and is already out-of-scope per PROJECT.md. Overkill when Chart.js covers 95% of needs. | Chart.js via CDN for detail pages. Existing custom SVG for the main page. Only consider D3 for a Sankey diagram; fallback to stacked bar chart if needed. |
| **Leaflet/Mapbox geographic maps** | Heavy libraries (300KB+), require tile servers or API keys, add external dependencies. Violates "no new dependencies" and existing SVG map infrastructure. | Extend existing `maps.js` SVG choropleths. They are lightweight, already working, and match the design system. For point data (earthquake epicenters, city locations), use SVG circle overlays on existing map paths. |
| **Multi-axis comparison builder** | "Plot CO2 against GDP against population" is an analyst tool, not a public dashboard feature. Complex to build correctly (dual y-axes, unit mismatches, correlation vs. causation). | Pre-built comparison views per topic where correlations are editorially meaningful. E.g., "CO2 vs. Temperature" is curated. Don't let users build arbitrary comparisons that could mislead. |
| **Comment/annotation by users** | Requires authentication, moderation, persistent storage, spam prevention. Fundamentally incompatible with static hosting. | Source links and "Share" button. Users discuss on social platforms, not on the dashboard itself. |
| **Embedded AI chat / "Ask about this data"** | Requires API keys, backend, costs per query, hallucination risk for a data-accuracy-focused product. Undermines the "no algorithms, no AI" philosophy stated in the project manifesto. | Automated trend narration (rule-based, not AI). "Why this matters" editorial text. The human curation is the point. |
| **Notification system** | Push notifications require a backend service, notification permission UX, and ongoing maintenance. Overkill for a dashboard that updates every 6 hours. | Users bookmark the page. PWA install provides basic "app" presence on home screen. |
| **Historical playback / time-travel slider** | "Slide to see the world in 2015" requires storing and serving full historical world-state snapshots at every timestamp. Storage and complexity explode. | Fixed time range selectors (1Y, 5Y, 10Y, All) that filter the single dataset. Historical snapshots exist in `data/history/` but are for pipeline debugging, not user-facing time travel. |
| **Custom chart theming by users** | Color pickers, font selectors, light mode toggle. Each adds UI complexity, testing surface, and state management for minimal benefit on a public dashboard. | One carefully designed dark theme. Consistent, branded, recognizable. Print stylesheet handles the "light mode" use case. |

## Feature Dependencies

```
Data freshness badge ─────────────────────────┐
                                                │
3-tier data fallback (live/cache/static) ───────┤
                                                ├── ALL detail page features depend on these
Skeleton loaders ──────────────────────────────┤
                                                │
Error states with recovery ────────────────────┘

URL parameter routing ──────────► Shareable chart snapshots
                                  (sharing requires stable URLs)

Chart.js integration ───────────► Interactive tooltips
                        │         Animated transitions
                        │         Data download (PNG export)
                        │         Threshold indicators
                        │         Historical annotations
                        │
                        └───────► Before/after comparison
                                  (requires Chart.js update API)

i18n system (DE/EN) ────────────► Context explanation text
                                  Automated trend narration
                                  Historical event annotations
                                  "Did you know?" facts

Existing maps.js ───────────────► Country/region drill-down
                                  (extends SVG click handlers)

Existing Charts.sparkline() ───► Sparkline comparison rail
                                  (reuses main page component)

ScrollEngine / reveal ─────────► Scroll-driven progressive reveal
                                  (already built, just apply to detail pages)

Print CSS ──────────────────────► Data download (CSV)
                                  (both serve "export data" use case)

Back navigation ────────────────► Keyboard shortcut navigation
                                  (Escape key needs same target)
```

## MVP Recommendation

### Phase 1: Foundation (must ship first)

Build the infrastructure that every detail page needs before any topic content:

1. **URL parameter routing** -- single `detail/index.html` with topic module loader
2. **3-tier data fallback** with **data freshness badges** -- the trust foundation
3. **Skeleton loaders** and **error states** -- never show blank screens
4. **Chart.js integration** with **interactive tooltips** and **responsive sizing**
5. **Back navigation** with breadcrumbs
6. **Source attribution** per chart
7. **Context explanation text** framework (i18n-ready)
8. **Consistent design language** via shared CSS
9. **Semantic URL routing** preserving `?topic=` and `?lang=`
10. **Print-friendly layout** via `@media print`

### Phase 2: First topics with differentiators

Ship 3-5 topics (co2, temperature, population as starters) with:

1. **Scroll-driven progressive reveal** -- reuse existing scroll engine
2. **Sparkline comparison rail** -- cross-topic context
3. **Animated data transitions** -- Chart.js animation config
4. **Tipping point threshold indicators** -- horizontal reference lines
5. **Shareable chart snapshots** via Web Share API
6. **Keyboard navigation** and **ARIA accessibility**

### Phase 3: Advanced interactions

After core topics prove the pattern works:

1. **Historical trend annotations** -- events overlaid on charts
2. **Country/region drill-down** on map topics
3. **Data download (CSV/PNG)** -- export capability
4. **Automated trend narration** -- rule-based data-to-text
5. **"Did you know?" contextual facts**
6. **Before/after comparison** -- for select topics

### Defer indefinitely

- User-customizable dashboards
- Real-time WebSocket streaming
- Comment/annotation system
- AI-powered features
- Historical playback slider
- Custom chart theming

**Rationale:** The dependency graph dictates this order. You cannot build shareable URLs without URL routing. You cannot render meaningful charts without the data fallback system. You cannot add annotations without Chart.js being integrated first. Phase 1 is pure infrastructure, Phase 2 proves it works with real content, Phase 3 adds polish and depth.

## Complexity Budget

Given the constraints (vanilla JS, no bundler, static hosting, 1M+ users), total feature scope should respect these reality checks:

| Constraint | Implication |
|-----------|-------------|
| No bundler | Each topic module must be self-contained. Shared utilities via ES6 imports. No tree-shaking means every import adds to load. |
| Chart.js via CDN (60KB) | Must defer-load. Do not block initial page render. Use IntersectionObserver to initialize charts only when scrolled into view. |
| 26+ topic pages | Topic module pattern must be templated. Each topic file should be < 200 lines (data config + chart config + text keys). |
| GitHub Pages | No server-side rendering. No dynamic meta tags without JS. Open Graph previews for social sharing need a workaround (pre-rendered HTML per topic or a meta tag injection script). |
| 1M+ visitors | Every feature must consider: What happens when 100K users hit this at once? Answer for static site: nothing, CDN handles it. But chart rendering is client-side, so respect low-end devices. |
| Mobile performance | Limit to 3-4 visible charts at any time. Lazy-load aggressively. Disable particle canvas on detail pages. Reduce animation complexity on mobile. |

## Sources

- Codebase analysis: `js/visualizations/charts.js` (existing SVG chart patterns, 440 lines)
- Codebase analysis: `js/data-loader.js` (existing cache/fallback pattern)
- Codebase analysis: `js/visualizations/maps.js` (SVG choropleth infrastructure)
- Codebase analysis: `css/components.css` (glass-morphism design system, data-card patterns)
- Codebase analysis: `css/core.css` (design tokens, typography, spacing system)
- Codebase analysis: `index.html` (ARIA patterns, section structure, existing chart containers)
- Codebase analysis: `service-worker.js` (caching strategy: network-first data, cache-first assets)
- PROJECT.md (all active requirements, constraints, key decisions)
- ARCHITECTURE.md (pipeline documentation, data source list)
- Chart.js documentation: tooltip plugin, animation config, responsive options, `toBase64Image()` export (MEDIUM confidence -- based on well-established Chart.js API patterns)
- Web Share API: `navigator.share()` with title, text, url parameters (HIGH confidence -- stable web standard)
- Dashboard UX patterns: Data freshness indicators, skeleton loading, error boundaries, progressive disclosure (MEDIUM confidence -- based on established UX patterns in analytics dashboards like Grafana, Datadog, Our World in Data)
