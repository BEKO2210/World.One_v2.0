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

  _chartJsLoading = _loadScript(
    'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js'
  ).catch(() => _loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js'
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
 * @returns {Promise<void>}
 */
function _loadScript(src) {
  console.log('[ChartManager] Loading:', src);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ─── Dark Theme Defaults ────────────────────────────────────

/**
 * Applies dark-theme global defaults to Chart.js.
 * MUST run after Chart.js loads and BEFORE any chart creation.
 * Values matched to existing CSS custom properties from core.css.
 */
function _applyDarkDefaults() {
  // Global colors
  Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';
  Chart.defaults.backgroundColor = 'rgba(255, 255, 255, 0.04)';

  // Font matching existing design system (--font-sans)
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  Chart.defaults.font.size = 12;

  // Responsive
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  // Tooltip -- glass-morphism style matching main page
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(18, 18, 26, 0.9)';
  Chart.defaults.plugins.tooltip.titleColor = '#f0f0f5';
  Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255, 255, 255, 0.7)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.08)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;

  // Legend
  Chart.defaults.plugins.legend.labels.color = 'rgba(255, 255, 255, 0.7)';

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
export const CHART_COLORS = {
  environment: { r: 0, g: 180, b: 216 },
  society: { r: 232, g: 168, b: 124 },
  economy: { r: 255, g: 215, b: 0 },
  progress: { r: 0, g: 255, b: 204 },
  realtime: { r: 255, g: 59, b: 48 },
  momentum: { r: 90, g: 200, b: 250 },
  crisis: { r: 255, g: 107, b: 107 },
};

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
