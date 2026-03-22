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

// --- Regional Poverty Breakdown (World Bank PIP 2024 estimates) --------
// Percentage living below $2.15/day by world region

const REGIONAL_POVERTY = [
  {
    region: 'subSahara',
    data: [
      { year: 1990, value: 56.8 }, { year: 1995, value: 57.7 }, { year: 2000, value: 55.1 },
      { year: 2005, value: 49.2 }, { year: 2010, value: 44.4 }, { year: 2015, value: 39.7 },
      { year: 2020, value: 36.2 }, { year: 2024, value: 34.9 },
    ],
    color: '#d32f2f',
  },
  {
    region: 'southAsia',
    data: [
      { year: 1990, value: 50.7 }, { year: 1995, value: 44.8 }, { year: 2000, value: 37.2 },
      { year: 2005, value: 30.5 }, { year: 2010, value: 22.2 }, { year: 2015, value: 14.5 },
      { year: 2020, value: 10.1 }, { year: 2024, value: 8.2 },
    ],
    color: '#f57c00',
  },
  {
    region: 'eastAsia',
    data: [
      { year: 1990, value: 60.7 }, { year: 1995, value: 38.8 }, { year: 2000, value: 28.7 },
      { year: 2005, value: 16.3 }, { year: 2010, value: 8.8 }, { year: 2015, value: 2.8 },
      { year: 2020, value: 1.2 }, { year: 2024, value: 0.9 },
    ],
    color: '#fbc02d',
  },
  {
    region: 'latinAmerica',
    data: [
      { year: 1990, value: 14.4 }, { year: 1995, value: 12.2 }, { year: 2000, value: 11.8 },
      { year: 2005, value: 8.9 }, { year: 2010, value: 5.5 }, { year: 2015, value: 4.1 },
      { year: 2020, value: 4.8 }, { year: 2024, value: 3.6 },
    ],
    color: '#4caf50',
  },
  {
    region: 'europe',
    data: [
      { year: 1990, value: 3.2 }, { year: 1995, value: 6.3 }, { year: 2000, value: 6.1 },
      { year: 2005, value: 3.2 }, { year: 2010, value: 2.0 }, { year: 2015, value: 1.5 },
      { year: 2020, value: 1.3 }, { year: 2024, value: 1.1 },
    ],
    color: '#1976d2',
  },
  {
    region: 'middleEast',
    data: [
      { year: 1990, value: 6.2 }, { year: 1995, value: 5.5 }, { year: 2000, value: 4.3 },
      { year: 2005, value: 3.8 }, { year: 2010, value: 2.8 }, { year: 2015, value: 5.0 },
      { year: 2020, value: 7.1 }, { year: 2024, value: 7.5 },
    ],
    color: '#7b1fa2',
  },
];

// --- Local hex-to-RGB helper (REGIONAL_POVERTY uses hex colors) --------

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

  // Extract poverty_trend from cache data (34 entries, 1990-2024)
  const poverty_trend = data?.poverty_trend || [];
  const latestValue = poverty_trend.length > 0
    ? poverty_trend[poverty_trend.length - 1].value
    : 10.3;
  const startValue = poverty_trend.length > 0
    ? poverty_trend[0].value
    : 43.4;

  // Store full data for time range filtering
  _chartData = poverty_trend.length > 0 ? poverty_trend : [
    { year: 1990, value: 43.4 }, { year: 1991, value: 42.3 }, { year: 1992, value: 41.0 },
    { year: 1993, value: 40.5 }, { year: 1994, value: 39.8 }, { year: 1995, value: 38.5 },
    { year: 1996, value: 37.9 }, { year: 1997, value: 36.1 }, { year: 1998, value: 35.5 },
    { year: 1999, value: 34.8 }, { year: 2000, value: 33.7 }, { year: 2001, value: 32.3 },
    { year: 2002, value: 30.8 }, { year: 2003, value: 28.5 }, { year: 2004, value: 26.8 },
    { year: 2005, value: 24.6 }, { year: 2006, value: 22.8 }, { year: 2007, value: 21.1 },
    { year: 2008, value: 20.3 }, { year: 2009, value: 19.5 }, { year: 2010, value: 17.8 },
    { year: 2011, value: 15.9 }, { year: 2012, value: 14.3 }, { year: 2013, value: 13.1 },
    { year: 2014, value: 12.4 }, { year: 2015, value: 11.2 }, { year: 2016, value: 10.8 },
    { year: 2017, value: 10.1 }, { year: 2018, value: 9.3 }, { year: 2019, value: 8.6 },
    { year: 2020, value: 9.7 }, { year: 2021, value: 9.3 }, { year: 2022, value: 9.9 },
    { year: 2024, value: 10.3 },
  ];

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, latestValue, startValue, tier, age);

  // --- 3. Chart Block (Poverty trend line, animated) ---
  await _renderTrend(blocks.chart);

  // --- 4. Trend Block (Regional stacked area chart) ---
  await _renderRegional(blocks.trend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles, latestValue);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block ---
  _renderComparison(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, latestValue, startValue, tier, age) {
  const badge = createTierBadge(tier, { age });
  const formatted = Number(latestValue).toFixed(1) + '%';

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
          textContent: `${Number(startValue).toFixed(1)}%`,
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
            label: (item) => `${i18n.t('detail.poverty.heroLabel')}: ${item.parsed.y.toFixed(1)}%`,
          },
        },
      },
    },
  });
}

// --- Trend Block (Regional Stacked Area Chart) ---------------------------

async function _renderRegional(trendEl) {
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

  // Extract common years from the first region
  const years = REGIONAL_POVERTY[0].data.map(d => String(d.year));

  const datasets = REGIONAL_POVERTY.map(region => ({
    label: i18n.t(`detail.poverty.${region.region}`),
    data: region.data.map(d => d.value),
    backgroundColor: toRgba(_hexToRgb(region.color), 0.4),
    borderColor: region.color,
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointHitRadius: 8,
    borderWidth: 1.5,
  }));

  createChart('poverty-regional-canvas', {
    type: 'line',
    data: {
      labels: years,
      datasets,
    },
    options: {
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
        },
        y: {
          stacked: true,
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
            label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
          },
        },
      },
    },
  });
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, latestValue) {
  const tileData = [
    {
      label: i18n.t('detail.poverty.tilePovRate'),
      value: Number(latestValue).toFixed(1) + '%',
      unit: '$2.15/day',
      accent: toRgba(CHART_COLORS.economy),
    },
    {
      label: i18n.t('detail.poverty.tilePeople'),
      value: '~700M',
      unit: i18n.t('detail.poverty.heroLabel'),
    },
    {
      label: i18n.t('detail.poverty.tileChange'),
      value: '-76%',
      unit: '1990-2024',
      accent: '#4caf50',
    },
    {
      label: i18n.t('detail.poverty.tileGoal'),
      value: '0%',
      unit: 'by 2030',
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
