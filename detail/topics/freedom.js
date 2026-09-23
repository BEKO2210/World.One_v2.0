/* ===================================================================
   World.One 2.0 -- Freedom Topic Module (SOC-04)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Freedom House status counts 1972+ and population share in free
         countries (freedom.json, via Our World in Data), FIW 2026 report
         figures (freedom.json → report),
         Freedom House status + score per country (freedom.json → countries),
         SVG choropleth with 3-color classification (free/partly/not free)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba, cssVar } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';
import { fmtNumber } from '../../js/utils/fmt.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'freedom',
  titleKey: 'detail.freedom.title',
  category: 'society',
  icon: '',
  supportsTimeRange: true,
};

// --- Module State ------------------------------------------------------

// Freedom in the World 2026: 20. Jahr in Folge (Berichtsjahr 2025)
let _declineYears = 20;
let _declineDataYear = 2025;

let _trendChart = null;
let _chartData = null;   // status_trend: Länder und Gebiete je Status und Jahr
let _report = null;      // Kennzahlen aus dem Jahresbericht (195 Staaten)
let _choroplethCleanup = null;

// Karte: Status + Punktzahl je Land aus freedom.json → countries (ISO-2),
// Freedom House via Our World in Data. Früher ~60 feste Länder.
let _countries = null;

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached freedom data
  const { data, tier, age } = await fetchTopicData('freedom');
  // Rückgangsjahre aus dem Jahresbericht (freedom.json → report)
  _declineYears = data?.report?.declineYears ?? _declineYears;
  _declineDataYear = data?.report?.dataYear ?? _declineDataYear;

  // Freedom House via OWID: Status je Jahr + Bevölkerungsanteil in freien Ländern
  _chartData = data?.status_trend?.length ? data.status_trend : null;
  _report = data?.report || null;
  _countries = data?.countries && Object.keys(data.countries).length ? data.countries : null;
  const popShare = data?.pop_free_share?.at(-1) || null;

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, popShare, tier, age);

  // --- 3. Chart Block (Länder nach Status seit 1972) ---
  if (_chartData) await _renderTrend(blocks.chart);

  // --- 4. Trend Block (supplementary text) ---
  _renderTrendText(blocks.trend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block (Freedom Choropleth) ---
  if (_countries) await _renderMap(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, popShare, tier, age) {
  const badge = createTierBadge(popShare ? tier : 'static', { age, dataAsOf: popShare?.year ?? null, cadence: 'annual' });
  const formatted = popShare ? fmtNumber(popShare.value, { decimals: 1 }) : '–';

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

// --- Chart Block (Länder und Gebiete nach Status) -----------------------

async function _renderTrend(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.freedom.statusTitle', { from: _chartData[0].year, to: _chartData.at(-1).year }),
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

  // Listen on `document` — detail-app.js dispatches there (pre-Run-5
  // this listened on chartEl, which never received the event because
  // it was dispatched on the sibling trend-block and does not bubble
  // between siblings; selector looked active but chart never updated).
  document.addEventListener('timerangechange', (e) => {
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
    STATUS.forEach((st, i) => { _trendChart.data.datasets[i].data = filtered.map(d => d[st.key]); });
    _trendChart.update('none');
  });
}

// Gestapelt von unten: frei, teilweise frei, nicht frei (Statusfarben)
const STATUS = [
  { key: 'free', label: 'detail.freedom.free', color: '--status-good' },
  { key: 'partlyFree', label: 'detail.freedom.partlyFree', color: '--status-warning' },
  { key: 'notFree', label: 'detail.freedom.notFree', color: '--status-critical' },
];

function _createTrendChart(trendData) {
  return createChart('freedom-trend-chart', {
    type: 'line',
    data: {
      labels: trendData.map(d => String(d.year)),
      datasets: STATUS.map((st, i) => ({
        label: i18n.t(st.label),
        data: trendData.map(d => d[st.key]),
        borderColor: cssVar(st.color),
        backgroundColor: cssVar(st.color) + 'b3',   // 70 % Deckkraft
        fill: i === 0 ? 'origin' : '-1',
        tension: 0,
        pointRadius: 0,
        pointHitRadius: 8,
        borderWidth: 1,
      })),
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 8, maxRotation: 0 },
        },
        y: {
          stacked: true,
          min: 0,
          title: {
            display: true,
            text: i18n.t('detail.freedom.axisCount'),
          },
        },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16 } },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${item.dataset.label}: ${fmtNumber(item.parsed.y, { decimals: 0 })}`,
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
        background: 'var(--surface-2)',
        borderRadius: '8px',
      },
    }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '2rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
        textContent: String(_declineYears),
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.freedom.trendDesc', {
          dataYear: _declineDataYear, declined: _report?.declined ?? '–', improved: _report?.improved ?? '–',
        }),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', margin: '0' },
      }),
    ])
  );
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl) {
  // Länderzahlen aus dem Jahresbericht (195 Staaten, ohne Gebiete)
  const freeCount = _report?.free ?? '–';
  const partlyFreeCount = _report?.partlyFree ?? '–';
  const notFreeCount = _report?.notFree ?? '–';
  const ofStates = i18n.t('detail.freedom.ofStates');

  const tileData = [
    {
      label: i18n.t('detail.freedom.tileFree'),
      value: String(freeCount),
      unit: ofStates,
      accent: 'var(--status-good)',
    },
    {
      label: i18n.t('detail.freedom.tilePartly'),
      value: String(partlyFreeCount),
      unit: ofStates,
      accent: 'var(--status-warning)',
    },
    {
      label: i18n.t('detail.freedom.tileNotFree'),
      value: String(notFreeCount),
      unit: ofStates,
      accent: 'var(--status-critical)',
    },
    {
      label: i18n.t('detail.freedom.tileDecline'),
      value: String(_declineYears),
      unit: `${_declineDataYear - _declineYears + 1}–${_declineDataYear}`,
      accent: toRgba(CHART_COLORS.society),
    },
  ];

  const tiles = tileData.map(({ label, value, unit, accent }) =>
    DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'var(--surface-2)',
        borderRadius: '8px',
        boxShadow: accent ? `inset 0 3px 0 ${accent}` : 'none',
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
          color: 'var(--text-primary)',
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
  // Farbe folgt dem offiziellen Status (nicht einer Punkt-Schwelle)
  const STATUS_COLOR = ['var(--status-critical)', 'var(--status-warning)', 'var(--status-good)'];
  const STATUS_LABEL = ['detail.freedom.notFree', 'detail.freedom.partlyFree', 'detail.freedom.free'];
  let names = null;
  try { names = new Intl.DisplayNames([i18n.lang], { type: 'region' }); } catch { /* Fallback: ISO-Code */ }

  function colorFn(c) {
    return STATUS_COLOR[c.status] || 'var(--surface-3)';
  }

  function tooltipFn(iso, c) {
    const name = names?.of(iso) || iso;
    const score = c.score != null ? ` · ${c.score}/100` : '';
    return `${name}: ${i18n.t(STATUS_LABEL[c.status])}${score}`;
  }

  const legendItems = [
    { color: 'var(--status-good)', label: i18n.t('detail.freedom.free') },
    { color: 'var(--status-warning)', label: i18n.t('detail.freedom.partlyFree') },
    { color: 'var(--status-critical)', label: i18n.t('detail.freedom.notFree') },
  ];

  const result = await renderChoropleth(compEl, {
    dataMap: _countries,
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
    {
      label: 'Freedom House – Freedom in the World 2026',
      url: 'https://freedomhouse.org/report/freedom-world/2026/growing-shadow-autocracy',
    },
    {
      label: 'Our World in Data – Freedom House',
      url: 'https://ourworldindata.org/grapher/free-countries-fh',
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
          color: 'var(--accent)',
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
  _report = null;
  _countries = null;
  console.log('[Freedom] cleanup()');
}
