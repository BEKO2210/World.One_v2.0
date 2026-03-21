# Architecture

**Analysis Date:** 2026-03-21

## Pattern Overview

**Overall:** Event-driven, multi-layered dashboard with automated data pipeline and scroll-triggered progressive visualization

**Key Characteristics:**
- Dual-system architecture: Node.js data pipeline + browser visualization engine
- Scroll-based state management using IntersectionObserver and requestAnimationFrame
- Real-time data aggregation from 40+ public APIs every 6 hours via GitHub Actions
- localStorage cache with fallback mechanism for offline resilience
- Progressive initialization with loading states
- ES6 modules throughout for clean separation of concerns

## Layers

**Data Pipeline Layer (Server/Node.js):**
- Purpose: Automated collection, transformation, and validation of global data
- Location: `scripts/collect-data.js`, `scripts/process-data.js`, `scripts/self-heal.js`
- Contains: HTTP fetchers with retry logic, data normalizers, score calculators, validation/repair
- Depends on: `rss-parser`, `xml2js`, Node.js fs/fetch APIs
- Used by: GitHub Actions (triggers every 6 hours) → writes to `data/processed/world-state.json`

**Data Access Layer (Browser):**
- Purpose: Load processed data with intelligent caching strategy
- Location: `js/data-loader.js`
- Contains: Fetch logic, localStorage persistence, TTL validation, cache fallback
- Depends on: Nothing (standalone ES module)
- Used by: Main app controller (`js/app.js`)

**Presentation Layer:**
- Purpose: Render UI sections and manage visual state
- Location: `index.html` (13 semantic sections), `css/` (4 stylesheets)
- Contains: Semantic HTML structure with ARIA labels, modular CSS with BEM convention
- Depends on: Data access layer, scroll engine, visualization components
- Used by: All JavaScript modules for DOM manipulation

**Scroll Engine (Browser - Navigation):**
- Purpose: Track section visibility and dispatch scroll-driven events
- Location: `js/scroll-engine.js`
- Contains: IntersectionObserver setup, viewport metrics, progress calculation, section state management
- Depends on: DOM utilities (`js/utils/dom.js`)
- Used by: App controller to trigger section-specific visualizations

**Visualization Components (Browser - Graphics):**
- Purpose: Render charts, maps, indicators, particles, animations
- Location: `js/visualizations/`
- Contains:
  - `world-indicator.js`: Main gauge slider (0-100 world index)
  - `charts.js`: SVG-based visualizations (warming stripes, line charts, gauges, inequity bars)
  - `maps.js`: Interactive geospatial layers (5 map types with hover/click interactivity)
  - `particles.js`: Canvas-based particle system (fixed background animation)
  - `counters.js`: Animated number counters with typewriter effect
  - `cinematic.js`: Scroll-driven transformation effects (parallax, rotation, scale)
- Depends on: Math utilities, DOM utilities, i18n system
- Used by: App controller during initialization and scroll callbacks

**Utility Layer (Browser):**
- Purpose: Reusable math operations, DOM helpers, text normalization, formatting
- Location: `js/utils/math.js`, `js/utils/dom.js`
- Contains: Easing functions, color conversions, temperature/scale normalization, element creation helpers
- Depends on: Nothing
- Used by: All visualization and app modules

**Internationalization (Browser):**
- Purpose: Text translation and i18n key management
- Location: `js/i18n.js`
- Contains: German/English translation dictionaries, language toggle logic
- Depends on: Nothing
- Used by: All components that output user-facing text via `i18n.t('key')`

## Data Flow

**6-Hour Automated Pipeline:**

1. GitHub Actions trigger
2. `scripts/collect-data.js` executes:
   - Fetches from 40+ sources (NASA, NOAA, World Bank, UNHCR, etc.)
   - Applies timeout + retry logic (15s timeout, 2 retries)
   - Saves raw responses to `data/raw/{category}/{filename}.json`
3. `scripts/process-data.js` executes:
   - Reads raw data from `data/raw/`
   - Applies normalization (0-100 scale per indicator)
   - Calculates 5 sub-scores: environment (25%), society (25%), economy (20%), progress (20%), momentum (10%)
   - Applies carrying capacity checks (existence, balance, cascading)
   - Computes world index via weighted formula
   - Writes `data/processed/world-state.json`
4. `scripts/self-heal.js` validates and repairs data (fills missing values from backup)
5. `scripts/generate-readme.js` updates README with live data
6. Git commit + GitHub Pages auto-deployment

**Browser Runtime Data Flow:**

1. Page loads → `index.html` initializes `js/app.js`
2. `BelkisOne` constructor instantiates 6 subsystems
3. `app.init()`:
   - Updates loading bar (10%)
   - `DataLoader.load()` fetches `data/processed/world-state.json`
   - Cache strategy: Fresh fetch → localStorage (6h TTL) → stale cache → error
   - Updates loading (40%)
   - Initializes `ParticleSystem` (background animation)
   - Updates loading (60%)
   - Initializes `ScrollEngine` (IntersectionObserver + RAF loop)
   - Initializes `CinematicScroll` (scroll-driven effects)
   - Initializes 6 visualization systems (`WorldIndicator`, `Charts`, `Maps`, `Counters`, etc.)
   - Prime initial render (synchronous, no animation)
   - Updates loading (90%)
   - Discovers and observes animated counters
   - Initialize navigation dots, interactions, top bar, Easter egg, timeline
   - Updates loading (100%)
4. Loading screen fades
5. User scrolls:
   - `ScrollEngine` fires visibility callbacks for each section
   - Section becomes active → CSS class added
   - Corresponding visualization update fires with scroll progress (0-1)
   - Animations trigger via CSS transitions + requestAnimationFrame loops

**State Management:**

- **Global state:** Held in `BelkisOne` instance (singleton pattern)
- **Section state:** Tracked in `ScrollEngine.sections` Map (visibility, progress, wasVisible)
- **Data state:** Cached in `DataLoader.data` (immutable read-only after load)
- **Component state:** Localized to each visualization class (counters, particles, charts)
- **Ephemeral state:** DOM state (CSS classes, inline styles) for visual feedback

## Key Abstractions

**BelkisOne (Main Controller):**
- Purpose: Single entry point orchestrating entire application
- Location: `js/app.js` (lines 17-41)
- Pattern: Singleton with lazy initialization
- Responsibilities: Bootstrap sequence, subsystem initialization, scroll event binding, interaction setup
- Example: `const app = new BelkisOne(); await app.init();`

**ScrollEngine (Viewport Observer):**
- Purpose: Centralized scroll and visibility tracking
- Location: `js/scroll-engine.js` (lines 9-40)
- Pattern: Observable registry with callback dispatch
- Responsibilities: Section registration, progress calculation, animation frame loop
- Example: `scrollEngine.register('akt-environment', (progress) => { updateCharts(progress); })`

**DataLoader (Cache Manager):**
- Purpose: Data fetching with intelligent fallback hierarchy
- Location: `js/data-loader.js` (lines 7-56)
- Pattern: Async factory with TTL-aware cache
- Responsibilities: HTTP fetch, localStorage persistence, expiry validation, error recovery
- Example: `const data = await loader.load(); // Auto-falls back to cache if needed`

**Visualization Classes (Charts, Maps, Particles, etc.):**
- Purpose: Encapsulate rendering logic for specific data types
- Pattern: Static method factories (not instantiated, called as `Charts.lineChart()`)
- Responsibilities: Data validation, SVG/Canvas generation, DOM insertion, update animations
- Example: `Charts.lineChart(container, data, { animate: true, progress: 0.5 })`

**MathUtils (Transformation Toolkit):**
- Purpose: Reusable algorithms for common numerical operations
- Location: `js/utils/math.js`
- Pattern: Object with static methods
- Functions: clamp, lerp, remap, normalize, easing (7+ functions), color conversion, temperature mapping
- Example: `const color = MathUtils.tempToColor(1.19); // Temperature → CSS color`

## Entry Points

**HTML Page:**
- Location: `index.html`
- Triggers: User loads page in browser
- Responsibilities: DOM structure, CSS imports, script module loading
- Init sequence: Deferred `<script type="module" src="js/app.js"></script>`

**Main Application (Browser):**
- Location: `js/app.js` (global scope initialization)
- Triggers: When ES module loads (automatically)
- Responsibilities: Creates `BelkisOne` instance and calls `app.init()`
- Bootstrap: `const app = new BelkisOne(); app.init().catch(err => {...})`

**Data Collection (Server):**
- Location: `scripts/collect-data.js`
- Triggers: GitHub Actions on 6-hour schedule
- Responsibilities: Fetch all 40+ APIs with retry, save to `data/raw/`
- Execution: `node scripts/collect-data.js`

**Data Processing (Server):**
- Location: `scripts/process-data.js`
- Triggers: After data collection
- Responsibilities: Transform raw → normalized, calculate world index, output `world-state.json`
- Execution: `node scripts/process-data.js`

## Error Handling

**Strategy:** Graceful degradation with user feedback and automatic fallbacks

**Patterns:**

**Data Fetch Errors:**
- Primary: Fetch with `cache: 'no-store'` for fresh data
- Fallback 1: Check localStorage for non-expired cache (6h TTL)
- Fallback 2: Use stale localStorage data (ignoreExpiry=true)
- Final: Throw error, display "Load Error" message to user, try again on reload
- Location: `js/data-loader.js` (lines 18-56)

**API Collection Errors:**
- Timeout: 15 seconds per request
- Retry: 2 automatic retries with exponential backoff (1s, 2s)
- Skip-on-failure: Missing data is logged but doesn't block pipeline
- Validation: `self-heal.js` fills missing values from backup
- Location: `scripts/collect-data.js` (lines 16-77)

**Visualization Errors:**
- Data validation before rendering: Check array length, non-null values
- Empty fallback: Skip rendering if data invalid
- Canvas/DOM errors: Wrapped in try-catch, logged to console
- Location: All `js/visualizations/*.js` files

**Initialization Errors:**
- Try-catch wrapper in `app.init()`
- Loading screen shows error message if caught
- Application remains usable (sections visible but static)
- Location: `js/app.js` (lines 81-87)

## Cross-Cutting Concerns

**Logging:**
- Approach: Browser console (`console.log`, `console.warn`, `console.error`)
- Conventions: Prefixed with module name `[BelkisOne]`, `[DataLoader]`, `[ScrollEngine]`
- Example: `console.warn('[DataLoader] Fetch failed, trying cache fallback:', err.message)`
- Location: Every major module

**Validation:**
- Data validation: `process-data.js` checks JSON structure, normalization bounds
- HTML validation: Sanitization for XSS via `escapeHTML()` before innerHTML
- Calculation validation: Guard checks for division by zero, empty arrays
- Location: Distributed across pipeline scripts and browser modules

**Authentication:**
- Approach: None required (public APIs only)
- GitHub Actions: Automatic (no secrets needed for public data)
- CORS: All APIs support cross-origin requests

**Performance:**
- Data caching: 6-hour localStorage TTL prevents redundant fetches
- Rendering optimization: requestAnimationFrame for smooth scrolling
- Lazy initialization: Visualizations only init when needed (on scroll)
- Canvas drawing: Single particle system instance, efficient update loop
- SVG rendering: Static generation (not animated frame-by-frame)

**Accessibility:**
- ARIA labels: `aria-label`, `aria-hidden` on all UI elements
- Semantic HTML: `<section>`, `<header>`, `<nav>` elements used properly
- Keyboard support: Tab navigation, focus management
- Reduced motion: Respects `prefers-reduced-motion` media query in scroll engine
- i18n: Full German/English translation support

