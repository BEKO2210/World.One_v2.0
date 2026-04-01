/* ===================================================================
   World.One 2.0 -- Hunger Topic Module (CRISIS-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: FAO/World Bank undernourishment trend (cached hunger.json),
         Malnutrition by country (hardcoded ~50 countries),
         FAO Food Price Index (hardcoded 1990-2025),
         SVG choropleth with 5-level severity classification
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'hunger',
  titleKey: 'detail.hunger.title',
  category: 'crisis',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _cacheData = null;
let _choroplethCleanup = null;

// --- Malnutrition by Country (ISO-2 -> undernourishment %, ~50 countries) ---
// Source: FAO/World Bank 2022-2023 estimates

const MALNUTRITION_BY_COUNTRY = {
  'AF': 29.8, 'BD': 11.4, 'TD': 39.6, 'CD': 36.7, 'ET': 15.8,
  'HT': 46.8, 'IN': 16.6, 'ID': 6.5, 'KE': 23.0, 'MG': 41.6,
  'MW': 17.8, 'ML': 7.5, 'MZ': 30.9, 'NE': 14.2, 'NG': 11.7,
  'KP': 41.6, 'PK': 17.5, 'PH': 10.1, 'RW': 35.9, 'SN': 9.3,
  'SL': 24.5, 'SO': 53.1, 'SD': 17.0, 'TZ': 24.4, 'UG': 25.7,
  'YE': 33.4, 'ZM': 26.3, 'ZW': 30.5, 'MM': 6.3, 'LA': 6.6,
  'KH': 12.3, 'TL': 23.5, 'PG': 38.0, 'LR': 30.0, 'CF': 44.6,
  'BI': 37.7, 'ER': 55.0, 'DJ': 19.0, 'GT': 16.4, 'HN': 13.5,
  'NI': 15.5, 'VE': 22.9, 'BO': 13.8, 'AO': 20.0, 'CM': 7.2,
  'GH': 5.4, 'CI': 10.3, 'TG': 11.5, 'BJ': 7.2, 'GN': 17.2,
  'NP': 5.7, 'LK': 5.3, 'TH': 7.0, 'VN': 5.7, 'CN': 2.5,
};

// --- FAO Food Price Index (annual, 1990-2025) ---
// Source: FAO Food Price Index (base 2014-2016 = 100)

const FAO_FOOD_PRICE_INDEX = [
  { year: 1990, value: 107.6 }, { year: 1991, value: 105.0 },
  { year: 1992, value: 106.5 }, { year: 1993, value: 102.7 },
  { year: 1994, value: 107.1 }, { year: 1995, value: 117.1 },
  { year: 1996, value: 127.8 }, { year: 1997, value: 113.7 },
  { year: 1998, value: 105.3 }, { year: 1999, value: 93.0 },
  { year: 2000, value: 91.1 }, { year: 2001, value: 94.6 },
  { year: 2002, value: 89.6 }, { year: 2003, value: 97.7 },
  { year: 2004, value: 112.7 }, { year: 2005, value: 118.0 },
  { year: 2006, value: 127.2 }, { year: 2007, value: 161.4 },
  { year: 2008, value: 201.4 }, { year: 2009, value: 160.3 },
  { year: 2010, value: 188.0 }, { year: 2011, value: 229.9 },
  { year: 2012, value: 213.3 }, { year: 2013, value: 209.8 },
  { year: 2014, value: 201.8 }, { year: 2015, value: 164.0 },
  { year: 2016, value: 161.5 }, { year: 2017, value: 174.6 },
  { year: 2018, value: 168.4 }, { year: 2019, value: 171.5 },
  { year: 2020, value: 98.1 }, { year: 2021, value: 125.7 },
  { year: 2022, value: 143.7 }, { year: 2023, value: 120.8 },
  { year: 2024, value: 122.2 }, { year: 2025, value: 118.0 },
];

// --- Choropleth Color Function -----------------------------------------

function _malnutritionColor(value) {
  if (value > 35) return '#ff3b30';  // Severe
  if (value > 25) return '#ff9500';  // High
  if (value > 15) return '#ffcc00';  // Moderate
  if (value > 5) return '#34c759';   // Low
  return '#5ac8fa';                   // Very low
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached hunger data
  const { data, tier, age } = await fetchTopicData('hunger');
  _cacheData = data;

  const undernourishmentTrend = data?.undernourishment_trend || [];
  const latestEntry = undernourishmentTrend.length > 0
    ? undernourishmentTrend[undernourishmentTrend.length - 1]
    : { year: 2023, value: 8.5 };

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, latestEntry, tier, age);

  // --- 3. Chart Block (SVG Choropleth) ---
  await _renderChoropleth(blocks.chart);

  // --- 4. Trend Block (FAO Food Price + Undernourishment dual-axis) ---
  _renderTrendCanvas(blocks.trend, undernourishmentTrend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block ---
  _renderComparison(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, latestEntry, tier, age) {
  const badge = createTierBadge(tier, { age });
  const formatted = Number(latestEntry.value).toFixed(1);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'hunger-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: toRgba(CHART_COLORS.crisis, 0.95),
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
          textContent: i18n.t('detail.hunger.heroUnit'),
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
          textContent: `${i18n.t('detail.hunger.heroLabel')} (${latestEntry.year})`,
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (SVG Choropleth of Malnutrition) -----------------------

async function _renderChoropleth(chartEl) {
  function tooltipFn(iso, val) {
    return `${iso}: ${val}%`;
  }

  const legendItems = [
    { color: '#ff3b30', label: '> 35% (Severe)' },
    { color: '#ff9500', label: '25-35% (High)' },
    { color: '#ffcc00', label: '15-25% (Moderate)' },
    { color: '#34c759', label: '5-15% (Low)' },
    { color: '#5ac8fa', label: '< 5% (Very low)' },
  ];

  const result = await renderChoropleth(chartEl, {
    dataMap: MALNUTRITION_BY_COUNTRY,
    colorFn: _malnutritionColor,
    tooltipFn,
    legendItems,
    title: i18n.t('detail.hunger.mapTitle'),
  });

  if (result && result.cleanup) {
    _choroplethCleanup = result.cleanup;
  }
}

// --- Trend Block (FAO Food Price Index + Undernourishment dual-axis) ----

function _renderTrendCanvas(trendEl, undernourishmentTrend) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.hunger.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'fao-price-chart' }),
      ]),
    ])
  );

  // Store undernourishment trend for lazy chart config
  _cacheData = { ..._cacheData, _undernourishmentTrend: undernourishmentTrend };
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl) {
  const tileData = [
    {
      label: i18n.t('detail.hunger.tileFoodInsecure'),
      value: '~735M',
      unit: '2024',
      accent: toRgba(CHART_COLORS.crisis, 0.95),
    },
    {
      label: i18n.t('detail.hunger.tileStunting'),
      value: '~22%',
      unit: '< 5 years',
      accent: '#ff9500',
    },
    {
      label: i18n.t('detail.hunger.tileWasting'),
      value: '~6.8%',
      unit: '< 5 years',
      accent: '#ffcc00',
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.hunger.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block (2000 vs 2023) ------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.hunger.comparisonLabel'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.hunger.comparison'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
      }),
      _buildComparisonBars(),
    ])
  );
}

function _buildComparisonBars() {
  const items = [
    { label: '2000', value: 13.2, color: toRgba(CHART_COLORS.crisis, 0.7) },
    { label: '2023', value: 8.5, color: toRgba(CHART_COLORS.crisis, 0.95) },
  ];

  const bars = items.map(({ label, value, color }) =>
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        marginBottom: 'var(--space-xs)',
      },
    }, [
      DOMUtils.create('span', {
        textContent: label,
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', width: '50px', flexShrink: '0' },
      }),
      DOMUtils.create('div', {
        style: {
          flex: '1',
          height: '24px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '4px',
          overflow: 'hidden',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${(value / 15) * 100}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '8px',
          },
        }, [
          DOMUtils.create('span', {
            textContent: `${value}%`,
            style: { color: '#fff', fontSize: '0.75rem', fontWeight: '600' },
          }),
        ]),
      ]),
    ])
  );

  return DOMUtils.create('div', {
    style: { marginTop: 'var(--space-sm)' },
  }, bars);
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.hunger.sourceFAO'),
      url: 'https://www.fao.org/faostat/',
    },
    {
      label: i18n.t('detail.hunger.sourceWorldBank'),
      url: 'https://data.worldbank.org/',
    },
    {
      label: 'UNICEF Data',
      url: 'https://data.unicef.org/',
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
          color: toRgba(CHART_COLORS.crisis, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.crisis, 0.3),
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
  const configs = [];

  // Build full year range covering both datasets (1990-2025)
  const allYears = FAO_FOOD_PRICE_INDEX.map(d => d.year);

  // Build undernourishment data aligned to allYears (starts at 2001)
  const undernourishmentTrend = _cacheData?._undernourishmentTrend ||
    _cacheData?.undernourishment_trend || [];
  const undernourishmentMap = {};
  for (const entry of undernourishmentTrend) {
    undernourishmentMap[entry.year] = entry.value;
  }
  const undernourishmentAligned = allYears.map(y => undernourishmentMap[y] ?? null);

  configs.push({
    canvasId: 'fao-price-chart',
    blockId: 'detail-trend',
    config: {
      type: 'line',
      data: {
        labels: allYears.map(y => String(y)),
        datasets: [
          {
            label: i18n.t('detail.hunger.trendTitle'),
            data: FAO_FOOD_PRICE_INDEX.map(d => d.value),
            borderColor: toRgba(CHART_COLORS.crisis),
            backgroundColor: toRgba(CHART_COLORS.crisis, 0.1),
            fill: true,
            tension: 0.3,
            pointRadius: 1,
            pointHitRadius: 8,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: i18n.t('detail.hunger.heroLabel'),
            data: undernourishmentAligned,
            borderColor: toRgba(CHART_COLORS.crisis, 0.5),
            backgroundColor: 'transparent',
            borderDash: [6, 3],
            tension: 0.3,
            pointRadius: 2,
            pointHitRadius: 8,
            borderWidth: 2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 10, maxRotation: 45 },
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: i18n.t('detail.hunger.foodPriceIndex'),
            },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: i18n.t('detail.hunger.heroLabel') + ' (%)',
            },
            grid: { drawOnChartArea: false },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                if (item.datasetIndex === 0) {
                  return `${item.dataset.label}: ${item.parsed.y.toFixed(1)}`;
                }
                return item.parsed.y !== null
                  ? `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`
                  : null;
              },
            },
          },
        },
        spanGaps: true,
      },
    },
  });

  return configs;
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }
  _cacheData = null;
  console.log('[Hunger] cleanup()');
}
