# Phase 2: Detail Page Shell - Research

**Researched:** 2026-03-21
**Domain:** Single-page routing, dynamic module loading, layout system, navigation/sharing, print CSS, lazy loading, i18n integration, error handling
**Confidence:** HIGH

## Summary

Phase 2 builds the complete detail page shell -- the structural foundation that all 28 topic pages will render into. This is a single HTML file (`detail/index.html`) that reads `?topic=X` from the URL, dynamically imports a topic module from `detail/topics/{topic}.js`, and renders its content into a fixed 7-block layout. The shell must handle loading states (skeleton loaders), error states (invalid/missing topics), navigation (back button, scroll-to-top), sharing (Web Share API with clipboard fallback), printing (light-background @media print), language switching (reusing existing i18n.js), and a time range selector for chart data.

The project is a vanilla JS ESM application with no framework or bundler, deployed on GitHub Pages. All new code must follow established patterns: BEM CSS naming, glass-morphism design with CSS variables from core.css, `DOMUtils.create()` for DOM construction, `i18n.t()` for translations, and `data-i18n` attributes for auto-translation. The detail page must import the Phase 1 utilities (`utils/data-loader.js`, `utils/badge.js`, `utils/chart-manager.js`) and the shared `i18n.js` singleton.

The most critical architectural decision is the topic module interface contract (DETAIL-03). Every topic module must export the same shape: `{ meta, render(), getChartConfigs(), cleanup() }`. This contract is what enables the shell to be topic-agnostic -- it loads any module, calls `render()` to fill the layout blocks, and calls `cleanup()` (which triggers `destroyAllCharts()`) on navigation away. Getting this interface right in Phase 2 prevents rework across all 28 topic implementations in Phases 4-10.

**Primary recommendation:** Build `detail/index.html` as a standalone HTML file that loads its own CSS (`css/detail.css`) and a single entry-point script (`detail/detail-app.js`). The entry script handles URL parsing, dynamic `import()`, layout rendering, and UI controls. A stub topic module (`detail/topics/_stub.js`) proves the contract works end-to-end before any real topic data exists.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETAIL-01 | Single detail/index.html with URL parameter routing (?topic=co2) | URLSearchParams API for query parsing, relative path resolution from detail/ subdirectory to root js/ and css/ files |
| DETAIL-02 | Dynamic topic module loader via import() from detail/topics/{topic}.js | Dynamic import() fully supported in all modern browsers, returns Promise for module namespace, path must be validated before import to prevent injection |
| DETAIL-03 | Topic module interface contract: { meta, render(), getChartConfigs(), cleanup() } | ES module named exports pattern, cleanup() must call destroyAllCharts() from chart-manager.js, render() receives DOM container references |
| DETAIL-04 | Base layout with 7 blocks: hero banner, primary chart, historical trend, context tiles, explanation, comparison, sources footer | CSS Grid/Flexbox layout with semantic section elements, each block has a skeleton loader state and a data-block attribute for topic modules to target |
| DETAIL-05 | Back navigation (fixed top-left), Back-to-Top button, breadcrumb trail | Fixed-position back arrow matching glass-morphism style, scroll-to-top appears after scrolling past first viewport, breadcrumb uses topic meta.title |
| DETAIL-06 | Web Share API integration with fallback to clipboard copy | navigator.share() requires HTTPS + user activation, feature-detect with navigator.canShare(), fallback to navigator.clipboard.writeText() with visual confirmation |
| DETAIL-07 | Print-optimized CSS (@media print: white bg, black text, no animations) | @media print block overriding dark theme, force white background, black text, hide navigation/interactive elements, use print-color-adjust: exact for charts |
| DETAIL-08 | Lazy-load charts via IntersectionObserver with CSS skeleton loaders | DOMUtils.observe() already wraps IntersectionObserver, skeleton uses CSS pulse animation on dark glass background, replaced with chart canvas when visible |
| DETAIL-09 | Error states with graceful degradation (never show blank space) | Three error types: invalid topic (no module), module load failure (network), render failure (runtime). Each gets a styled error card with back-navigation |
| DETAIL-10 | Full DE/EN i18n support using existing i18n.js system | Import shared i18n singleton, add detail.* translation keys to both DE/EN objects, use data-i18n attributes for DOM auto-translation, i18n.onChange() for dynamic updates |
| DETAIL-11 | Time range selector (1Y / 5Y / 20Y / Max) for historical trend charts | Button group component, emits custom event or calls topic module callback, topic module filters chart data by selected range |
| DETAIL-12 | Consistent design language matching main page (glass-morphism, CSS variables, BEM) | Reuse all CSS custom properties from core.css, glass-bg/glass-border variables, BEM naming (detail-page__block, detail-hero__value), same font stack and spacing scale |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ESM) | ES2022+ | All logic -- no framework | Project convention, GitHub Pages static deployment, no build step |
| Chart.js | 4.5.1 | Charts in detail pages | Already integrated via chart-manager.js in Phase 1, CDN-loaded |
| CSS Custom Properties | N/A | Design system tokens | Established in core.css, all components use var(--*) references |

### Supporting (Browser APIs -- no additional libraries)
| API | Purpose | When to Use |
|-----|---------|-------------|
| `URLSearchParams` | Parse ?topic=X and ?lang=de from URL | On page load in detail-app.js |
| `import()` | Dynamic topic module loading | After URL validation, before render |
| `IntersectionObserver` | Lazy-load chart sections | Via existing DOMUtils.observe() wrapper |
| `navigator.share()` | Native share dialog | On share button click, with feature detection |
| `navigator.clipboard.writeText()` | Clipboard fallback for sharing | When Web Share API unavailable |
| `history.back()` / `history.length` | Back navigation | On back button click |
| `window.scrollTo()` | Scroll-to-top | Via existing DOMUtils.scrollTo() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URLSearchParams routing | Hash-based routing (#topic=co2) | Hash routing avoids server config but URLSearchParams is cleaner, already decided in requirements |
| Custom skeleton CSS | skeleton-elements library | 3KB extra dep for something achievable in 20 lines of CSS -- don't add deps |
| Custom share UI | share-api-polyfill | Unnecessary complexity, clipboard fallback is simpler and sufficient |

**Installation:**
```bash
# No installation needed -- all browser-native APIs, no new dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
detail/
  index.html              # Single HTML shell (DETAIL-01)
  detail-app.js            # Entry point: URL routing, module loading, UI controls
  topics/
    _stub.js               # Stub topic module proving the contract (for Phase 2 testing)

css/
  detail.css               # Detail page styles (layout, skeleton, print, nav controls)

js/
  i18n.js                  # Existing -- add detail.* keys to both DE/EN
  utils/
    data-loader.js          # Existing Phase 1 -- used by topic modules
    badge.js                # Existing Phase 1 -- used by topic modules
    chart-manager.js        # Existing Phase 1 -- used by topic modules
    dom.js                  # Existing -- DOMUtils.create(), observe(), scrollTo()
```

### Pattern 1: URL Parameter Routing (DETAIL-01)
**What:** Parse `?topic=X` on page load, validate against allowed topic list, route to dynamic import or error state.
**When to use:** On every detail page load.
**Example:**
```javascript
// Source: MDN URLSearchParams + project convention
const params = new URLSearchParams(window.location.search);
const topic = params.get('topic');
const lang = params.get('lang');

// Validate topic against known list
const VALID_TOPICS = [
  'co2', 'temperature', 'biodiversity', 'airquality', 'forests',
  'renewables', 'population', 'conflicts', 'health', 'freedom',
  'inequality', 'poverty', 'currencies', 'science', 'internet',
  'space', 'weather', 'earthquakes', 'solar', 'crypto_sentiment',
  'momentum_detail', 'hunger', 'disasters', 'ocean_temp',
  'ocean_ph', 'ocean_plastic', 'extinction', 'endangered'
];

if (!topic || !VALID_TOPICS.includes(topic)) {
  renderErrorState('invalid-topic', topic);
  return;
}

// Set language if provided
if (lang && (lang === 'de' || lang === 'en')) {
  i18n.lang = lang;
}
```

### Pattern 2: Dynamic Module Loading (DETAIL-02, DETAIL-03)
**What:** Use `import()` to load topic module, validate its exports, call render().
**When to use:** After URL validation succeeds.
**Example:**
```javascript
// Source: MDN dynamic import(), project ESM convention
async function loadTopic(topicId) {
  showSkeletonLoaders();

  try {
    const module = await import(`./topics/${topicId}.js`);

    // Validate contract
    if (typeof module.render !== 'function') {
      throw new Error(`Topic module "${topicId}" missing render() export`);
    }
    if (typeof module.cleanup !== 'function') {
      throw new Error(`Topic module "${topicId}" missing cleanup() export`);
    }

    // Store reference for cleanup on navigation
    _currentTopic = module;

    // Render into layout blocks
    await module.render({
      hero: document.getElementById('detail-hero'),
      chart: document.getElementById('detail-chart'),
      trend: document.getElementById('detail-trend'),
      tiles: document.getElementById('detail-tiles'),
      explanation: document.getElementById('detail-explanation'),
      comparison: document.getElementById('detail-comparison'),
      sources: document.getElementById('detail-sources'),
    });

    hideSkeletonLoaders();
  } catch (err) {
    console.error(`[DetailApp] Failed to load topic "${topicId}":`, err);
    renderErrorState('load-failed', topicId);
  }
}
```

### Pattern 3: Topic Module Interface Contract (DETAIL-03)
**What:** Every topic module exports the same shape so the shell is topic-agnostic.
**When to use:** Every topic module in detail/topics/*.js.
**Example:**
```javascript
// detail/topics/_stub.js -- proof-of-concept stub
import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';

/** Topic metadata for breadcrumb, title, share text */
export const meta = {
  id: '_stub',
  titleKey: 'detail.stub.title',    // i18n key
  category: 'environment',           // for color theming
  icon: '',                           // topic icon (emoji or SVG)
};

/** Render topic content into layout block containers */
export async function render(blocks) {
  blocks.hero.innerHTML = '<h1>Stub Topic</h1><p>This is a placeholder.</p>';
  // ... fill other blocks
}

/** Return chart configurations for lazy-loading via IntersectionObserver */
export function getChartConfigs() {
  return [];
  // Real topics return: [{ canvasId, config, blockId }]
}

/** Cleanup: destroy charts, remove event listeners, cancel timers */
export function cleanup() {
  // destroyAllCharts() called by shell, but topic-specific cleanup here
}
```

### Pattern 4: Skeleton Loader with IntersectionObserver (DETAIL-08)
**What:** Each layout block starts with a CSS skeleton animation. When it enters the viewport, IntersectionObserver triggers chart/content loading.
**When to use:** For chart blocks and heavy content sections.
**Example:**
```javascript
// Source: existing DOMUtils.observe() pattern
function setupLazyCharts(chartConfigs) {
  for (const { canvasId, config, blockId } of chartConfigs) {
    const block = document.getElementById(blockId);
    if (!block) continue;

    DOMUtils.observe(block, (entry) => {
      if (entry.isIntersecting) {
        // Load chart when block enters viewport
        ensureChartJs().then(() => {
          createChart(canvasId, config);
          block.classList.remove('detail-block--skeleton');
          block.classList.add('detail-block--loaded');
        });
        // Unobserve after first trigger
        entry.target.__observer?.unobserve(entry.target);
      }
    }, { threshold: 0.1, rootMargin: '200px' });
  }
}
```

### Pattern 5: Web Share with Clipboard Fallback (DETAIL-06)
**What:** Share button uses Web Share API when available, falls back to clipboard copy.
**When to use:** On share button click.
**Example:**
```javascript
// Source: MDN navigator.share(), navigator.clipboard.writeText()
async function handleShare() {
  const shareData = {
    title: `World.One - ${i18n.t(meta.titleKey)}`,
    text: i18n.t('detail.shareText', { topic: i18n.t(meta.titleKey) }),
    url: window.location.href,
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Share] Failed:', err);
      }
    }
  } else {
    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(i18n.t('detail.copied'));
    } catch (err) {
      console.warn('[Share] Clipboard failed:', err);
    }
  }
}
```

### Pattern 6: Time Range Selector (DETAIL-11)
**What:** Button group for 1Y/5Y/20Y/Max that filters chart data ranges.
**When to use:** In the trend chart block, topic module responds to range changes.
**Example:**
```javascript
// Time range selector as reusable component
function createTimeRangeSelector(onChange) {
  const ranges = [
    { key: '1y', labelKey: 'detail.range.1y' },
    { key: '5y', labelKey: 'detail.range.5y' },
    { key: '20y', labelKey: 'detail.range.20y' },
    { key: 'max', labelKey: 'detail.range.max' },
  ];

  const container = DOMUtils.create('div', {
    className: 'time-range',
    role: 'group',
    'aria-label': i18n.t('detail.range.label'),
  });

  for (const range of ranges) {
    const btn = DOMUtils.create('button', {
      className: `time-range__btn ${range.key === 'max' ? 'time-range__btn--active' : ''}`,
      textContent: i18n.t(range.labelKey),
      'data-range': range.key,
    });
    btn.addEventListener('click', () => {
      container.querySelector('.time-range__btn--active')
        ?.classList.remove('time-range__btn--active');
      btn.classList.add('time-range__btn--active');
      onChange(range.key);
    });
    container.appendChild(btn);
  }

  return container;
}
```

### Anti-Patterns to Avoid
- **Building a SPA router:** This is NOT a single-page app. Each detail page load is a fresh HTML load. No pushState, no client-side routing beyond reading URL params.
- **Coupling shell to topic data:** The shell must NEVER know about CO2 ppm or temperature anomalies. It only knows about layout blocks and the module contract.
- **Importing topic modules eagerly:** Use `import()` dynamic -- never static `import` for topic modules. Only one topic loads per page view.
- **Skipping cleanup():** Every topic module MUST export cleanup(). The shell calls it on `beforeunload` or when switching topics. Without it, Chart.js instances leak canvas memory.
- **Hardcoding strings in HTML:** All user-visible text uses data-i18n attributes or i18n.t() calls. No bare German or English strings in HTML or JS.
- **Using innerHTML for user-provided content:** Topic IDs from URL params must be validated against the allowlist. Never interpolate user input into innerHTML or import paths without validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parameter parsing | Custom regex parser | `URLSearchParams` | Browser-native, handles encoding, edge cases |
| Scroll observation | Custom scroll listeners | `IntersectionObserver` via `DOMUtils.observe()` | Already wrapped in project, uses compositor thread |
| Smooth scrolling | Custom JS animation | `DOMUtils.scrollTo()` wrapping `window.scrollTo({ behavior: 'smooth' })` | Already in project, CSS `scroll-behavior: smooth` as baseline |
| i18n system | New translation system | Existing `i18n.js` singleton with `i18n.t()` and `data-i18n` | Already handles DE/EN, localStorage persistence, DOM auto-apply |
| Chart lifecycle | Manual Chart.js create/destroy | `ensureChartJs()`, `createChart()`, `destroyAllCharts()` from chart-manager.js | Phase 1 already built registry with leak prevention |
| Skeleton animation | JavaScript-driven loading states | Pure CSS @keyframes pulse on glass-bg elements | GPU-accelerated, no JS overhead, matches project aesthetic |

**Key insight:** Phase 1 already built the hard infrastructure (data fetching, chart lifecycle, badges, i18n). Phase 2 should reuse all of it. The only truly new code is the HTML shell, the layout CSS, the detail-app.js router/loader, and the print stylesheet.

## Common Pitfalls

### Pitfall 1: Relative Path Resolution from detail/index.html
**What goes wrong:** Imports like `import { i18n } from './js/i18n.js'` fail because the page is served from `detail/` not the root.
**Why it happens:** GitHub Pages serves `detail/index.html` from `/World_report/detail/`, so relative paths resolve relative to `/World_report/detail/`, not `/World_report/`.
**How to avoid:** Use `../js/i18n.js` (one level up) for all imports from the root `js/` directory. CSS links must also use `../css/core.css`. Alternatively, use a `<base>` tag, but that can cause other issues.
**Warning signs:** 404 errors in browser console for JS/CSS files on first load.

### Pitfall 2: Dynamic import() Path Injection
**What goes wrong:** An attacker crafts `?topic=../../js/app` to import arbitrary modules.
**Why it happens:** The topic parameter is user-controlled and interpolated into an import() path.
**How to avoid:** Validate topic against the VALID_TOPICS allowlist BEFORE constructing the import path. Never use `import(\`./topics/${rawUserInput}.js\`)` without prior validation.
**Warning signs:** Any import path containing `..` or `/` characters from user input.

### Pitfall 3: Chart.js Canvas Memory Leaks on Navigation
**What goes wrong:** Navigating between topics (or refreshing) leaves orphaned Chart.js instances consuming canvas memory.
**Why it happens:** Chart.js retains internal references to canvas elements. Without explicit destroy(), garbage collection cannot reclaim them.
**How to avoid:** The shell must call `_currentTopic.cleanup()` followed by `destroyAllCharts()` before loading a new topic. Add a `beforeunload` listener as a safety net.
**Warning signs:** Canvas elements accumulating in DevTools Elements panel, increasing memory in Performance tab.

### Pitfall 4: Web Share API Fails Silently on Desktop
**What goes wrong:** Share button does nothing on Firefox desktop or older browsers.
**Why it happens:** Web Share API support is inconsistent on desktop browsers. Firefox desktop does not support it.
**How to avoid:** Always check `navigator.share && navigator.canShare()` before attempting. The clipboard fallback must be the primary experience for desktop users. Show visual feedback (toast notification) on clipboard copy.
**Warning signs:** No error in console (the check prevents the call), but user sees no response -- need visible clipboard-copy confirmation.

### Pitfall 5: Skeleton Loaders Cause Layout Shift
**What goes wrong:** Content jumps when skeletons are replaced with actual content.
**Why it happens:** Skeleton elements have different heights than rendered content.
**How to avoid:** Set explicit `min-height` on each layout block. Use CSS `aspect-ratio` for chart containers. Skeletons should match the approximate dimensions of the final content.
**Warning signs:** CLS (Cumulative Layout Shift) visible during loading, content jumping as sections render.

### Pitfall 6: i18n Keys Not Applied on Dynamic Content
**What goes wrong:** Dynamically inserted elements with `data-i18n` attributes show German text even when English is selected.
**Why it happens:** `i18n._applyToDOM()` runs on language change but only queries existing DOM elements. Elements added after the last language change won't be translated.
**How to avoid:** After dynamically inserting content with `data-i18n` attributes, call `i18n._applyToDOM()` or use `i18n.t()` directly when building elements with `DOMUtils.create()`. For topic modules, prefer `i18n.t()` in JS over `data-i18n` in dynamically generated HTML.
**Warning signs:** Mixed language UI after switching languages.

### Pitfall 7: Print CSS Not Overriding Dark Theme Fully
**What goes wrong:** Print preview shows dark backgrounds, unreadable light text, or wasted ink.
**Why it happens:** CSS custom properties in :root still apply in print context unless explicitly overridden.
**How to avoid:** Override ALL relevant custom properties inside `@media print { :root { ... } }`. Force `--bg-primary: #fff`, `--text-primary: #000`, `--glass-bg: transparent`, etc. Hide fixed navigation, particles, animations.
**Warning signs:** Any element in print preview with dark background or light/invisible text.

## Code Examples

### detail/index.html Structure
```html
<!DOCTYPE html>
<html lang="de" data-lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0a0f">
  <title>World.One - Detail</title>

  <!-- Shared styles (path relative to detail/) -->
  <link rel="stylesheet" href="../css/core.css">
  <link rel="stylesheet" href="../css/components.css">
  <!-- Detail-specific styles -->
  <link rel="stylesheet" href="../css/detail.css">
</head>
<body>
  <!-- Fixed Navigation -->
  <nav class="detail-nav" aria-label="Detail Navigation">
    <a href="../index.html" class="detail-nav__back" aria-label="Back" data-i18n-aria="detail.back">
      <!-- SVG arrow icon -->
    </a>
    <div class="detail-nav__breadcrumb">
      <span data-i18n="detail.breadcrumb.home">World.One</span>
      <span class="detail-nav__separator">/</span>
      <span id="detail-breadcrumb-topic"></span>
    </div>
    <div class="detail-nav__actions">
      <button class="detail-nav__btn" id="detail-share" aria-label="Share" data-i18n-aria="detail.share">
        <!-- SVG share icon -->
      </button>
      <button class="detail-nav__btn detail-nav__btn--lang" id="detail-lang-toggle">
        <span class="detail-nav__lang-label">EN</span>
      </button>
    </div>
  </nav>

  <!-- Layout Blocks -->
  <main class="detail-page" id="detail-main">
    <section class="detail-block detail-block--skeleton" id="detail-hero"
             data-block="hero" aria-label="Hero"></section>
    <section class="detail-block detail-block--skeleton" id="detail-chart"
             data-block="chart" aria-label="Primary Chart"></section>
    <section class="detail-block detail-block--skeleton" id="detail-trend"
             data-block="trend" aria-label="Historical Trend"></section>
    <section class="detail-block detail-block--skeleton" id="detail-tiles"
             data-block="tiles" aria-label="Context Tiles"></section>
    <section class="detail-block detail-block--skeleton" id="detail-explanation"
             data-block="explanation" aria-label="Explanation"></section>
    <section class="detail-block detail-block--skeleton" id="detail-comparison"
             data-block="comparison" aria-label="Comparison"></section>
    <footer class="detail-block detail-block--skeleton" id="detail-sources"
             data-block="sources" aria-label="Sources"></footer>
  </main>

  <!-- Back to Top -->
  <button class="detail-btt" id="detail-btt" aria-label="Scroll to top"
          data-i18n-aria="detail.backToTop" hidden>
    <!-- SVG up arrow -->
  </button>

  <!-- Toast for clipboard feedback -->
  <div class="detail-toast" id="detail-toast" role="status" aria-live="polite" hidden></div>

  <!-- Error State (hidden by default) -->
  <div class="detail-error" id="detail-error" hidden>
    <div class="detail-error__card">
      <h2 class="detail-error__title" data-i18n="detail.error.title"></h2>
      <p class="detail-error__message" id="detail-error-message"></p>
      <a href="../index.html" class="detail-error__btn" data-i18n="detail.error.backHome"></a>
    </div>
  </div>

  <script type="module" src="./detail-app.js"></script>
</body>
</html>
```

### Skeleton Loader CSS
```css
/* Source: project glass-morphism + CSS pulse animation */
.detail-block--skeleton {
  position: relative;
  overflow: hidden;
  min-height: 200px;
}

.detail-block--skeleton::after {
  content: '';
  position: absolute;
  inset: var(--space-md);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.02) 25%,
    rgba(255, 255, 255, 0.06) 50%,
    rgba(255, 255, 255, 0.02) 75%
  );
  background-size: 200% 100%;
  border-radius: 12px;
  animation: skeletonShimmer 1.8s ease-in-out infinite;
}

@keyframes skeletonShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Hero block gets taller skeleton */
#detail-hero.detail-block--skeleton { min-height: 300px; }
/* Chart blocks get aspect-ratio skeleton */
#detail-chart.detail-block--skeleton,
#detail-trend.detail-block--skeleton { min-height: 400px; }
```

### Print Stylesheet
```css
/* Source: MDN @media print best practices */
@media print {
  :root {
    --bg-primary: #fff;
    --bg-secondary: #f5f5f5;
    --text-primary: #000;
    --text-secondary: #333;
    --text-muted: #666;
    --glass-bg: transparent;
    --glass-border: #ddd;
  }

  body {
    background: #fff;
    color: #000;
  }

  /* Hide interactive elements */
  .detail-nav,
  .detail-btt,
  .detail-toast,
  .detail-nav__actions,
  .time-range { display: none !important; }

  /* Remove animations */
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }

  /* Force chart backgrounds for readability */
  canvas { print-color-adjust: exact; -webkit-print-color-adjust: exact; }

  /* Page breaks */
  .detail-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 1rem; }
}
```

### Error State Rendering
```javascript
// Source: project DOMUtils pattern
function renderErrorState(type, topicId) {
  const main = document.getElementById('detail-main');
  const errorEl = document.getElementById('detail-error');

  main.hidden = true;
  errorEl.hidden = false;

  const messageEl = document.getElementById('detail-error-message');
  if (type === 'invalid-topic') {
    messageEl.textContent = i18n.t('detail.error.invalidTopic', { topic: topicId || '?' });
  } else {
    messageEl.textContent = i18n.t('detail.error.loadFailed', { topic: topicId });
  }

  // Update page title for clarity
  document.title = `World.One - ${i18n.t('detail.error.title')}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hash routing (#/topic/co2) | URLSearchParams (?topic=co2) | Broadly adopted since 2020 | Cleaner URLs, works with GitHub Pages without hash fragments |
| XMLHttpRequest for module loading | Dynamic import() | Supported since Chrome 63 / Firefox 67 / Safari 11.1 | Native module loading, tree-shaking friendly, Promise-based |
| Custom scroll listeners for lazy load | IntersectionObserver | IE dropped from support | GPU-threaded visibility checks, no jank |
| Copy-to-clipboard via document.execCommand | navigator.clipboard.writeText() | Clipboard API baseline since March 2020 | Async, secure-context-only, no hidden textarea hack |
| JS-driven loading spinners | CSS skeleton loaders with shimmer | Industry shift ~2020 | Better perceived performance, GPU-accelerated, no JS |

**Deprecated/outdated:**
- `document.execCommand('copy')` -- deprecated, use Clipboard API instead
- `navigator.share()` without `canShare()` check -- causes uncaught errors on unsupported browsers
- Scroll event listeners for lazy loading -- use IntersectionObserver instead

## Open Questions

1. **detail/ subdirectory on GitHub Pages**
   - What we know: GitHub Pages serves static files. `detail/index.html` is accessible at `/World_report/detail/` or `/World_report/detail/index.html`.
   - What's unclear: Whether `?topic=co2` query params are preserved correctly on GitHub Pages (they should be since it is client-side parsing, no server rewrite needed).
   - Recommendation: Test after deployment. Query parameters are client-side only -- GitHub Pages does not strip them.

2. **i18n.js singleton shared between main and detail pages**
   - What we know: `i18n.js` exports a singleton instance. It reads `localStorage('world-one-lang')` and applies to DOM.
   - What's unclear: Whether importing from `../js/i18n.js` in the detail page creates a fresh instance (it will, since it is a separate page load).
   - Recommendation: This is correct behavior. Each page load creates its own i18n instance, reads the same localStorage key, and applies consistently. Adding new keys to the shared translations object is the right approach.

3. **Chart.js canvas rendering in print**
   - What we know: Chart.js renders to `<canvas>` elements. Canvas content IS included in print by default in most browsers.
   - What's unclear: Whether dark-themed charts are readable on white print backgrounds.
   - Recommendation: Use `print-color-adjust: exact` on canvas elements. Chart.js charts render as raster on the canvas, so they will print as-is (dark background included). This is acceptable for now -- a future enhancement could re-render charts with light theme for print.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no test framework configured) |
| Config file | none -- see Wave 0 |
| Quick run command | Open `detail/index.html?topic=_stub` in browser |
| Full suite command | Manual: test all scenarios listed below |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DETAIL-01 | URL ?topic=co2 loads shell correctly | manual-smoke | Open `detail/?topic=_stub` in browser | N/A |
| DETAIL-02 | Dynamic import loads topic module | manual-smoke | Open `detail/?topic=_stub`, check console for render log | N/A |
| DETAIL-03 | Stub module exports meta/render/getChartConfigs/cleanup | manual-smoke | Check _stub.js loads without errors | N/A |
| DETAIL-04 | 7 layout blocks render in correct order | manual-visual | Inspect DOM for all 7 sections in order | N/A |
| DETAIL-05 | Back button, back-to-top, breadcrumb visible | manual-visual | Check fixed nav, scroll down to see BTT button | N/A |
| DETAIL-06 | Share button works (Web Share or clipboard) | manual-interaction | Click share on mobile (Web Share) and desktop (clipboard) | N/A |
| DETAIL-07 | Print preview shows white bg, black text | manual-interaction | Ctrl+P / Cmd+P, verify print preview | N/A |
| DETAIL-08 | Skeleton loaders visible during load | manual-visual | Throttle network in DevTools, observe shimmer effect | N/A |
| DETAIL-09 | Invalid topic shows error with back nav | manual-smoke | Open `detail/?topic=nonexistent` | N/A |
| DETAIL-10 | Language toggle translates all chrome | manual-interaction | Toggle DE/EN, verify all labels change | N/A |
| DETAIL-11 | Time range buttons render and respond | manual-interaction | Click 1Y/5Y/20Y/Max, verify active state changes | N/A |
| DETAIL-12 | Design matches main page (glass, variables) | manual-visual | Compare side-by-side with main page | N/A |

### Sampling Rate
- **Per task commit:** Open `detail/?topic=_stub` in browser, verify no console errors
- **Per wave merge:** Run through all 12 test scenarios above
- **Phase gate:** All 12 scenarios pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `detail/index.html` -- the HTML shell (does not exist yet)
- [ ] `detail/detail-app.js` -- entry point script (does not exist yet)
- [ ] `detail/topics/_stub.js` -- stub topic module (does not exist yet)
- [ ] `css/detail.css` -- detail page stylesheet (does not exist yet)
- [ ] New i18n keys in `js/i18n.js` for detail.* namespace

*(No automated test framework -- project uses manual browser testing. All Phase 2 requirements are verifiable through browser interaction.)*

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: [Navigator.share()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) -- API signature, security requirements, exceptions, browser support
- MDN Web Docs: [Navigator.clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard) -- Clipboard API, writeText(), secure context requirement
- MDN Web Docs: [Dynamic import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) -- ES module dynamic loading syntax
- MDN Web Docs: [Printing CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) -- @media print best practices
- Can I Use: [Web Share API](https://caniuse.com/web-share) -- browser support tables
- Can I Use: [Dynamic import()](https://caniuse.com/es6-module-dynamic-import) -- browser support tables
- Existing codebase: `js/i18n.js`, `js/utils/dom.js`, `js/utils/chart-manager.js`, `js/utils/data-loader.js`, `js/utils/badge.js`, `css/core.css`, `css/components.css`

### Secondary (MEDIUM confidence)
- [SitePoint: Printer-friendly pages with CSS](https://www.sitepoint.com/css-printer-friendly-pages/) -- print CSS strategy for dark sites
- [V8: Dynamic import()](https://v8.dev/features/dynamic-import) -- dynamic import implementation details

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all browser-native APIs, no new dependencies, verified via MDN
- Architecture: HIGH -- patterns derived directly from existing codebase conventions (DOMUtils, i18n, chart-manager)
- Pitfalls: HIGH -- identified from direct code analysis (relative paths, canvas leaks, i18n timing, print CSS overrides)
- Module contract: HIGH -- designed to match project's existing ESM export patterns

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable browser APIs, no moving targets)
