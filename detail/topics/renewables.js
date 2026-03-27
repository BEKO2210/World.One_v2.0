/* ===================================================================
   World.One 2.0 -- Renewables Topic Module (ENV-06)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: World Bank renewable energy % (cache/static), Electricity Maps
         carbon intensity DE (hardcoded), IRENA solar+wind growth
         (hardcoded), RENEWABLE_SCORE choropleth (from maps.js)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'renewables',
  titleKey: 'detail.renewables.title',
  category: 'environment',
  icon: '',
  supportsTimeRange: true,
};

// --- Module State ------------------------------------------------------

let _chartData = null;
let _choroplethCleanup = null;

// --- Hardcoded Data Constants ------------------------------------------

// Renewable energy share by country (0-1 scale, from maps.js RENEWABLE_SCORE)
const RENEWABLE_SCORE = {
  IS: 1.0, NO: 0.98, BR: 0.83, NZ: 0.82, SE: 0.75, AT: 0.78, CH: 0.68,
  CA: 0.67, FI: 0.44, DK: 0.8, PT: 0.6, ES: 0.47, DE: 0.46, FR: 0.21,
  GB: 0.43, IT: 0.4, GR: 0.35, IE: 0.38, NL: 0.14, BE: 0.13, PL: 0.17,
  US: 0.21, CN: 0.29, IN: 0.2, JP: 0.22, KR: 0.07, AU: 0.32,
  ET: 0.92, KE: 0.75, UG: 0.9, TZ: 0.85, MZ: 0.78, CD: 0.95, CG: 0.65,
  ZA: 0.11, EG: 0.12, MA: 0.2, DZ: 0.01, NG: 0.18, GH: 0.4,
  MX: 0.26, CO: 0.75, PE: 0.6, EC: 0.55, CL: 0.47, AR: 0.3, VE: 0.65,
  PK: 0.35, BD: 0.03, NP: 0.88, LA: 0.65, KH: 0.4, VN: 0.35, MM: 0.55,
  TH: 0.2, PH: 0.28, ID: 0.15, MY: 0.2,
  RU: 0.2, UA: 0.08, KZ: 0.12, UZ: 0.2, TM: 0.0, TJ: 0.95,
  SA: 0.01, AE: 0.07, QA: 0.0, KW: 0.01, IQ: 0.03, IR: 0.06,
  RO: 0.28, BG: 0.23, HU: 0.15, CZ: 0.17, SK: 0.24, HR: 0.3, RS: 0.26,
};

// Solar & Wind installed capacity (GW) -- IRENA Renewable Energy Statistics
const SOLAR_WIND_GROWTH = {
  years: [2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024],
  solar: [1.5, 2.2, 3.9, 6.9, 15.8, 40, 100, 177, 303, 486, 714, 1047, 1580],
  wind: [17, 31, 48, 74, 121, 198, 283, 370, 487, 591, 743, 899, 1017],
};

// Top 15 countries by renewable energy share (%)
const TOP_COUNTRIES = [
  { name: 'Iceland', pct: 100 }, { name: 'Norway', pct: 98 },
  { name: 'Ethiopia', pct: 92 }, { name: 'Tanzania', pct: 86 },
  { name: 'Brazil', pct: 83 }, { name: 'New Zealand', pct: 82 },
  { name: 'Denmark', pct: 80 }, { name: 'Austria', pct: 78 },
  { name: 'Colombia', pct: 77 }, { name: 'Sweden', pct: 75 },
  { name: 'Kenya', pct: 75 }, { name: 'Canada', pct: 67 },
  { name: 'Switzerland', pct: 68 }, { name: 'Venezuela', pct: 62 },
  { name: 'Portugal', pct: 60 },
];

// Germany carbon intensity (gCO2/kWh, approximate 2024 average -- Electricity Maps)
const CARBON_INTENSITY_DE = 385;

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Data fetch
  const { data, tier, age } = await fetchTopicData('renewables');

  // Extract renewable energy % from data or use static fallback
  let renewablePct = 29.6;
  if (data && data.renewableEnergy !== undefined) {
    renewablePct = typeof data.renewableEnergy === 'object'
      ? (data.renewableEnergy.current || renewablePct)
      : data.renewableEnergy;
  }

  // 2. Hero block
  _renderHero(blocks.hero, renewablePct, tier, age);

  // 3. Primary chart block -- Carbon intensity + Country ranking
  await _renderChartBlock(blocks.chart);

  // 4. Trend block -- Solar & Wind growth curves
  await _renderGrowthChart(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Choropleth map
  await _renderMap(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, renewablePct, tier, age) {
  const formatted = renewablePct.toFixed(1);
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'renewables-hero' }, [
      DOMUtils.create('div', {
        className: 'renewables-hero__value',
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
          textContent: i18n.t('detail.renewables.heroUnit'),
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
          textContent: i18n.t('detail.renewables.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (Carbon Intensity + Country Ranking) -------------------

async function _renderChartBlock(chartEl) {
  // Section 1: Carbon Intensity Germany
  _renderCarbonIntensity(chartEl);

  // Section 2: Country ranking horizontal bar chart
  await _renderRankingChart(chartEl);
}

function _renderCarbonIntensity(chartEl) {
  // Color based on carbon intensity value
  let intensityColor = '#fbc02d'; // default yellow
  if (CARBON_INTENSITY_DE < 200) intensityColor = '#4caf50';
  else if (CARBON_INTENSITY_DE <= 400) intensityColor = '#fbc02d';
  else intensityColor = '#f57c00';

  const staticBadge = createTierBadge('static', {});

  chartEl.appendChild(
    DOMUtils.create('div', {
      style: {
        marginBottom: 'var(--space-md)',
        padding: 'var(--space-sm)',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
      },
    }, [
      DOMUtils.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' },
      }, [
        DOMUtils.create('h2', {
          textContent: i18n.t('detail.renewables.carbonTitle'),
          style: { color: 'var(--text-primary)', margin: '0' },
        }),
        staticBadge,
      ]),
      DOMUtils.create('div', {
        style: {
          fontSize: '3rem',
          fontWeight: '700',
          color: intensityColor,
          lineHeight: '1.2',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        String(CARBON_INTENSITY_DE),
        DOMUtils.create('span', {
          textContent: ' gCO2/kWh',
          style: { fontSize: '1rem', fontWeight: '400', color: 'var(--text-secondary)' },
        }),
      ]),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.renewables.euAverage'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0' },
      }),
    ])
  );
}

async function _renderRankingChart(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.renewables.rankingTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:450px;',
      }, [
        DOMUtils.create('canvas', { id: 'renewables-ranking-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  const labels = TOP_COUNTRIES.map(c => c.name);
  const values = TOP_COUNTRIES.map(c => c.pct);

  // Green gradient: darker for higher %
  const barColors = values.map(v => {
    const ratio = v / 100;
    const r = Math.round(200 - ratio * 200);
    const g = Math.round(120 + ratio * 80);
    const b = Math.round(80 - ratio * 40);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  });

  createChart('renewables-ranking-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: i18n.t('detail.renewables.renewableShareLabel'),
        data: values,
        backgroundColor: barColors,
        borderColor: barColors.map(c => c.replace('0.85', '1')),
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          max: 105,
          title: {
            display: true,
            text: '%',
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.parsed.x}% renewable`,
          },
        },
      },
    },
  });
}

// --- Trend Block (Solar & Wind Growth Curves) ---------------------------

async function _renderGrowthChart(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.renewables.growthTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'renewables-growth-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  // Full data set
  const allLabels = SOLAR_WIND_GROWTH.years.map(String);
  const allSolar = [...SOLAR_WIND_GROWTH.solar];
  const allWind = [...SOLAR_WIND_GROWTH.wind];

  _chartData = {
    allLabels,
    allSolar,
    allWind,
    chartId: 'renewables-growth-chart',
  };

  _createGrowthChart(allLabels, allSolar, allWind);

  // Listen for timerangechange events on trend block
  trendEl.addEventListener('timerangechange', (e) => {
    const range = e.detail?.range;
    if (!range || !_chartData) return;

    const { allLabels: labels, allSolar: solar, allWind: wind } = _chartData;

    let startIdx = 0;
    if (range === '1Y') {
      // Last 2 data points (2022, 2024)
      startIdx = Math.max(0, labels.length - 2);
    } else if (range === '5Y') {
      // From 2020 onwards
      startIdx = labels.findIndex(y => parseInt(y) >= 2020);
      if (startIdx < 0) startIdx = 0;
    } else if (range === '20Y') {
      // From 2004 onwards
      startIdx = labels.findIndex(y => parseInt(y) >= 2004);
      if (startIdx < 0) startIdx = 0;
    }
    // 'Max' keeps startIdx = 0

    const filteredLabels = labels.slice(startIdx);
    const filteredSolar = solar.slice(startIdx);
    const filteredWind = wind.slice(startIdx);

    _createGrowthChart(filteredLabels, filteredSolar, filteredWind);
  });
}

function _createGrowthChart(labels, solarData, windData) {
  createChart('renewables-growth-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Solar',
          data: solarData,
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHitRadius: 8,
          pointBackgroundColor: '#ffc107',
          borderWidth: 2,
        },
        {
          label: 'Wind',
          data: windData,
          borderColor: toRgba(CHART_COLORS.environment, 1),
          backgroundColor: toRgba(CHART_COLORS.environment, 0.1),
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHitRadius: 8,
          pointBackgroundColor: toRgba(CHART_COLORS.environment, 1),
          borderWidth: 2,
        },
      ],
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: i18n.t('detail.renewables.yAxisLabel'),
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: { usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${item.parsed.y.toLocaleString()} GW`,
          },
        },
      },
    },
  });
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl) {
  const tileData = [
    {
      label: i18n.t('detail.renewables.tileSolar'),
      value: '1,580',
      unit: 'GW (2024)',
    },
    {
      label: i18n.t('detail.renewables.tileWind'),
      value: '1,017',
      unit: 'GW (2024)',
    },
    {
      label: i18n.t('detail.renewables.tileCarbon'),
      value: '385',
      unit: 'gCO2/kWh',
    },
    {
      label: i18n.t('detail.renewables.tileInvest'),
      value: '$623B',
      unit: 'BloombergNEF 2024',
    },
  ];

  const tiles = tileData.map(({ label, value, unit }) =>
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
        style: { color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: '600' },
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
    DOMUtils.create('div', {}, [
      DOMUtils.create('p', {
        textContent: i18n.t('detail.renewables.explanation'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.renewables.comparison'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', marginTop: 'var(--space-sm)' },
      }),
    ])
  );
}

// --- Comparison Block (Choropleth Map) -----------------------------------

async function _renderMap(compEl) {
  // Stepped color function matching maps.js renewables layer
  function colorFn(value) {
    if (value >= 0.75) return '#006837';   // Very high -- dark green
    if (value >= 0.50) return '#31a354';   // High -- green
    if (value >= 0.30) return '#78c679';   // Medium -- light green
    if (value >= 0.15) return '#c2e699';   // Low-medium -- pale green
    return '#ffffcc';                       // Low -- pale yellow
  }

  function tooltipFn(iso, val) {
    return `${iso}: ${(val * 100).toFixed(0)}% renewable`;
  }

  const legendItems = [
    { color: '#006837', label: '>75%' },
    { color: '#31a354', label: '50-75%' },
    { color: '#78c679', label: '30-50%' },
    { color: '#c2e699', label: '15-30%' },
    { color: '#ffffcc', label: '<15%' },
  ];

  const result = await renderChoropleth(compEl, {
    dataMap: RENEWABLE_SCORE,
    colorFn,
    tooltipFn,
    legendItems,
    title: i18n.t('detail.renewables.mapTitle'),
  });

  if (result && result.cleanup) {
    _choroplethCleanup = result.cleanup;
  }
}

// --- Sources Block ------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.renewables.sourceWB'),
      url: 'https://data.worldbank.org/indicator/EG.FEC.RNEW.ZS',
    },
    {
      label: i18n.t('detail.renewables.sourceIRENA'),
      url: 'https://www.irena.org/publications/2024/Mar/Renewable-Capacity-Statistics-2024',
    },
    {
      label: i18n.t('detail.renewables.sourceEM'),
      url: 'https://app.electricitymaps.com/zone/DE',
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
          color: toRgba(CHART_COLORS.environment, 0.9),
          textDecoration: 'none',
          borderBottom: `1px solid ${toRgba(CHART_COLORS.environment, 0.3)}`,
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
  // All charts rendered directly in render() for interactivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  _chartData = null;
  console.log('[Renewables] cleanup()');
}
