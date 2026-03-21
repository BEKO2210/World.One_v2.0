# Technology Stack

**Analysis Date:** 2026-03-21

## Languages

**Primary:**
- JavaScript (ES6 Modules) - Frontend application and data pipeline scripts
- HTML5 - Page markup and semantic structure
- CSS3 - Styling with animations and responsive design

## Runtime

**Environment:**
- Node.js - Server-side data collection and processing pipeline

**Package Manager:**
- npm (npm 3, lockfile v3)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vanilla JavaScript ES6 Modules - No framework dependency, component-based architecture
- HTML5 Canvas API - Particle system and visualization rendering (`js/visualizations/particles.js`)

**Data & State:**
- LocalStorage API - Client-side caching with 6-hour TTL for world state data

**Progressive Web App:**
- Service Worker API - Network-first for data, cache-first for assets
- Web Manifest - `manifest.json` with PWA configuration for standalone mode

## Key Dependencies

**Critical:**
- `rss-parser` (^3.13.0) - Parse RSS feeds from news sources (UN News, WHO, NASA, etc.)
  - Located: `node_modules/rss-parser/`
  - File: `scripts/collect-data.js` uses RSS feeds for news collection

- `xml2js` (^0.6.2) - Parse XML data from various sources (arXiv, GDELT)
  - Transitive dependency of rss-parser
  - Used for converting XML responses to JSON

**Supporting:**
- `entities` (^2.2.0) - HTML entity decoding in RSS parsing
- `sax` (>=0.6.0) - XML parsing library (dependency of xml2js)
- `xmlbuilder` (~11.0.0) - XML building (dependency of xml2js)

## Configuration

**Environment:**
- `package.json` defines execution scripts at `C:\Users\belki\Desktop\World_report-MASTER\package.json`
- No `.env` file required - all data sources are free public APIs (no credentials needed)
- Optional: `GITHUB_TOKEN` env var for GitHub API (higher rate limits) - `scripts/collect-data.js` line 465

**Build:**
- No build configuration detected (vanilla JS, no bundler)
- Scripts run directly with `node` command

**Service Worker:**
- `service-worker.js` at project root with cache strategy:
  - PRECACHE_ASSETS hardcoded list of 22 core files
  - Network-first for data paths: `/world-state.json`, `/manifest.json`, `/data/`
  - Cache-first for all other GET requests

## Platform Requirements

**Development:**
- Node.js (any recent version supporting ES6 Modules)
- npm for dependency management
- Bash/sh for running data collection scripts

**Production:**
- Modern web browser supporting:
  - ES6 Modules (import/export)
  - Service Workers
  - LocalStorage API
  - Canvas API
  - Web Workers
  - CSS Custom Properties
  - CSS Grid & Flexbox
- Static file hosting (no server-side runtime needed)

## Data Pipeline

**Collection & Processing:**
- `scripts/collect-data.js` - Runs 40+ data source fetches with retry logic:
  - HTTP fetch with 15-second timeout per request
  - 2 retry attempts with exponential backoff (1s, 2s)
  - Saves to `data/raw/[category]/` directory

- `scripts/process-data.js` - Transforms raw JSON into `data/processed/world-state.json`
- `scripts/self-heal.js` - Data validation and recovery mechanism
- `scripts/generate-readme.js` - Generates status markdown

**Script Execution:**
```bash
npm run collect      # Fetch from 40+ sources
npm run process      # Transform raw data
npm run pipeline     # Both: collect + process
```

## Browser APIs Used

**Critical:**
- fetch() API - All data loading and HTTP requests
- LocalStorage - Client-side caching mechanism
- Service Worker - Offline support and caching strategy
- Canvas - Particle system visualization
- Web Workers - Potential (not confirmed in current codebase)

**Optional:**
- Geolocation API - Not required (hardcoded city coordinates in weather)
- IndexedDB - Not used (LocalStorage sufficient)

---

*Stack analysis: 2026-03-21*
