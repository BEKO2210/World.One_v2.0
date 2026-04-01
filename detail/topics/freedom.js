/* ===================================================================
   World.One 2.0 -- Freedom Topic Module (SOC-04)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Freedom House global score trend (cached freedom.json),
         Freedom House country scores (hardcoded ~60 countries),
         SVG choropleth with 3-color classification (free/partly/not free)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'freedom',
  titleKey: 'detail.freedom.title',
  category: 'society',
  icon: '',
  supportsTimeRange: true,
};

// --- Module State ------------------------------------------------------

let _trendChart = null;
let _chartData = null;
let _choroplethCleanup = null;

// --- Freedom House Country Scores (ISO-2 -> 0-100, ~60 countries) ------
// Source: Freedom House Freedom in the World 2025

const FREEDOM_COUNTRY_SCORES = {
  // Free (70-100)
  FI: 100, NO: 100, SE: 100, DK: 97, NZ: 99, CA: 98, AU: 95, DE: 94,
  UK: 93, FR: 90, JP: 96, KR: 83, US: 83, PT: 96, IE: 97, NL: 97,
  CH: 96, AT: 93, BE: 96, ES: 90, IT: 90, CZ: 91, PL: 82, TW: 94,
  CL: 93, UY: 97, CR: 91, GH: 80, SN: 71,
  // Partly Free (35-69)
  MX: 60, BR: 73, IN: 66, ID: 58, CO: 63, PH: 56, NG: 43, KE: 48,
  UA: 50, GE: 58, HU: 66, TN: 36, BD: 39, PK: 37, TH: 36,
  // Not Free (0-34)
  CN: 9, RU: 13, SA: 7, EG: 18, IR: 12, TR: 32, VN: 19, MM: 9,
  AF: 8, KP: 3, ER: 2, SY: 1, CU: 12, VE: 14, BY: 8, AZ: 7,
  TJ: 8, TM: 2, LA: 12, KH: 24, ET: 20, SD: 4, TD: 11, CD: 16,
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached freedom data
  const { data, tier, age } = await fetchTopicData('freedom');

  // Extract global_trend from cache data
  const globalTrend = data?.global_trend || [];
  const latestScore = globalTrend.length > 0
    ? globalTrend[globalTrend.length - 1].score
    : 42.3;

  // Store full trend data for time range filtering
  _chartData = globalTrend.length > 0 ? globalTrend : [
    { year: 2006, score: 47 }, { year: 2007, score: 46.8 }, { year: 2008, score: 46.5 },
    { year: 2009, score: 46.2 }, { year: 2010, score: 45.8 }, { year: 2011, score: 45.5 },
    { year: 2012, score: 45.2 }, { year: 2013, score: 44.8 }, { year: 2014, score: 44.5 },
    { year: 2015, score: 44.1 }, { year: 2016, score: 43.8 }, { year: 2017, score: 43.5 },
    { year: 2018, score: 43.2 }, { year: 2019, score: 43.0 }, { year: 2020, score: 42.8 },
    { year: 2021, score: 42.7 }, { year: 2022, score: 42.6 }, { year: 2023, score: 42.5 },
    { year: 2024, score: 42.4 }, { year: 2025, score: 42.3 },
  ];

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, latestScore, tier, age);

  // --- 3. Chart Block (18-year decline trend) ---
  await _renderTrend(blocks.chart);

  // --- 4. Trend Block (supplementary text) ---
  _renderTrendText(blocks.trend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block (Freedom Choropleth) ---
  await _renderMap(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, score, tier, age) {
  const badge = createTierBadge(tier, { age });
  const formatted = Number(score).toFixed(1);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'freedom-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        formatted,
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.freedom.heroUnit'),
        }),
      ]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-sm)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.freedom.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (18-Year Decline Trend) --------------------------------

async function _renderTrend(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.freedom.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'freedom-trend-chart' }),
      ]),
    ])
  );

  // Render chart directly for time range interactivity
  await ensureChartJs();
  _trendChart = _createTrendChart(_chartData);

  // Listen for time range changes
  chartEl.addEventListener('timerangechange', (e) => {
    const range = e.detail?.range;
    if (!range || !_trendChart || !_chartData) return;

    let filtered;
    const currentYear = new Date().getFullYear();

    if (range === '1y') {
      filtered = _chartData.filter(d => d.year >= currentYear - 1);
      if (filtered.length < 2) filtered = _chartData.slice(-2);
    } else if (range === '5y') {
      filtered = _chartData.filter(d => d.year >= currentYear - 5);
    } else if (range === '20y') {
      filtered = _chartData.filter(d => d.year >= currentYear - 20);
    } else {
      // 'max' or unknown
      filtered = _chartData;
    }

    _trendChart.data.labels = filtered.map(d => String(d.year));
    _trendChart.data.datasets[0].data = filtered.map(d => d.score);
    _trendChart.update('none');
  });
}

function _createTrendChart(trendData) {
  return createChart('freedom-trend-chart', {
    type: 'line',
    data: {
      labels: trendData.map(d => String(d.year)),
      datasets: [{
        label: i18n.t('detail.freedom.heroLabel'),
        data: trendData.map(d => d.score),
        borderColor: toRgba(CHART_COLORS.society),
        backgroundColor: toRgba(CHART_COLORS.society, 0.15),
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHitRadius: 8,
        pointBackgroundColor: toRgba(CHART_COLORS.society),
        borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10, maxRotation: 45 },
        },
        y: {
          min: 30,
          max: 55,
          title: {
            display: true,
            text: i18n.t('detail.freedom.heroUnit'),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${i18n.t('detail.freedom.heroLabel')}: ${item.parsed.y.toFixed(1)}`,
          },
        },
      },
    },
  });
}

// --- Trend Block (Supplementary Text) -----------------------------------

function _renderTrendText(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
      },
    }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '2rem',
          fontWeight: '700',
          color: toRgba(CHART_COLORS.society),
          marginBottom: 'var(--space-xs)',
        },
        textContent: '18',
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.freedom.trendDesc'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', margin: '0' },
      }),
    ])
  );
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl) {
  // Count from FREEDOM_COUNTRY_SCORES
  const entries = Object.values(FREEDOM_COUNTRY_SCORES);
  const freeCount = entries.filter(v => v >= 70).length;
  const partlyFreeCount = entries.filter(v => v >= 35 && v < 70).length;
  const notFreeCount = entries.filter(v => v < 35).length;

  const tileData = [
    {
      label: i18n.t('detail.freedom.tileFree'),
      value: String(freeCount),
      unit: i18n.t('detail.freedom.heroUnit'),
      accent: '#4caf50',
    },
    {
      label: i18n.t('detail.freedom.tilePartly'),
      value: String(partlyFreeCount),
      unit: i18n.t('detail.freedom.heroUnit'),
      accent: '#fbc02d',
    },
    {
      label: i18n.t('detail.freedom.tileNotFree'),
      value: String(notFreeCount),
      unit: i18n.t('detail.freedom.heroUnit'),
      accent: '#d32f2f',
    },
    {
      label: i18n.t('detail.freedom.tileDecline'),
      value: '18',
      unit: '2006-2025',
      accent: toRgba(CHART_COLORS.society),
    },
  ];

  const tiles = tileData.map(({ label, value, unit, accent }) =>
    DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        textAlign: 'center',
      },
    }, [
      DOMUtils.create('div', {
        textContent: label,
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' },
      }),
      DOMUtils.create('div', {
        textContent: value,
        style: {
          color: accent || 'var(--text-primary)',
          fontSize: '1.5rem',
          fontWeight: '600',
        },
      }),
      DOMUtils.create('div', {
        textContent: unit,
        style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' },
      }),
    ])
  );

  tilesEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.freedom.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block (Freedom Choropleth) --------------------------------

async function _renderMap(compEl) {
  function colorFn(score) {
    if (score >= 70) return '#4caf50';   // Free (green)
    if (score >= 35) return '#fbc02d';   // Partly Free (yellow)
    return '#d32f2f';                     // Not Free (red)
  }

  function tooltipFn(iso, val) {
    return `${iso}: ${val}/100`;
  }

  const legendItems = [
    { color: '#4caf50', label: i18n.t('detail.freedom.free') },
    { color: '#fbc02d', label: i18n.t('detail.freedom.partlyFree') },
    { color: '#d32f2f', label: i18n.t('detail.freedom.notFree') },
  ];

  const result = await renderChoropleth(compEl, {
    dataMap: FREEDOM_COUNTRY_SCORES,
    colorFn,
    tooltipFn,
    legendItems,
    title: i18n.t('detail.freedom.mapTitle'),
  });

  if (result && result.cleanup) {
    _choroplethCleanup = result.cleanup;
  }
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: 'Freedom House',
      url: 'https://freedomhouse.org/countries/freedom-world/scores',
    },
  ];

  const sourceItems = sources.map(({ label, url }) =>
    DOMUtils.create('li', {
      style: { marginBottom: '0.5rem' },
    }, [
      DOMUtils.create('a', {
        href: url,
        target: '_blank',
        rel: 'noopener',
        textContent: label,
        style: {
          color: toRgba(CHART_COLORS.society, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.society, 0.3),
        },
      }),
    ])
  );

  srcEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h3', {
        textContent: i18n.t('detail.sources'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('ul', {
        style: { paddingLeft: '1.25rem', margin: '0', listStyle: 'none' },
      }, sourceItems),
    ])
  );
}

// --- Chart Configs (lazy-loaded by detail-app.js) ----------------------

export function getChartConfigs() {
  // Trend chart rendered directly in render() for time range interactivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _trendChart = null;

  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  _chartData = null;
  console.log('[Freedom] cleanup()');
}
