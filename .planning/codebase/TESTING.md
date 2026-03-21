# Testing Patterns

**Analysis Date:** 2026-03-21

## Test Framework

**Status:** Not implemented

**Current State:**
- No test files detected in codebase (no `.test.js`, `.spec.js`, or `__tests__` directories)
- No test runner configured in `package.json`
- No testing dependencies in `package.json` (Jest, Vitest, Mocha, etc. absent)
- Code follows patterns that would support testing if a framework were added

**package.json Scripts:**
```json
{
  "scripts": {
    "collect": "node scripts/collect-data.js",
    "process": "node scripts/process-data.js",
    "pipeline": "node scripts/collect-data.js && node scripts/process-data.js"
  }
}
```

No test scripts defined.

## Testable Patterns

While no formal test framework exists, the code is structured to support testing:

### 1. Utility Functions - Easily Testable

**Location:** `js/utils/math.js` and `js/utils/dom.js`

Pure utility functions with no side effects:
```javascript
// All easily testable
clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
lerp(start, end, t) { return start + (end - start) * t; }
inverseLerp(start, end, value) { ... }
remap(value, inMin, inMax, outMin, outMax) { ... }
normalize(value, min, max) { ... }

// Easing functions
easing: {
  linear(t) { return t; },
  easeInQuad(t) { return t * t; },
  easeOutQuad(t) { return t * (2 - t); },
  // ... 20+ easing functions
}

// Color mapping
tempToColor(anomaly) { ... }  // Deterministic
getZone(score) { ... }         // Deterministic
geoToSVG(lat, lng, width, height) { ... }
```

These are prime candidates for unit testing - they have:
- Single responsibility
- No external dependencies
- Deterministic outputs
- Clear input/output contracts

### 2. Class-Based Modules - Integration Testable

**Location:** `js/data-loader.js`

Structure supports dependency injection and mocking:
```javascript
export class DataLoader {
  constructor(options = {}) {
    this.dataUrl = options.url || 'data/processed/world-state.json';
    this.cacheKey = options.cacheKey || 'world-one-data';
    // Config injectable - enables test fixtures
  }

  async load() { ... }
  _validate(data) { ... }        // Could be tested
  _getFromCache(ignoreExpiry = false) { ... }  // Could be tested
  getWorldIndex() { ... }        // Could be tested
}
```

Testable aspects:
- Validation logic: `_validate()` returns boolean
- Cache key derivation
- Data getter methods: `getWorldIndex()`, `getEnvironmentData()`, etc.
- State management: `this.loading`, `this.error`

### 3. Deterministic Data Processing - Pipeline Testable

**Location:** `scripts/process-data.js`

Complex business logic functions:
```javascript
// Pure functions suitable for unit testing
function clamp(v, min, max) { ... }
function normalize(value, worst, best) { ... }  // Scoring logic
function checkExistence(scores) { ... }         // Business logic check
function checkBalance(momentumIndicators) { ... }
```

These process data deterministically and could be extracted to pure modules for testing.

### 4. DOM Utilities - Mocking Friendly

**Location:** `js/utils/dom.js`

Most functions can be tested with DOM mocking:
```javascript
$(selector, parent = document) { ... }        // Selector testing
$$(selector, parent = document) { ... }       // Batch queries
create(tag, attrs = {}, children = []) { ... } // Element creation
createSVG(tag, attrs = {}) { ... }            // SVG element creation
throttle(fn, delay) { ... }                   // Function behavior
debounce(fn, delay) { ... }                   // Function behavior
scheduleRAF(fn) { ... }                       // RAF queue management
```

Could be tested with jsdom or DOM mocking library.

## Recommended Testing Approach

### Unit Tests for Pure Functions
**Files to test:**
- `js/utils/math.js` - All easing, calculation, and formatting functions
- `js/utils/dom.js` - Throttle, debounce, viewport calculations
- `scripts/process-data.js` - Data normalization and scoring logic

**Framework recommendation:** Vitest (ESM native, fast, Jest-compatible)

**Example test structure (if implemented):**
```javascript
// math.utils.test.js
import { describe, it, expect } from 'vitest';
import { MathUtils } from '../utils/math.js';

describe('MathUtils', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(MathUtils.clamp(5, 0, 10)).toBe(5);
      expect(MathUtils.clamp(-5, 0, 10)).toBe(0);
      expect(MathUtils.clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(MathUtils.lerp(0, 10, 0.5)).toBe(5);
      expect(MathUtils.lerp(0, 10, 0)).toBe(0);
      expect(MathUtils.lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('easing.easeOutCubic', () => {
    it('should ease out cubic', () => {
      const eased = MathUtils.easing.easeOutCubic(0.5);
      expect(eased).toBeGreaterThan(0.5);  // Eased values go higher than linear
    });
  });
});
```

### Integration Tests for Data Classes
**Files to test:**
- `js/data-loader.js` - Cache logic, validation, fallback behavior
- `js/scroll-engine.js` - Section registration, observer management

**Mock strategy:**
- Mock localStorage for DataLoader cache tests
- Mock IntersectionObserver for ScrollEngine tests
- Mock fetch with test fixtures

### E2E Tests (Browser-based)
- Would test full page interaction flow
- Not currently set up (no Playwright, Cypress, etc.)
- Should be added for critical user journeys

## Test Data & Fixtures

**Current locations:**
- `data/processed/world-state.json` - Processed data file (real)
- `data/history/snapshot-*.json` - Historical snapshots (real)
- `data/raw/` - Raw data files organized by category

**Fixture strategy if tests were added:**
- Create `tests/fixtures/` directory with minimal test data
- Use in-memory versions of cache data
- Mock API responses

Example fixture structure:
```
tests/
├── fixtures/
│   ├── world-state.minimal.json      # Smallest valid structure
│   ├── world-state.full.json         # Complete valid structure
│   └── invalid-structures/           # For validation testing
├── unit/
│   ├── math.utils.test.js
│   ├── dom.utils.test.js
│   └── data-processing.test.js
└── integration/
    ├── data-loader.test.js
    └── scroll-engine.test.js
```

## Current Quality Patterns

**Strengths:**
- Defensive error handling with fallbacks (try-catch-throw pattern)
- Data validation before use: `_validate()` checks structure
- Graceful degradation: Missing cache falls back to stale cache
- Network resilience: Retry logic with exponential backoff
- Silent failures on non-critical operations: Cache storage failures ignored
- Modular design with clear separation of concerns

**Testing Gaps:**
- No automated test coverage
- No validation of complex scoring algorithms
- No regression tests for data processing logic
- No behavioral tests for animation/scroll logic
- Browser compatibility testing missing

## Recommended Next Steps

1. **Add Vitest configuration:**
   ```bash
   npm install -D vitest @vitest/ui jsdom
   ```

2. **Create test structure:**
   - `tests/unit/` for pure function tests
   - `tests/integration/` for class-based tests
   - `tests/fixtures/` for test data

3. **Write tests starting with highest-value areas:**
   - Data validation logic (`_validate()`)
   - Score calculations (`normalize()`, `checkExistence()`)
   - Cache fallback behavior

4. **Add coverage reporting:**
   - Use Vitest's coverage flag
   - Aim for 80%+ coverage on utilities, 60%+ on integration code

5. **Add test commands to package.json:**
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

---

*Testing analysis: 2026-03-21*
