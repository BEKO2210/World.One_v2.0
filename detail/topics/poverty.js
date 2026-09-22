/* ===================================================================
   World.One 2.0 -- Poverty Topic Module (ECON-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: World Bank extreme poverty trend (cached poverty.json),
         Regional poverty breakdown (hardcoded World Bank PIP 2024),
         Animated trend line 43.4% to 10.3% (1990-2024)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { fmtNumber } from '../../js/utils/fmt.js';
import { createEmptyState } from '../../js/utils/empty-state.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'poverty',
  titleKey: 'detail.poverty.title',
  category: 'economy',
  icon: '',
  supportsTimeRange: true,
};

// --- Module State ------------------------------------------------------

let _trendChart = null;
let _chartData = null;

// --- Regional Poverty Breakdown (World Bank PIP, $3.00/day) ------------
// Werte kommen aus poverty.json (regions[code]); hier nur Zuordnung + Farbe.

const REGIONS = [
  { region: 'subSahara',    code: 'SSF', color: '#d32f2f' },
  { region: 'southAsia',    code: 'SAS', color: '#f57c00' },
  { region: 'eastAsia',     code: 'EAS', color: '#fbc02d' },
  { region: 'latinAmerica', code: 'LCN', color: '#4caf50' },
  { region: 'europe',       code: 'ECS', color: '#1976d2' },
  { region: 'middleEast',   code: 'MEA', color: '#7b1fa2' },
];

// --- Local hex-to-RGB helper (REGIONS use hex colors) --------

function _hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached poverty data
  const { data, tier, age } = await fetchTopicData('poverty');

  // Welt-Trend aus PIP ($3.00/Tag); ohne Cache die Jahreswerte aus static-values
  const poverty_trend = data?.poverty_trend || [];
  const fb = tier === 'static' ? data : null;
  const latestValue = poverty_trend.length > 0
    ? poverty_trend[poverty_trend.length - 1].value
    : fb?.extreme_poverty_pct?.value ?? null;
  const latestYear = poverty_trend.length > 0
    ? poverty_trend[poverty_trend.length - 1].year
    : fb?.extreme_poverty_pct?.year ?? null;
  const startValue = poverty_trend.length > 0 ? poverty_trend[0].value : null;
  const people = data?.latest?.people ?? (fb?.people_in_poverty_m?.value ? fb.people_in_poverty_m.value * 1e6 : null);

  // Store full data for time range filtering
  _chartData = poverty_trend;

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, latestValue, startValue, tier, age, latestYear);

  // --- 3. Chart Block (Poverty trend line, animated) ---
  await _renderTrend(blocks.chart);

  // --- 4. Trend Block (Regional stacked area chart) ---
  await _renderRegional(blocks.trend, data?.regions || null);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles, latestValue, startValue, people, poverty_trend);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block ---
  _renderComparison(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, latestValue, startValue, tier, age, latestYear) {
  const badge = createTierBadge(tier, { age, dataAsOf: latestYear, cadence: 'annual', source: 'World Bank PIP' });
  const formatted = latestValue != null ? fmtNumber(Number(latestValue), { decimals: 1 }) + '%' : '–';

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'poverty-hero' }, [
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
      ]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: startValue != null ? `${fmtNumber(Number(startValue), { decimals: 1 })}%` : '–',
          style: {
            color: 'var(--text-secondary)',
            fontSize: '1.25rem',
            textDecoration: 'line-through',
            opacity: '0.7',
          },
        }),
        DOMUtils.create('span', {
          textContent: '\u2192',
          style: { color: '#4caf50', fontSize: '1.25rem' },
        }),
        DOMUtils.create('span', {
          textContent: formatted,
          style: { color: '#4caf50', fontSize: '1.25rem', fontWeight: '600' },
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
          textContent: i18n.t('detail.poverty.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (Poverty Trend Line, Animated) --------------------------

async function _renderTrend(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.poverty.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'poverty-trend-canvas' }),
      ]),
    ])
  );

  // Render chart directly for time range interactivity
  await ensureChartJs();
  _trendChart = _createTrendChart(_chartData);

  // Listen for time range changes
  // Listen on `document` (see freedom.js note — pre-Run-5 this was
  // silently broken because the event fires on the trend-block which
  // is a sibling of the chart-block, not an ancestor).
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
    _trendChart.data.datasets[0].data = filtered.map(d => d.value);
    _trendChart.update('none');
  });
}

function _createTrendChart(trendData) {
  return createChart('poverty-trend-canvas', {
    type: 'line',
    data: {
      labels: trendData.map(d => String(d.year)),
      datasets: [{
        label: i18n.t('detail.poverty.heroLabel'),
        data: trendData.map(d => d.value),
        borderColor: toRgba(CHART_COLORS.economy),
        backgroundColor: toRgba(CHART_COLORS.economy, 0.15),
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHitRadius: 8,
        pointBackgroundColor: toRgba(CHART_COLORS.economy),
        borderWidth: 2,
      }],
    },
    options: {
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            callback: function (val) {
              const label = this.getLabelForValue(val);
              const year = parseInt(label, 10);
              if (year % 5 === 0) return year;
              return null;
            },
          },
        },
        y: {
          min: 0,
          max: 50,
          title: {
            display: true,
            text: '%',
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${i18n.t('detail.poverty.heroLabel')}: ${fmtNumber(item.parsed.y, { decimals: 1 })}%`,
          },
        },
      },
    },
  });
}

// --- Trend Block (Regional Stacked Area Chart) ---------------------------

async function _renderRegional(trendEl, regions) {
  const series = REGIONS
    .map(r => ({ ...r, data: regions?.[r.code] || [] }))
    .filter(r => r.data.length > 0);
  if (series.length === 0) {
    trendEl.appendChild(createEmptyState({ title: i18n.t('detail.poverty.regionalTitle') }));
    return;
  }

  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.poverty.regionalTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'poverty-regional-canvas' }),
      ]),
    ])
  );

  await ensureChartJs();

  // Quoten je Region sind nicht addierbar: einzelne Linien, kein Stapel
  const years = [...new Set(series.flatMap(r => r.data.map(d => d.year)))].sort((a, b) => a - b);

  const datasets = series.map(region => {
    const byYear = new Map(region.data.map(d => [d.year, d.value]));
    return {
    label: i18n.t(`detail.poverty.${region.region}`),
    data: years.map(y => byYear.get(y) ?? null),
    backgroundColor: toRgba(_hexToRgb(region.color), 0.4),
    borderColor: region.color,
    fill: false,
    spanGaps: true,
    tension: 0.3,
    pointRadius: 3,
    pointHitRadius: 8,
    borderWidth: 1.5,
    };
  });

  createChart('poverty-regional-canvas', {
    type: 'line',
    data: {
      labels: years.map(String),
      datasets,
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          min: 0,
          title: {
            display: true,
            text: '%',
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (item) => `${item.dataset.label}: ${fmtNumber(item.parsed.y, { decimals: 1 })}%`,
          },
        },
      },
    },
  });
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, latestValue, startValue, people, trend) {
  const first = trend[0]?.year;
  const last = trend[trend.length - 1]?.year;
  const change = latestValue != null && startValue ? Math.round((latestValue / startValue - 1) * 100) : null;
  const tileData = [
    {
      label: i18n.t('detail.poverty.tilePovRate'),
      value: latestValue != null ? fmtNumber(Number(latestValue), { decimals: 1 }) + '%' : '–',
      unit: i18n.t('detail.poverty.lineUnit'),
      accent: toRgba(CHART_COLORS.economy),
    },
    {
      label: i18n.t('detail.poverty.tilePeople'),
      value: people ? `${Math.round(people / 1e6)} Mio` : '–',
      unit: i18n.t('detail.poverty.heroLabel'),
    },
    {
      label: i18n.t('detail.poverty.tileChange'),
      value: change != null ? `${change}%` : '–',
      unit: first && last ? `${first}–${last}` : '',
      accent: '#4caf50',
    },
    {
      label: i18n.t('detail.poverty.tileGoal'),
      value: '0%',
      unit: i18n.t('detail.poverty.goalUnit'),
      accent: 'var(--text-secondary)',
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
      textContent: i18n.t('detail.poverty.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.poverty.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: 'World Bank',
      url: 'https://data.worldbank.org/indicator/SI.POV.DDAY',
    },
    {
      label: 'PIP (Poverty and Inequality Platform)',
      url: 'https://pip.worldbank.org/',
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
          color: toRgba(CHART_COLORS.economy, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.economy, 0.3),
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
  // Both charts rendered directly in render() for time range and animation support
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _trendChart = null;
  _chartData = null;
  console.log('[Poverty] cleanup()');
}
