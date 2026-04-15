/* ===================================================================
   World.One 2.0 -- Forests Topic Module (ENV-05)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: World Bank/FAO (forest cover %, annual net loss, deforestation
         causes), FAO Global Forest Resources Assessment
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'forests',
  titleKey: 'detail.forests.title',
  category: 'environment',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null;

// --- Annual Forest Loss (World Bank/FAO, million hectares net loss) -----
// Negative values = net loss. Trend shows gradual improvement 2001-2022.

const FOREST_LOSS = [
  { year: 2001, value: -7.8 },
  { year: 2002, value: -7.5 },
  { year: 2003, value: -7.2 },
  { year: 2004, value: -7.6 },
  { year: 2005, value: -7.3 },
  { year: 2006, value: -6.8 },
  { year: 2007, value: -6.5 },
  { year: 2008, value: -6.1 },
  { year: 2009, value: -5.8 },
  { year: 2010, value: -5.2 },
  { year: 2011, value: -5.5 },
  { year: 2012, value: -5.8 },
  { year: 2013, value: -6.0 },
  { year: 2014, value: -5.5 },
  { year: 2015, value: -5.0 },
  { year: 2016, value: -5.2 },
  { year: 2017, value: -4.8 },
  { year: 2018, value: -4.7 },
  { year: 2019, value: -4.7 },
  { year: 2020, value: -4.7 },
  { year: 2021, value: -4.1 },
  { year: 2022, value: -3.7 },
];

// --- Deforestation Causes (FAO Global Forest Resources Assessment) ------

const DEFORESTATION_CAUSES = [
  { cause: 'Agriculture expansion', pct: 73, color: '#e65100' },
  { cause: 'Logging (commercial)', pct: 10, color: '#795548' },
  { cause: 'Wildfires', pct: 8, color: '#f44336' },
  { cause: 'Urbanization', pct: 5, color: '#9e9e9e' },
  { cause: 'Infrastructure', pct: 4, color: '#607d8b' },
];

// --- Top 5 Countries by Forest Area (FAO 2020) -------------------------

const TOP_FOREST_COUNTRIES = [
  { country: 'Russia', area: 815 },
  { country: 'Brazil', area: 497 },
  { country: 'Canada', area: 347 },
  { country: 'USA', area: 310 },
  { country: 'China', area: 220 },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached forest data
  const { data, tier, age } = await fetchTopicData('forests');

  // Extract forest cover percentage (supports nested { forest_cover_pct: {...} } and flat legacy shape)
  let forestCover = 31.2;
  const point = data?.forest_cover_pct ?? data;
  if (point && point.value != null) {
    forestCover = point.value;
  }

  // 2. Hero block
  _renderHero(blocks.hero, forestCover, tier, age);

  // 3. Chart block -- Annual Forest Loss
  await _renderLossChart(blocks.chart);

  // 4. Trend block -- Deforestation Causes (canvas placeholder for lazy loading)
  _renderCausesBlock(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Top 5 countries + text
  _renderComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, forestCover, tier, age) {
  const badge = createTierBadge(tier, { age });
  const formatted = typeof forestCover === 'number' ? forestCover.toFixed(1) : String(forestCover);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'forests-hero' }, [
      DOMUtils.create('div', {
        className: 'forests-hero__value',
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
          textContent: i18n.t('detail.forests.heroUnit'),
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
          textContent: i18n.t('detail.forests.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (Annual Forest Loss) -----------------------------------

async function _renderLossChart(chartEl) {
  const labels = FOREST_LOSS.map(d => d.year.toString());
  const values = FOREST_LOSS.map(d => Math.abs(d.value));

  _chartData = { labels, values };

  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.forests.lossTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'forests-loss-chart' }),
      ]),
    ])
  );

  // Render bar chart directly for timerangechange interactivity
  await ensureChartJs();

  const barColor = toRgba({ r: 211, g: 47, b: 47 }, 0.8);
  const borderColor = toRgba({ r: 211, g: 47, b: 47 }, 1);

  createChart('forests-loss-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: i18n.t('detail.forests.netLossLabel'),
        data: values,
        backgroundColor: barColor,
        borderColor: borderColor,
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            callback: function (val, idx) {
              const label = this.getLabelForValue(val);
              const year = parseInt(label, 10);
              // Show every 3rd year to avoid crowding
              if (year % 3 === 0) return label;
              return null;
            },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: i18n.t('detail.forests.yAxisLabel'),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => i18n.t('detail.forests.tooltipLoss', { value: item.parsed.y.toFixed(1) }),
          },
        },
      },
    },
  });

  // Listen for timerangechange event
  chartEl.addEventListener('timerangechange', (e) => {
    console.log('[Forests] timerangechange received:', e.detail?.range);
  });
}

// --- Trend Block (Deforestation Causes - canvas for lazy loading) --------

function _renderCausesBlock(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.forests.causesTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:120px;',
      }, [
        DOMUtils.create('canvas', { id: 'forests-causes-chart' }),
      ]),
    ])
  );
}

// --- Tiles Block ---------------------------------------------------------

function _renderTiles(tilesEl) {
  const tileData = [
    {
      label: i18n.t('detail.forests.tileLoss'),
      value: '-3.7M ha',
      unit: '2022',
    },
    {
      label: i18n.t('detail.forests.tileArea'),
      value: '4.06B ha',
      unit: 'total',
    },
    {
      label: i18n.t('detail.forests.tilePrimary'),
      value: '34%',
      unit: 'of total forest',
    },
    {
      label: i18n.t('detail.forests.tileRate'),
      value: '-0.09%',
      unit: '/year',
      accent: '#d32f2f',
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

// --- Explanation Block ----------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.forests.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block (Top 5 Countries + Text) ---------------------------

function _renderComparison(compEl) {
  // Comparison text
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.forests.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: 'var(--space-sm)' },
    })
  );

  // Top 5 countries by forest area -- proportional bars
  const maxArea = TOP_FOREST_COUNTRIES[0].area;

  const items = TOP_FOREST_COUNTRIES.map((c, idx) => {
    const widthPct = (c.area / maxArea) * 100;
    return DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        marginBottom: '0.5rem',
      },
    }, [
      // Rank number
      DOMUtils.create('span', {
        textContent: `${idx + 1}.`,
        style: {
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          fontWeight: '600',
          width: '1.5rem',
          textAlign: 'right',
          flexShrink: '0',
        },
      }),
      // Country name
      DOMUtils.create('span', {
        textContent: c.country,
        style: {
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          width: '4.5rem',
          flexShrink: '0',
        },
      }),
      // Proportional bar
      DOMUtils.create('div', {
        style: {
          flex: '1',
          height: '20px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '4px',
          overflow: 'hidden',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${widthPct}%`,
            height: '100%',
            background: toRgba({ r: 46, g: 125, b: 50 }, 0.7),
            borderRadius: '4px',
            transition: 'width 0.5s ease',
          },
        }),
      ]),
      // Area value
      DOMUtils.create('span', {
        textContent: `${c.area}M ha`,
        style: {
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          width: '5rem',
          textAlign: 'right',
          flexShrink: '0',
        },
      }),
    ]);
  });

  compEl.appendChild(
    DOMUtils.create('div', {
      style: { marginTop: 'var(--space-xs)' },
    }, items)
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.forests.sourceWB'),
      url: 'https://data.worldbank.org/indicator/AG.LND.FRST.ZS',
    },
    {
      label: i18n.t('detail.forests.sourceFAO'),
      url: 'https://www.fao.org/forest-resources-assessment',
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
  // Deforestation causes stacked bar -- lazy loaded
  return [{
    canvasId: 'forests-causes-chart',
    blockId: 'trend',
    config: {
      type: 'bar',
      data: {
        labels: ['Causes'],
        datasets: DEFORESTATION_CAUSES.map(c => ({
          label: c.cause,
          data: [c.pct],
          backgroundColor: c.color,
          borderColor: c.color,
          borderWidth: 0,
          borderSkipped: false,
        })),
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true,
            max: 100,
            title: {
              display: true,
              text: '%',
            },
            grid: { display: false },
          },
          y: {
            stacked: true,
            display: false,
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.parsed.x}%`,
            },
          },
        },
      },
    },
  }];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _chartData = null;
  console.log('[Forests] cleanup()');
}
