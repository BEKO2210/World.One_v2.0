# Coding Conventions

**Analysis Date:** 2026-03-21

## Naming Patterns

**Files:**
- kebab-case for multi-word files: `data-loader.js`, `scroll-engine.js`, `world-indicator.js`
- Single word files lowercase: `app.js`, `i18n.js`
- Utility modules grouped in subdirectories: `utils/dom.js`, `utils/math.js`, `visualizations/charts.js`

**Classes:**
- PascalCase for all class definitions: `DataLoader`, `ScrollEngine`, `Counter`, `CounterManager`, `ParticleSystem`
- Class is the standard export method: `export class Charts { ... }`

**Functions & Methods:**
- camelCase for method names: `load()`, `register()`, `startTime()`, `createElement()`, `smoothDamp()`
- Private methods prefixed with underscore: `_validate()`, `_getFromCache()`, `_saveToCache()`, `_onSectionProgress()`, `_updateLoading()`
- Static methods on classes: `Charts.warmingStripes()`, `Charts.lineChart()`
- Utility object methods: `DOMUtils.$()`, `MathUtils.clamp()`, `MathUtils.lerp()`

**Variables:**
- camelCase for all variable declarations: `scrollY`, `docHeight`, `viewportHeight`, `cacheKey`
- Constants in UPPER_SNAKE_CASE: `TIMEOUT`, `CURRENT_YEAR`, `EXISTENCE_FLOOR`, `CASCADE_PAIRS`
- Descriptive names for state: `this.loading`, `this.error`, `this._snapCache`, `this.activeSections`

**Types/Objects:**
- PascalCase for exported utility objects: `DOMUtils`, `MathUtils`, `i18n`
- camelCase for object properties within: `DOMUtils.throttle()`, `i18n.lang`
- Data structure properties follow domain language: `worldIndex`, `subScores`, `environment`, `society`, `economy`

## Code Style

**Formatting:**
- No automatic formatter detected (.prettierrc/eslint missing)
- Consistent 2-space indentation throughout
- Single quotes for strings: `const cacheKey = 'world-one-data'`
- Arrow functions preferred for callbacks: `(e) => { ... }`
- Ternary operators for simple conditionals
- No semicolons at end of lines in some files, present in others (inconsistent)

**Linting:**
- No linting config detected
- Practices suggest a relaxed style guide focused on readability

**Spacing & Formatting Details:**
- Decorative comment separators used throughout: `/* ═══════════════════════════════════════════════════════════ */`
- Comments used to section functionality within classes
- Section separators like `// ─── Create Element ───` organize methods
- Readable spacing around logical method groups

## Import Organization

**Order:**
1. Node.js built-in modules (fs, path): `import { writeFileSync, mkdirSync } from 'fs'`
2. Third-party dependencies: `import { RSSParser } from 'rss-parser'`
3. Local absolute imports: `import { DataLoader } from './data-loader.js'`
4. Relative imports with extensions: `import { i18n } from '../i18n.js'`

**Path Handling:**
- Relative paths always include `.js` extension: `'./data-loader.js'`, `'../utils/math.js'`
- Directory traversal with path module: `dirname(fileURLToPath(import.meta.url))`
- No path aliases configured (use of full relative paths)

**Import Patterns:**
- Named imports preferred: `import { DataLoader } from './data-loader.js'`
- Default exports for singleton instances: `export const i18n = new I18n()`
- Class exports: `export class BelkisOne { ... }`
- Utility object exports: `export const DOMUtils = { ... }`

## Error Handling

**Strategy:** Defensive try-catch blocks at functional boundaries with fallback logic

**Patterns:**

1. **Data Loading with Fallback** (`data-loader.js`):
```javascript
async load() {
  this.loading = true;
  this.error = null;
  try {
    const response = await fetch(this.dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const json = await response.json();
    if (!this._validate(json)) throw new Error('Invalid world-state.json structure');
    this.data = json;
    this._saveToCache(this.data);
    return this.data;
  } catch (err) {
    this.error = err;
    console.warn('[DataLoader] Fetch failed, trying cache fallback:', err.message);
    const cached = this._getFromCache();
    if (cached) { this.data = cached; return this.data; }
    const stale = this._getFromCache(true);
    if (stale) { this.data = stale; return this.data; }
    throw err;
  } finally {
    this.loading = false;
  }
}
```

2. **Graceful Degradation in Cache Operations**:
```javascript
_getFromCache(ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(this.cacheKey);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    const age = Date.now() - timestamp;
    if (!ignoreExpiry && age > this.cacheTTL) return null;
    return data;
  } catch {
    return null;  // Silent fail on any storage error
  }
}
```

3. **Batch Error Isolation** (`app.js`):
```javascript
try { this._populateProlog(data); } catch (e) { console.error('[BelkisOne] Prolog error:', e); }
try { this._populateEnvironmentValues(data); } catch (e) { console.error('[BelkisOne] Env values error:', e); }
```
One section failing doesn't stop others from loading.

4. **Network Retry** (`collect-data.js`):
```javascript
async function fetchJSON(url, options = {}) {
  const { retries = 2, timeout = TIMEOUT, headers = {} } = options;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}
```
Exponential backoff retry logic.

## Logging

**Framework:** Native `console` object

**Patterns:**
- Prefixed messages with module identifier: `'[DataLoader]'`, `'[BelkisOne]'`, `'[Timeline]'`
- Console.warn for recoverable issues: `console.warn('[DataLoader] Fetch failed, trying cache fallback:', err.message)`
- Console.error for errors with impact: `console.error('[BelkisOne] Init failed:', err)`
- Error includes error object for full context: `console.error('[BelkisOne] Prolog error:', e)`
- File operations log success: `console.log(\`  ✓ ${category}/${filename}\`)`
- File operations log failure: `console.error(\`  ✗ ${name}: ${err.message}\`)`

**Message Format:**
- Structured as: `[Module] Description: detail`
- Uses emoji for success/failure in CLI output: ✓ for success, ✗ for failure
- Actual error state stored on instance: `this.error = err` for query-able state

## Comments

**When to Comment:**
- Section dividers for method organization: `// ─── Create Element ───`
- Algorithm explanation (rare): Comments appear in mathematical functions for non-obvious logic
- Algorithm justification: `// Prevent overshooting` in `smoothDamp()`
- Data processing comments: Explain transformation steps in `process-data.js`
- Business logic context: "Carrying capacity principle" documented with comments
- Required structure notes: `// Invalid world-state.json structure`

**JSDoc/TSDoc:**
- Not observed in codebase
- Method parameters documented inline: `options = {}`
- Constructor properties documented within class body

## Function Design

**Size:**
- Methods typically 20-80 lines
- Longer methods (100-150 lines) break down visualization building
- Private utility methods kept concise (10-30 lines)

**Parameters:**
- Options objects for configuration: `constructor(options = {})`
- Destructured from options: `const { retries = 2, timeout = TIMEOUT, headers = {} } = options`
- Callback functions as parameters: `register(sectionId, callback)`

**Return Values:**
- Methods return `this` for chaining: `engine.register(id, fn).init()`
- Promise-based async methods: `async load() { ... }`
- Plain object returns: `{ x, y }` for coordinate data
- Null/undefined for missing data: `return null` when cache miss
- Throws on critical failures: `throw new Error('message')`

## Module Design

**Exports:**
- Single class export per file: `export class DataLoader { ... }`
- Singleton instance export: `export const i18n = new I18n()`
- Utility object export: `export const DOMUtils = { ... }`
- Static method pattern on utility classes: `Charts.warmingStripes()`

**Barrel Files:**
- Not used (no index.js files)
- Direct imports from specific modules: `import { DataLoader } from './data-loader.js'`

**Initialization Pattern:**
- Constructor accepts options object for setup: `new DataLoader({ url, cacheKey, cacheTTL })`
- Explicit init() call required to start: `engine.init()` / `this.particles.start()`
- Lazy initialization in some cases: `if (!this._snapCache) this._snapCache = new Map()`

---

*Convention analysis: 2026-03-21*
