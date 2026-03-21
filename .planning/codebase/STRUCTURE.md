# Codebase Structure

**Analysis Date:** 2026-03-21

## Directory Layout

```
World_report-MASTER/
├── index.html                 # Main entry point (13 semantic sections)
├── manifest.json              # PWA manifest
├── service-worker.js          # Offline support registration
├── package.json               # Node dependencies (rss-parser, xml2js)
├── package-lock.json          # Dependency lock
│
├── js/                        # Browser-side application (ES6 modules)
│   ├── app.js                 # Main controller (BelkisOne class) — orchestrates init
│   ├── data-loader.js         # Fetch + localStorage cache manager
│   ├── scroll-engine.js       # IntersectionObserver + RAF viewport tracking
│   ├── i18n.js                # i18n system (DE/EN translations, 800 lines)
│   │
│   ├── utils/
│   │   ├── math.js            # 30+ utilities (clamp, lerp, easing, color conversion, normalization)
│   │   └── dom.js             # DOM helpers (create, query, classList, scrollTo)
│   │
│   └── visualizations/
│       ├── charts.js          # SVG charts (warming stripes, line, gauges, inequity bars)
│       ├── maps.js            # Geospatial visualizations (5 interactive map layers)
│       ├── particles.js       # Canvas particle system (background animation)
│       ├── counters.js        # Animated number counters + typewriter effect
│       ├── cinematic.js       # Scroll-driven effects (parallax, rotation, scale)
│       └── world-indicator.js # Main gauge slider (world index 0-100)
│
├── css/                       # Stylesheets (modular BEM approach)
│   ├── core.css               # Global variables, resets, typography
│   ├── components.css         # Reusable UI components (buttons, badges, spinners)
│   ├── sections.css           # Section-specific layouts (13 acts + prolog/epilog)
│   └── animations.css         # Keyframes and transition definitions
│
├── scripts/                   # Node.js data pipeline (runs via GitHub Actions)
│   ├── collect-data.js        # Fetches 40+ public APIs → data/raw/{category}/
│   ├── process-data.js        # Transform raw → normalized scores → world-state.json
│   ├── self-heal.js           # Data validation & auto-repair from backup
│   └── generate-readme.js     # Generate README.md with live data snapshots
│
├── data/
│   ├── raw/                   # Raw API responses (by category: environment/, society/, etc.)
│   │   └── {category}/
│   │       ├── temperature.json
│   │       ├── co2.json
│   │       ├── gdp.json
│   │       ├── gini.json
│   │       └── ... (40+ total files)
│   │
│   └── processed/
│       ├── world-state.json       # MAIN DATA FILE — consumed by browser (all indicators + world index)
│       ├── world-state.backup.json # Auto-backup for recovery
│       └── heal-log.json          # Self-heal operation log
│
├── assets/
│   ├── icon/                  # App icons (PWA, favicon)
│   └── maps/                  # Map data files (SVG, GeoJSON)
│
├── .github/
│   └── workflows/
│       └── (auto-run GitHub Actions for 6h collection cycle)
│
├── .planning/                 # GSD planning documents (this agent's output)
│   └── codebase/
│       ├── ARCHITECTURE.md    # System design and data flow
│       └── STRUCTURE.md       # This file
│
└── README.md                  # Auto-generated project documentation
```

## Directory Purposes

**Root:**
- Purpose: Entry point and configuration
- Contains: HTML page, PWA config, Node.js package manifests, service worker
- Key files: `index.html` (main entry), `manifest.json` (PWA), `package.json` (dependencies)

**js/ (Browser Application):**
- Purpose: ES6 modular frontend code
- Contains: Main app controller, data loader, scroll tracking, visualization components, utilities
- Key files: `app.js` (1355 lines, main orchestrator), visualizations/* (6 visualization modules)

**js/utils/ (Shared Utilities):**
- Purpose: Reusable algorithms and DOM helpers
- Contains: Math operations (easing, color conversion, normalization), DOM manipulation helpers
- Key files: `math.js` (188 lines), `dom.js` (192 lines)

**js/visualizations/ (Graphics Rendering):**
- Purpose: Self-contained visualization modules
- Contains: Charts, maps, particles, counters, indicators — each as static method factories
- Key files: `charts.js` (440 lines), `maps.js` (612 lines), `particles.js` (269 lines)

**css/ (Styles):**
- Purpose: Modular CSS organized by layer (core, components, sections, animations)
- Contains: CSS Variables (custom properties), BEM naming convention, mobile-first responsive design
- Key files: `core.css` (6.6K), `sections.css` (26K), `components.css` (28K), `animations.css` (8.5K)

**scripts/ (Node.js Pipeline):**
- Purpose: Automated data collection, transformation, and validation
- Contains: HTTP fetchers with retry logic, data normalizers, score calculators, validators
- Key files: `collect-data.js` (fetches 40+ APIs), `process-data.js` (normalizes + scores)

**data/raw/ (Raw Data):**
- Purpose: Storage for unprocessed API responses
- Contains: JSON files organized by category (environment, society, economy, progress, realtime)
- Retention: Latest snapshot per category (not a history)
- Generated: Yes (by collect-data.js)

**data/processed/ (Processed Data):**
- Purpose: Single authoritative data source for browser
- Contains: `world-state.json` (all indicators, sub-scores, world index), backup, heal log
- Retention: Persistent (used by browser)
- Generated: Yes (by process-data.js, self-heal.js)

**assets/ (Static Resources):**
- Purpose: Images, icons, map data
- Contains: App icons (192x192, 512x512 for PWA), SVG/GeoJSON map layers
- Generated: No (manually added)

## Key File Locations

**Entry Points:**
- `index.html`: HTML structure, CSS imports, module script loader
- `js/app.js`: Main app instantiation and initialization
- `scripts/collect-data.js`: Data pipeline trigger (via GitHub Actions)
- `scripts/process-data.js`: Data processing step (runs after collect-data.js)

**Configuration:**
- `package.json`: Node.js dependencies, npm scripts
- `manifest.json`: PWA configuration (name, icons, start_url, display mode)
- `css/core.css`: CSS custom properties (colors, spacing, fonts, layout)

**Core Logic:**
- `js/scroll-engine.js`: Viewport tracking, section visibility, progress calculation
- `js/data-loader.js`: Fetch + cache strategy (fresh → localStorage → stale → error)
- `scripts/process-data.js`: World index calculation, score normalization, carrying capacity checks
- `js/visualizations/charts.js`: SVG chart rendering (warming stripes, line, gauge, inequity)

**Testing:**
- No dedicated test directory — project uses manual testing + GitHub Actions CI

## Naming Conventions

**Files:**
- Camel case for JavaScript: `app.js`, `dataLoader.js`, `scrollEngine.js`
- Kebab case for CSS: `core.css`, `components.css`
- Camel case for directories: `js/`, `css/`, `utils/`, `visualizations/`

**Directories:**
- Plural for collections: `js/utils/`, `js/visualizations/`, `data/raw/`
- Category grouping: `data/raw/{environment,society,economy,progress,realtime}/`

**Classes:**
- PascalCase: `BelkisOne`, `ScrollEngine`, `DataLoader`, `Charts`, `Maps`, `ParticleSystem`

**Functions:**
- camelCase: `init()`, `register()`, `render()`, `update()`, `_setupObservers()` (private prefix `_`)

**Constants:**
- UPPER_SNAKE_CASE: `EXISTENCE_FLOOR`, `EXISTENCE_WARN`, `CASCADE_PAIRS`, `SPECTRUM`

**CSS Classes:**
- BEM convention: `block__element--modifier`
- Examples: `section__title`, `chart__container--active`, `loading-screen__progress`

**Data Properties:**
- camelCase: `worldIndex`, `subScores`, `environment`, `society`, `economy`, `progress`, `momentum`

## Where to Add New Code

**New Feature (Data Indicator):**
- Add collection logic to `scripts/collect-data.js` (fetch + save to `data/raw/{category}/`)
- Add processing logic to `scripts/process-data.js` (normalize, include in score calculation)
- Add visualization in `js/visualizations/{type}.js` or add to existing (e.g., new chart to `charts.js`)
- Add section to `index.html` with class `section` and `data-section="{id}"`
- Add CSS styles to `css/sections.css`
- Add i18n keys to `js/i18n.js` with pattern `act{N}.{key}`
- Register in `app.js` via `app.scrollEngine.register(sectionId, callback)`

**New Visualization Component:**
- Create `js/visualizations/{name}.js` as ES6 module
- Export class or static methods: `export class MyViz { static render(container, data) {...} }`
- Use `MathUtils` for math operations, `DOMUtils` for element creation
- Import in `js/app.js` and instantiate/call during init
- Wrap in try-catch and log errors with prefix `[ComponentName]`

**New Utility Function:**
- Add to `js/utils/math.js` if numeric/color/formatting related
- Add to `js/utils/dom.js` if DOM query/manipulation related
- Export as part of `MathUtils` or `DOMUtils` object
- Include JSDoc comment with parameter types and example usage

**New CSS Styles:**
- Component styles: Add to `css/components.css` (BEM format)
- Section styles: Add to `css/sections.css` (specific to section layout)
- Animations: Add keyframes to `css/animations.css`
- Global variables: Update `css/core.css` custom properties (colors, spacing)

**New Translation Keys:**
- Add to `js/i18n.js` in both `de:` and `en:` sections
- Use dot notation: `'act2.tempTitle'`, `'nav.prolog'`, `'js.loadError'`
- Use `{placeholder}` syntax for interpolation: `'nav.jumpTo': 'Zu {label} springen'`

**New API Data Source:**
- Create new fetch function in `scripts/collect-data.js`
- Add to `SOURCES` array with category, timeout, retry config
- Save to `data/raw/{category}/{filename}.json`
- Update `process-data.js` to read and normalize new data
- Add logging for success/failure

## Special Directories

**data/raw/:**
- Purpose: Ephemeral raw API responses
- Generated: Yes (by collect-data.js on every 6h cycle)
- Committed: No (not in git)
- Retention: Only latest snapshot per source needed

**data/processed/:**
- Purpose: Authoritative transformed data
- Generated: Yes (by process-data.js)
- Committed: Yes (served to browser)
- Retention: Persistent (used as input for self-heal.js)

**.planning/codebase/:**
- Purpose: GSD planning documents
- Generated: Yes (by this mapping agent)
- Committed: Yes (for team reference)
- Retention: Updated with each analysis

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by npm install)
- Committed: No (.gitignore excludes)
- Retention: Not needed in repo

## Import Patterns

**ES Module Imports (Frontend):**
```javascript
// Standard imports (from js/app.js)
import { ScrollEngine } from './scroll-engine.js';
import { DataLoader } from './data-loader.js';
import { Charts } from './visualizations/charts.js';
import { MathUtils } from './utils/math.js';
import { i18n } from './i18n.js';

// All paths relative to js/app.js location
// Using .js extension required (ES modules)
```

**Module Initialization Pattern:**
```javascript
// Classes: constructor + method calls
const dataLoader = new DataLoader();
const data = await dataLoader.load();

// Static utilities: call directly
const color = MathUtils.tempToColor(value);
MathUtils.clamp(value, min, max);

// Visualization factories: static methods
Charts.warmingStripes(container, data, progress);
Charts.lineChart(container, data, options);
```

