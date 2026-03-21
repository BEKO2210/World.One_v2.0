/* ═══════════════════════════════════════════════════════════
   World.One 1.0 — Detail Page Application
   URL routing, dynamic topic loading, navigation, share,
   language toggle, time range selector, cleanup lifecycle
   ═══════════════════════════════════════════════════════════ */

import { i18n } from '../js/i18n.js';
import { DOMUtils } from '../js/utils/dom.js';
import { destroyAllCharts, ensureChartJs, createChart } from '../js/utils/chart-manager.js';

// ─── Module State ────────────────────────────────────────────

let _currentTopic = null;   // reference to loaded topic module for cleanup
let _toastTimeout = null;   // for toast overlap prevention

// ─── Topic Allowlist (DETAIL-02 security) ────────────────────

const VALID_TOPICS = [
  'co2', 'temperature', 'biodiversity', 'airquality', 'forests',
  'renewables', 'population', 'conflicts', 'health', 'freedom',
  'inequality', 'poverty', 'currencies', 'science', 'internet',
  'space', 'weather', 'earthquakes', 'solar', 'crypto_sentiment',
  'momentum_detail', 'hunger', 'disasters', 'ocean_temp',
  'ocean_ph', 'ocean_plastic', 'extinction', 'endangered', '_stub'
];

// ─── Init ────────────────────────────────────────────────────

async function init() {
  console.log('[DetailApp] Initializing');

  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const topic = params.get('topic');
  const lang = params.get('lang');

  // Apply language if provided
  if (lang === 'de' || lang === 'en') {
    i18n.lang = lang;
  }

  // Initialize i18n (apply translations to DOM)
  i18n.init();

  // Validate topic
  if (!topic || !VALID_TOPICS.includes(topic)) {
    renderErrorState('invalid-topic', topic);
    return;
  }

  // Load topic module
  await loadTopic(topic);

  // Setup UI controls
  setupNavControls();
  setupBackToTop();

  // Register cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
}

// ─── Topic Loading ───────────────────────────────────────────

async function loadTopic(topicId) {
  console.log('[DetailApp] Loading topic:', topicId);

  try {
    // Dynamic import of topic module
    const module = await import(`./topics/${topicId}.js`);

    // Validate contract
    if (typeof module.render !== 'function') {
      throw new Error(`Topic module "${topicId}" missing required export: render()`);
    }
    if (typeof module.cleanup !== 'function') {
      throw new Error(`Topic module "${topicId}" missing required export: cleanup()`);
    }

    _currentTopic = module;

    // Build blocks object from DOM IDs
    const blocks = {
      hero: document.getElementById('detail-hero'),
      chart: document.getElementById('detail-chart'),
      trend: document.getElementById('detail-trend'),
      tiles: document.getElementById('detail-tiles'),
      explanation: document.getElementById('detail-explanation'),
      comparison: document.getElementById('detail-comparison'),
      sources: document.getElementById('detail-sources'),
    };

    // Render topic content into blocks
    await module.render(blocks);

    // Remove skeleton loaders from all blocks
    document.querySelectorAll('.detail-block--skeleton').forEach(el => {
      el.classList.remove('detail-block--skeleton');
    });

    // Update breadcrumb with topic title
    const titleText = i18n.t(module.meta.titleKey);
    const breadcrumbEl = document.getElementById('detail-breadcrumb-topic');
    if (breadcrumbEl) {
      breadcrumbEl.textContent = titleText;
    }

    // Update page title
    document.title = `World.One - ${titleText}`;

    // Setup lazy chart loading if module provides configs
    setupLazyCharts(module.getChartConfigs());

    // Add time range selector to trend block
    setupTimeRange(document.getElementById('detail-trend'));

    console.log('[DetailApp] Topic loaded:', topicId);
  } catch (err) {
    console.error('[DetailApp] Failed to load topic:', err);
    renderErrorState('load-failed', topicId);
  }
}

// ─── Error State ─────────────────────────────────────────────

function renderErrorState(type, topicId) {
  // Hide main content
  const mainEl = document.getElementById('detail-main');
  if (mainEl) mainEl.hidden = true;

  // Show error section
  const errorEl = document.getElementById('detail-error');
  if (errorEl) errorEl.hidden = false;

  // Set error message based on type
  let message;
  if (type === 'invalid-topic') {
    message = i18n.t('detail.error.invalidTopic', { topic: topicId || '?' });
  } else {
    message = i18n.t('detail.error.loadFailed', { topic: topicId });
  }

  const messageEl = document.getElementById('detail-error-message');
  if (messageEl) messageEl.textContent = message;

  // Update page title
  document.title = `World.One - ${i18n.t('detail.error.title')}`;
}

// ─── Navigation Controls ─────────────────────────────────────

function setupNavControls() {
  // Share button
  const shareBtn = document.getElementById('detail-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: document.title,
        text: i18n.t('detail.shareText', {
          topic: i18n.t(_currentTopic?.meta?.titleKey || '')
        }),
        url: window.location.href,
      };

      // Try native share API first (mobile)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('[DetailApp] Share failed:', err);
          }
        }
      } else {
        // Clipboard fallback (desktop)
        try {
          await navigator.clipboard.writeText(window.location.href);
          showToast(i18n.t('detail.copied'));
        } catch (err) {
          console.warn('[DetailApp] Clipboard failed:', err);
        }
      }
    });
  }

  // Language toggle
  const langBtn = document.getElementById('detail-lang-toggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      i18n.toggle();

      // Update lang label (show the OTHER language as option)
      const langLabel = langBtn.querySelector('.detail-nav__lang-label');
      if (langLabel) {
        langLabel.textContent = i18n.lang === 'de' ? 'EN' : 'DE';
      }

      // Update breadcrumb and title if topic is loaded
      if (_currentTopic) {
        const titleText = i18n.t(_currentTopic.meta.titleKey);
        const breadcrumbEl = document.getElementById('detail-breadcrumb-topic');
        if (breadcrumbEl) breadcrumbEl.textContent = titleText;
        document.title = `World.One - ${titleText}`;
      }
    });
  }
}

// ─── Back To Top ─────────────────────────────────────────────

function setupBackToTop() {
  const btt = document.getElementById('detail-btt');
  if (!btt) return;

  // Throttled scroll handler
  const onScroll = DOMUtils.throttle(() => {
    if (window.scrollY > window.innerHeight) {
      btt.removeAttribute('hidden');
    } else {
      btt.setAttribute('hidden', '');
    }
  }, 200);

  window.addEventListener('scroll', onScroll);

  // Smooth scroll to top on click
  btt.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── Lazy Chart Loading ──────────────────────────────────────

function setupLazyCharts(chartConfigs) {
  if (!chartConfigs || chartConfigs.length === 0) return;

  for (const { canvasId, config, blockId } of chartConfigs) {
    const block = document.getElementById(blockId);
    if (!block) continue;

    DOMUtils.observe(block, (entry) => {
      if (entry.isIntersecting) {
        ensureChartJs().then(() => {
          createChart(canvasId, config);
        });
      }
    }, { threshold: 0.1, rootMargin: '200px' });
  }
}

// ─── Time Range Selector ─────────────────────────────────────

function setupTimeRange(trendBlock) {
  if (!trendBlock) return;

  const rangeKeys = ['1y', '5y', '20y', 'max'];

  // Build buttons
  const buttons = rangeKeys.map(key => {
    const isActive = key === 'max';
    return DOMUtils.create('button', {
      className: isActive
        ? 'time-range__btn time-range__btn--active'
        : 'time-range__btn',
      textContent: i18n.t(`detail.range.${key}`),
      'data-range': key,
      type: 'button',
    });
  });

  // Create container
  const container = DOMUtils.create('div', {
    className: 'time-range',
    role: 'group',
    'aria-label': i18n.t('detail.range.label'),
  }, buttons);

  // Click handler for toggle behavior
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.time-range__btn');
    if (!btn) return;

    // Remove active from current
    const current = container.querySelector('.time-range__btn--active');
    if (current) current.classList.remove('time-range__btn--active');

    // Add active to clicked
    btn.classList.add('time-range__btn--active');

    // Dispatch event for topic modules to listen to
    trendBlock.dispatchEvent(new CustomEvent('timerangechange', {
      detail: { range: btn.getAttribute('data-range') },
    }));
  });

  // Prepend to trend block
  trendBlock.insertBefore(container, trendBlock.firstChild);
}

// ─── Toast Notification ──────────────────────────────────────

function showToast(message) {
  const toast = document.getElementById('detail-toast');
  if (!toast) return;

  toast.textContent = message;
  toast.removeAttribute('hidden');

  // Clear existing timeout to prevent overlap
  if (_toastTimeout) clearTimeout(_toastTimeout);

  _toastTimeout = setTimeout(() => {
    toast.setAttribute('hidden', '');
  }, 2500);
}

// ─── Cleanup ─────────────────────────────────────────────────

function cleanup() {
  if (_currentTopic && typeof _currentTopic.cleanup === 'function') {
    _currentTopic.cleanup();
  }
  destroyAllCharts();
}

// ─── Self-Execute ────────────────────────────────────────────

init().catch(err => {
  console.error('[DetailApp] Init failed:', err);
  renderErrorState('load-failed', 'unknown');
});
