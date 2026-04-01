/* ===================================================================
   World.One 2.0 -- Health Topic Module (SOC-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: WHO/World Bank life expectancy (hardcoded), WHO top-10 causes
         of death (hardcoded), health spending vs life expectancy
         (hardcoded), WHO/UNICEF DTP3 vaccination coverage (hardcoded)
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
  id: 'health',
  titleKey: 'detail.health.title',
  category: 'society',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null;
let _choroplethCleanup = null;

// --- WHO Top-10 Causes of Death (2024 estimates, millions) -------------

const CAUSES_OF_DEATH = [
  { name: { de: 'Herzerkrankungen', en: 'Heart Disease' }, deaths: 19100000, color: '#d32f2f' },
  { name: { de: 'Krebs', en: 'Cancer' }, deaths: 10000000, color: '#7b1fa2' },
  { name: { de: 'Schlaganfall', en: 'Stroke' }, deaths: 6900000, color: '#e65100' },
  { name: { de: 'Atemwegserkrankungen', en: 'Respiratory Disease' }, deaths: 3600000, color: '#00838f' },
  { name: { de: 'COVID-19', en: 'COVID-19' }, deaths: 3200000, color: '#c62828' },
  { name: { de: 'Neugeborene', en: 'Neonatal' }, deaths: 2400000, color: '#558b2f' },
  { name: { de: 'Diabetes', en: 'Diabetes' }, deaths: 2000000, color: '#f9a825' },
  { name: { de: 'Durchfallerkrankungen', en: 'Diarrheal Diseases' }, deaths: 1800000, color: '#4e342e' },
  { name: { de: 'Tuberkulose', en: 'Tuberculosis' }, deaths: 1300000, color: '#546e7a' },
  { name: { de: 'Verkehrsunfälle', en: 'Road Injuries' }, deaths: 1200000, color: '#37474f' },
];

// --- Health Spending vs Life Expectancy (~25 countries, World Bank 2022) -

const HEALTH_SPENDING_DATA = [
  { country: 'US', spending: 12555, lifeExp: 77.5, population: 331000000 },
  { country: 'CH', spending: 9666, lifeExp: 83.4, population: 8700000 },
  { country: 'DE', spending: 7383, lifeExp: 80.6, population: 83100000 },
  { country: 'JP', spending: 4691, lifeExp: 84.8, population: 125000000 },
  { country: 'UK', spending: 5138, lifeExp: 80.7, population: 67300000 },
  { country: 'FR', spending: 5468, lifeExp: 82.3, population: 67700000 },
  { country: 'AU', spending: 5627, lifeExp: 83.3, population: 25700000 },
  { country: 'CA', spending: 5905, lifeExp: 81.3, population: 38200000 },
  { country: 'KR', spending: 3476, lifeExp: 83.7, population: 51700000 },
  { country: 'BR', spending: 928, lifeExp: 75.3, population: 215000000 },
  { country: 'MX', spending: 645, lifeExp: 75.0, population: 128900000 },
  { country: 'CN', spending: 688, lifeExp: 78.2, population: 1412000000 },
  { country: 'IN', spending: 78, lifeExp: 70.8, population: 1408000000 },
  { country: 'NG', spending: 22, lifeExp: 53.9, population: 218000000 },
  { country: 'ET', spending: 28, lifeExp: 66.6, population: 123000000 },
  { country: 'ZA', spending: 471, lifeExp: 64.9, population: 60000000 },
  { country: 'RU', spending: 664, lifeExp: 73.4, population: 144000000 },
  { country: 'TR', spending: 495, lifeExp: 76.0, population: 85000000 },
  { country: 'SE', spending: 6262, lifeExp: 83.0, population: 10400000 },
  { country: 'NO', spending: 8091, lifeExp: 83.2, population: 5400000 },
  { country: 'CU', spending: 1062, lifeExp: 78.8, population: 11300000 },
  { country: 'SA', spending: 1485, lifeExp: 77.6, population: 36400000 },
  { country: 'TH', spending: 296, lifeExp: 78.7, population: 71600000 },
  { country: 'EG', spending: 134, lifeExp: 72.1, population: 104000000 },
  { country: 'BD', spending: 41, lifeExp: 72.4, population: 170000000 },
];

// --- Vaccination DTP3 Coverage by Country (WHO 2024 estimates, 0-100%) --

const VACCINATION_DTP3 = {
  US: 92, DE: 93, JP: 97, UK: 92, FR: 97, AU: 95, CA: 90, KR: 98,
  CN: 99, IN: 85, BR: 80, MX: 88, RU: 97, ZA: 80, NG: 57, ET: 72,
  EG: 94, TR: 96, SE: 97, NO: 96, SA: 98, TH: 97, BD: 97, PK: 72,
  ID: 79, PH: 70, VN: 89, CO: 92, AR: 83, PE: 83, CL: 93, MY: 97,
  KE: 85, TZ: 89, GH: 88, CM: 72, CD: 55, AF: 66, MM: 80, IQ: 79,
  SY: 52, YE: 60, HT: 45, SO: 42, SD: 68, ML: 68, NE: 73, TD: 56,
  MW: 90, MZ: 80, UG: 89,
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch topic data (no health cache file -- will resolve to static)
  const { data, tier, age } = await fetchTopicData('health');

  // Life expectancy: hardcoded WHO 2024 estimate
  const lifeExpectancy = 73.4;

  // 2. Hero block
  _renderHero(blocks.hero, lifeExpectancy, tier, age);

  // 3. Chart block -- Causes-of-death treemap (DOM-based)
  _renderTreemap(blocks.chart);

  // 4. Trend block -- Health spending vs life expectancy bubble chart
  await _renderBubbleChart(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Vaccination choropleth
  await _renderVaccinationMap(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, lifeExp, tier, age) {
  const badge = createTierBadge('static', { year: 2024 });
  const formatted = lifeExp.toFixed(1);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'health-hero' }, [
      DOMUtils.create('div', {
        className: 'health-hero__value',
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
          textContent: i18n.t('detail.health.heroUnit'),
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
          textContent: i18n.t('detail.health.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (Causes-of-Death DOM Treemap) --------------------------

function _renderTreemap(chartEl) {
  const total = CAUSES_OF_DEATH.reduce((s, c) => s + c.deaths, 0);
  const maxDeaths = CAUSES_OF_DEATH[0].deaths;
  const lang = i18n.lang || 'de';

  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.health.treemapTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Horizontal bar chart — always readable on mobile
  const listEl = DOMUtils.create('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '6px' },
  });

  for (const cause of CAUSES_OF_DEATH) {
    const pct = (cause.deaths / total) * 100;
    const barWidth = (cause.deaths / maxDeaths) * 100;
    const deathsFormatted = MathUtils.formatCompact(cause.deaths);
    const causeName = cause.name[lang] || cause.name.en;

    const row = DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(100px, 1fr) 2fr auto',
        alignItems: 'center',
        gap: '8px',
      },
    }, [
      // Name
      DOMUtils.create('div', {
        textContent: causeName,
        style: {
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          fontWeight: '500',
          lineHeight: '1.3',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }),
      // Bar
      DOMUtils.create('div', {
        style: {
          height: '20px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '4px',
          overflow: 'hidden',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            height: '100%',
            width: `${barWidth}%`,
            background: cause.color,
            borderRadius: '4px',
            transition: 'width 1s ease',
            minWidth: '4px',
          },
        }),
      ]),
      // Deaths count
      DOMUtils.create('div', {
        textContent: deathsFormatted,
        style: {
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          minWidth: '45px',
          textAlign: 'right',
        },
      }),
    ]);

    listEl.appendChild(row);
  }

  chartEl.appendChild(listEl);
}

// --- Trend Block (Health Spending vs Life Expectancy Bubble Chart) ------

async function _renderBubbleChart(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.health.scatterTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'health-spending-scatter' }),
      ]),
    ])
  );

  await ensureChartJs();

  const bubbleData = HEALTH_SPENDING_DATA.map(d => ({
    x: d.spending,
    y: d.lifeExp,
    r: Math.max(Math.sqrt(d.population / 1e7) * 2, 3),
  }));

  const bgColors = HEALTH_SPENDING_DATA.map(d => {
    if (d.lifeExp >= 80) return toRgba(CHART_COLORS.society, 0.7);
    if (d.lifeExp >= 70) return toRgba({ r: 255, g: 193, b: 7 }, 0.7);
    return toRgba(CHART_COLORS.crisis, 0.7);
  });

  const borderColors = HEALTH_SPENDING_DATA.map(d => {
    if (d.lifeExp >= 80) return toRgba(CHART_COLORS.society, 1);
    if (d.lifeExp >= 70) return toRgba({ r: 255, g: 193, b: 7 }, 1);
    return toRgba(CHART_COLORS.crisis, 1);
  });

  _chartData = { bubbleData };

  createChart('health-spending-scatter', {
    type: 'bubble',
    data: {
      datasets: [{
        label: i18n.t('detail.health.chartLabel'),
        data: bubbleData,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
      }],
    },
    options: {
      scales: {
        x: {
          type: 'logarithmic',
          min: 10,
          title: {
            display: true,
            text: i18n.t('detail.health.xAxisLabel'),
          },
          grid: { display: false },
        },
        y: {
          min: 50,
          max: 90,
          title: {
            display: true,
            text: i18n.t('detail.health.yAxisLabel'),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function () { return ''; },
            label: function (ctx) {
              const idx = ctx.dataIndex;
              const d = HEALTH_SPENDING_DATA[idx];
              const pop = MathUtils.formatCompact(d.population);
              return [
                d.country,
                'Spending: $' + d.spending.toLocaleString() + '/capita',
                'Life exp: ' + d.lifeExp + ' years',
                'Population: ' + pop,
              ];
            },
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
      label: i18n.t('detail.health.tileLifeExp'),
      value: '73.4',
      unit: i18n.t('detail.health.heroUnit'),
    },
    {
      label: i18n.t('detail.health.tileChildMort'),
      value: '37',
      unit: i18n.t('detail.health.unitPerBirths'),
    },
    {
      label: i18n.t('detail.health.tileVaccDTP3'),
      value: '85%',
      unit: 'DTP3',
    },
    {
      label: i18n.t('detail.health.tileHealthSpend'),
      value: '$1,122',
      unit: i18n.t('detail.health.globalAvg'),
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
      textContent: i18n.t('detail.health.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block (Vaccination Choropleth) ---------------------------

async function _renderVaccinationMap(compEl) {
  // Comparison text first
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.health.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: 'var(--space-sm)' },
    })
  );

  // Vaccination choropleth
  function colorFn(value) {
    if (value >= 95) return '#1b5e20';   // Excellent (dark green)
    if (value >= 85) return '#4caf50';   // Good (green)
    if (value >= 70) return '#fbc02d';   // Moderate (yellow)
    if (value >= 50) return '#f57c00';   // Concerning (orange)
    return '#d32f2f';                     // Critical (red)
  }

  function tooltipFn(iso, val) {
    return iso + ': DTP3 ' + val + '%';
  }

  const legendItems = [
    { color: '#1b5e20', label: '>95%' },
    { color: '#4caf50', label: '85-95%' },
    { color: '#fbc02d', label: '70-85%' },
    { color: '#f57c00', label: '50-70%' },
    { color: '#d32f2f', label: '<50%' },
  ];

  const result = await renderChoropleth(compEl, {
    dataMap: VACCINATION_DTP3,
    colorFn,
    tooltipFn,
    legendItems,
    title: i18n.t('detail.health.vaccinationTitle'),
  });

  if (result && result.cleanup) {
    _choroplethCleanup = result.cleanup;
  }
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.health.sourceWHO'),
      url: 'https://www.who.int/data/gho',
    },
    {
      label: i18n.t('detail.health.sourceWB'),
      url: 'https://data.worldbank.org/indicator/SP.DYN.LE00.IN',
    },
    {
      label: i18n.t('detail.health.sourceUNICEF'),
      url: 'https://data.unicef.org/topic/child-health/immunization/',
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
  // Bubble chart rendered directly in render() for tooltip interactivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  _chartData = null;
  console.log('[Health] cleanup()');
}
