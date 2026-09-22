/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Chart Manager
   CDN loader, dark-theme defaults, color palette, instance registry
   ═══════════════════════════════════════════════════════════ */

// ─── CDN Loader State ───────────────────────────────────────

let _chartJsLoaded = false;
let _chartJsLoading = null;

/**
 * Ensures Chart.js is loaded and dark-theme defaults are applied.
 * Uses singleton promise pattern to prevent duplicate script injection.
 * Primary CDN: jsDelivr (4.5.1), Fallback: cdnjs (4.5.0).
 * @returns {Promise<void>}
 */
export function ensureChartJs() {
  if (_chartJsLoaded) return Promise.resolve();
  if (_chartJsLoading) return _chartJsLoading;

  // SRI: der Browser führt die Datei nur aus, wenn der Hash stimmt
  _chartJsLoading = _loadScript(
    'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
    'sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ'
  ).catch(() => _loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js',
    'sha384-XcdcwHqIPULERb2yDEM4R0XaQKU3YnDsrTmjACBZyfdVVqjh6xQ4/DCMd7XLcA6Y'
  )).then(() => {
    _chartJsLoaded = true;
    _applyDarkDefaults();
    console.log('[ChartManager] Chart.js loaded');
  }).catch((err) => {
    console.error('[ChartManager] Failed to load Chart.js from all CDNs');
    _chartJsLoading = null;
    throw err;
  });

  return _chartJsLoading;
}

/**
 * Injects a script tag and returns a promise that resolves on load.
 * @param {string} src - Script URL
 * @param {string} [integrity] - SRI-Hash (sha384-…)
 * @returns {Promise<void>}
 */
function _loadScript(src, integrity) {
  console.log('[ChartManager] Loading:', src);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
    }
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ─── Design-Token-Zugriff ───────────────────────────────────
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

// ─── CSS-Variablen in Chart-Konfigurationen ────────────────
// Canvas kennt kein var(--…). Dieses Plugin ersetzt vor jedem Update
// Farbwerte der Form 'var(--token)' durch den aktuellen Tokenwert, damit
// Topics überall Design-Tokens verwenden können (auch im Light Mode).
function _resolveVars(node, depth = 0) {
  if (depth > 6 || node == null) return node;
  if (typeof node === 'string') return node.startsWith('var(--') ? (cssVar(node.slice(4, -1).split(',')[0].trim()) || node) : node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = _resolveVars(node[i], depth + 1);
    return node;
  }
  if (typeof node === 'object' && !(node instanceof Node) && Object.getPrototypeOf(node) === Object.prototype) {
    for (const k of Object.keys(node)) {
      if (k === 'data' && depth > 0) continue; // Datenpunkte nicht anfassen
      node[k] = _resolveVars(node[k], depth + 1);
    }
  }
  return node;
}

const cssVarPlugin = {
  id: 'cssVars',
  beforeUpdate(chart) {
    (chart.config.data?.datasets || []).forEach(ds => _resolveVars(ds));
    _resolveVars(chart.config.options);
  },
};

// ─── Dark Theme Defaults ────────────────────────────────────

/**
 * Applies dark-theme global defaults to Chart.js.
 * MUST run after Chart.js loads and BEFORE any chart creation.
 * Values matched to existing CSS custom properties from core.css.
 */
function _applyDarkDefaults() {
  Chart.register(cssVarPlugin);

  // Farben aus den Design-Tokens (core.css), damit Charts dem Theme folgen
  Chart.defaults.color = cssVar('--text-2');
  Chart.defaults.borderColor = cssVar('--grid');
  Chart.defaults.backgroundColor = cssVar('--surface-2');

  Chart.defaults.font.family = cssVar('--font-sans') || 'system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  // Achsen/Tooltips im Zahlenformat der Seitensprache (1.234,5 bzw. 1,234.5)
  Chart.defaults.locale = document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE';
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 4;
  Chart.defaults.elements.bar.borderRadius = 4;

  // Responsive
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  // Tooltip -- glass-morphism style matching main page
  Chart.defaults.plugins.tooltip.backgroundColor = cssVar('--surface-3');
  Chart.defaults.plugins.tooltip.titleColor = cssVar('--text-1');
  Chart.defaults.plugins.tooltip.bodyColor = cssVar('--text-2');
  Chart.defaults.plugins.tooltip.borderColor = cssVar('--line-2');
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;

  // Legend
  Chart.defaults.plugins.legend.labels.color = cssVar('--text-2');
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;

  // Reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Chart.defaults.animation = false;
  }
}

// ─── Chart Color Palette ────────────────────────────────────

/**
 * Section color palette derived from app.js _sectionColors.
 * RGB components for use with toRgba() helper.
 */
// Themenfarben = Serien der validierten Datenpalette (css/core.css, --series-*).
// Getter lesen das aktive Theme; Rückgabe bleibt {r,g,b} für toRgba().
const SERIES_BY_TOPIC = {
  environment: '--series-3', society: '--series-2', economy: '--series-4',
  progress: '--series-7', realtime: '--series-1', momentum: '--series-1', crisis: '--series-8',
};
export const CHART_COLORS = Object.fromEntries(
  Object.entries(SERIES_BY_TOPIC).map(([k, v]) => [k, undefined])
);
for (const [topic, token] of Object.entries(SERIES_BY_TOPIC)) {
  Object.defineProperty(CHART_COLORS, topic, { enumerable: true, get: () => hexToRgb(cssVar(token)) });
}

/**
 * Converts an RGB color object to an rgba() CSS string.
 * @param {{ r: number, g: number, b: number }} color
 * @param {number} [alpha=1]
 * @returns {string}
 */
export function toRgba({ r, g, b }, alpha = 1) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Chart Instance Registry ────────────────────────────────

const _instances = new Map();

/**
 * Creates a Chart.js instance on the given canvas and tracks it in the registry.
 * Automatically destroys any existing chart on the same canvas first.
 *
 * IMPORTANT: The caller must await ensureChartJs() before calling createChart().
 * This function is synchronous and does NOT load Chart.js itself.
 *
 * @param {string} canvasId - The DOM id of the canvas element
 * @param {object} config - Chart.js configuration object
 * @returns {Chart|null} The created Chart instance, or null if canvas not found
 */
export function createChart(canvasId, config) {
  destroyChart(canvasId);

  const ctx = document.getElementById(canvasId);
  if (!ctx) {
    console.warn('[ChartManager] Canvas not found:', canvasId);
    return null;
  }

  const chart = new Chart(ctx, config);
  _instances.set(canvasId, chart);
  console.log('[ChartManager] Created chart:', canvasId);
  return chart;
}

/**
 * Destroys a chart instance by canvas ID and removes it from the registry.
 * @param {string} canvasId - The DOM id of the canvas element
 */
export function destroyChart(canvasId) {
  const existing = _instances.get(canvasId);
  if (existing) {
    existing.destroy();
    _instances.delete(canvasId);
    console.log('[ChartManager] Destroyed chart:', canvasId);
  }
}

/**
 * Destroys all tracked chart instances and clears the registry.
 * Call on page navigation or topic cleanup to prevent memory leaks.
 */
export function destroyAllCharts() {
  console.log('[ChartManager] Destroying all charts:', _instances.size, 'instances');
  for (const [id, chart] of _instances) {
    chart.destroy();
  }
  _instances.clear();
}
