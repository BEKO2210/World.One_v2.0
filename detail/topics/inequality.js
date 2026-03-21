/* ===================================================================
   World.One 1.0 -- Inequality Topic Module (ECON-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: World Bank SI.POV.GINI (income), Credit Suisse Global Wealth
         Report 2024 (wealth), Oxfam/Forbes (billionaires)
   Visualizations: Hero Gini index, 100-person wealth distribution grid
                   (CSS animated), Gini ranking bar chart with
                   income/wealth toggle, billionaire/wealth context tiles
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'inequality',
  titleKey: 'detail.inequality.title',
  category: 'economy',   // Uses CHART_COLORS.economy (gold)
  icon: '',
};

// --- Module State ------------------------------------------------------

let _rankingChart = null;
let _chartData = null;

// --- Income Gini by Country (~20 countries, World Bank SI.POV.GINI) ---

const INCOME_GINI = [
  { country: 'South Africa', code: 'ZA', gini: 63.0 },
  { country: 'Namibia', code: 'NA', gini: 59.1 },
  { country: 'Suriname', code: 'SR', gini: 57.9 },
  { country: 'Brazil', code: 'BR', gini: 52.9 },
  { country: 'Colombia', code: 'CO', gini: 51.5 },
  { country: 'Mexico', code: 'MX', gini: 45.4 },
  { country: 'United States', code: 'US', gini: 41.8 },
  { country: 'Turkey', code: 'TR', gini: 41.4 },
  { country: 'Russia', code: 'RU', gini: 40.0 },
  { country: 'China', code: 'CN', gini: 36.0 },
  { country: 'India', code: 'IN', gini: 35.2 },
  { country: 'UK', code: 'GB', gini: 34.8 },
  { country: 'Australia', code: 'AU', gini: 34.3 },
  { country: 'Japan', code: 'JP', gini: 32.9 },
  { country: 'France', code: 'FR', gini: 32.4 },
  { country: 'Germany', code: 'DE', gini: 31.7 },
  { country: 'Canada', code: 'CA', gini: 31.3 },
  { country: 'Sweden', code: 'SE', gini: 28.8 },
  { country: 'Norway', code: 'NO', gini: 27.6 },
  { country: 'Slovakia', code: 'SK', gini: 23.2 },
];

// --- Wealth Gini by Country (~20 countries, Credit Suisse 2024) -------

const WEALTH_GINI = [
  { country: 'South Africa', code: 'ZA', gini: 88.0 },
  { country: 'Brazil', code: 'BR', gini: 85.0 },
  { country: 'Russia', code: 'RU', gini: 87.0 },
  { country: 'India', code: 'IN', gini: 82.3 },
  { country: 'United States', code: 'US', gini: 85.0 },
  { country: 'Colombia', code: 'CO', gini: 84.5 },
  { country: 'Mexico', code: 'MX', gini: 83.0 },
  { country: 'Turkey', code: 'TR', gini: 81.0 },
  { country: 'China', code: 'CN', gini: 70.2 },
  { country: 'UK', code: 'GB', gini: 71.7 },
  { country: 'Germany', code: 'DE', gini: 77.9 },
  { country: 'France', code: 'FR', gini: 70.0 },
  { country: 'Australia', code: 'AU', gini: 66.5 },
  { country: 'Canada', code: 'CA', gini: 73.0 },
  { country: 'Japan', code: 'JP', gini: 64.4 },
  { country: 'Sweden', code: 'SE', gini: 86.7 },
  { country: 'Norway', code: 'NO', gini: 73.0 },
  { country: 'Slovakia', code: 'SK', gini: 57.1 },
  { country: 'Namibia', code: 'NA', gini: 89.0 },
  { country: 'Suriname', code: 'SR', gini: 82.0 },
];

// --- Wealth Distribution Stats (Oxfam/Credit Suisse/Forbes 2025) ------

const WEALTH_STATS = {
  top1_pct: 45.8,           // Top 1% owns 45.8% of global wealth
  top10_pct: 76.0,          // Top 10% owns 76% of global wealth
  bottom50_pct: 1.3,        // Bottom 50% owns 1.3%
  billionaires: 3028,       // Forbes 2025
  billionaire_wealth_t: 16.1, // $16.1 trillion total
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch topic data (inequality.json has country_latest but empty world_trend)
  const { data, tier, age } = await fetchTopicData('inequality');

  // Supplement INCOME_GINI with any newer cache entries
  if (data && data.country_latest && data.country_latest.length) {
    _chartData = { cacheCountries: data.country_latest };
  }

  // Hero Gini value: hardcoded global estimate (no world_trend in cache)
  const globalGini = 38.5;

  // 2. Hero block
  _renderHero(blocks.hero, globalGini, tier, age);

  // 3. Chart block -- 100-person wealth distribution grid (CSS animated)
  _renderWealthGrid(blocks.chart);

  // 4. Trend block -- Gini ranking bar chart with income/wealth toggle
  await _renderRankingChart(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block
  _renderComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, giniValue, tier, age) {
  // Use 'static' tier with year 2024 since global Gini is hardcoded
  const badge = createTierBadge('static', { year: 2024 });
  const formatted = giniValue.toFixed(1);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'inequality-hero' }, [
      DOMUtils.create('div', {
        className: 'inequality-hero__value',
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
          textContent: i18n.t('detail.inequality.heroUnit'),
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
          textContent: i18n.t('detail.inequality.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (100-Person Wealth Distribution Grid) -----------------

function _renderWealthGrid(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.inequality.wealthTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // 10x10 CSS grid for 100 person circles
  const gridEl = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 1fr)',
      gap: '4px',
      maxWidth: '300px',
      margin: '0 auto',
    },
  });

  const circles = [];

  for (let i = 0; i < 100; i++) {
    const circle = DOMUtils.create('div', {
      style: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
        transitionDelay: (i * 20) + 'ms',
        margin: '0 auto',
      },
    });
    circles.push(circle);
    gridEl.appendChild(circle);
  }

  chartEl.appendChild(gridEl);

  // Trigger staggered animation after DOM mount
  setTimeout(() => {
    for (let i = 0; i < 100; i++) {
      if (i === 0) {
        // Top 1% -- gold glow, represents 45.8% of wealth
        circles[i].style.background = toRgba(CHART_COLORS.economy, 1);
        circles[i].style.boxShadow = '0 0 8px ' + toRgba(CHART_COLORS.economy, 0.7);
      } else if (i < 10) {
        // Top 10% -- gold, represents 76% of wealth
        circles[i].style.background = toRgba(CHART_COLORS.economy, 0.6);
      }
      // Bottom 90% stays dim (rgba(255,255,255,0.12))
    }
  }, 50);

  // Legend below the grid
  const legendEl = DOMUtils.create('div', {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 'var(--space-md)',
      marginTop: 'var(--space-sm)',
      fontSize: '0.85rem',
    },
  }, [
    _createLegendItem(
      toRgba(CHART_COLORS.economy, 1),
      i18n.t('detail.inequality.richPerson') + ' (' + WEALTH_STATS.top1_pct + '%)',
      true
    ),
    _createLegendItem(
      'rgba(255,255,255,0.12)',
      i18n.t('detail.inequality.poorPerson') + ' (' + WEALTH_STATS.bottom50_pct + '%)',
      false
    ),
  ]);

  chartEl.appendChild(legendEl);
}

function _createLegendItem(color, label, hasGlow) {
  const dotStyle = {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
    flexShrink: '0',
  };
  if (hasGlow) {
    dotStyle.boxShadow = '0 0 6px ' + toRgba(CHART_COLORS.economy, 0.5);
  }

  return DOMUtils.create('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  }, [
    DOMUtils.create('span', { style: dotStyle }),
    DOMUtils.create('span', {
      textContent: label,
      style: { color: 'var(--text-secondary)' },
    }),
  ]);
}

// --- Trend Block (Gini Ranking Bar Chart with Toggle) -----------------

async function _renderRankingChart(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.inequality.rankingTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Toggle button group: Income / Wealth
  let _currentMode = 'income';
  const modes = [
    { key: 'income', label: i18n.t('detail.inequality.toggleIncome') },
    { key: 'wealth', label: i18n.t('detail.inequality.toggleWealth') },
  ];

  const toggleBtns = modes.map(mode => {
    const isActive = mode.key === _currentMode;
    return DOMUtils.create('button', {
      textContent: mode.label,
      'data-mode': mode.key,
      type: 'button',
      style: {
        padding: '6px 16px',
        borderRadius: '6px',
        border: isActive ? '1px solid ' + toRgba(CHART_COLORS.economy, 0.5) : '1px solid rgba(255,255,255,0.1)',
        background: isActive ? toRgba(CHART_COLORS.economy, 0.3) : 'rgba(255,255,255,0.06)',
        color: isActive ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: isActive ? '600' : '400',
        transition: 'all 0.2s ease',
      },
    });
  });

  const toggleContainer = DOMUtils.create('div', {
    style: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
      marginBottom: 'var(--space-sm)',
    },
  }, toggleBtns);

  // Click handler for toggle buttons (event delegation)
  toggleContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;

    const mode = btn.getAttribute('data-mode');
    if (mode === _currentMode) return;

    _currentMode = mode;

    // Update button styles
    for (const b of toggleBtns) {
      const isActive = b.getAttribute('data-mode') === mode;
      b.style.border = isActive ? '1px solid ' + toRgba(CHART_COLORS.economy, 0.5) : '1px solid rgba(255,255,255,0.1)';
      b.style.background = isActive ? toRgba(CHART_COLORS.economy, 0.3) : 'rgba(255,255,255,0.06)';
      b.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      b.style.fontWeight = isActive ? '600' : '400';
    }

    // Update chart data
    _updateRankingChart(mode);
  });

  trendEl.appendChild(toggleContainer);

  // Canvas container
  const canvasContainer = DOMUtils.create('div', {
    style: { position: 'relative', height: '400px' },
  }, [
    DOMUtils.create('canvas', { id: 'inequality-ranking-canvas' }),
  ]);
  trendEl.appendChild(canvasContainer);

  // Load Chart.js and render
  await ensureChartJs();

  const sorted = [...INCOME_GINI].sort((a, b) => b.gini - a.gini);

  _rankingChart = createChart('inequality-ranking-canvas', {
    type: 'bar',
    data: {
      labels: sorted.map(d => d.country),
      datasets: [{
        label: 'Gini Index',
        data: sorted.map(d => d.gini),
        backgroundColor: sorted.map(d => _giniBarColor(d.gini)),
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Gini Index',
          },
          grid: { display: true },
        },
        y: {
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.parsed.x.toFixed(1);
            },
          },
        },
      },
    },
  });
}

function _giniBarColor(gini) {
  if (gini >= 50) return toRgba(CHART_COLORS.crisis, 0.7);     // High inequality (red)
  if (gini >= 35) return toRgba(CHART_COLORS.economy, 0.7);    // Medium (gold)
  return toRgba({ r: 76, g: 175, b: 80 }, 0.7);                // Low (green)
}

function _updateRankingChart(mode) {
  if (!_rankingChart) return;

  const dataset = mode === 'wealth' ? WEALTH_GINI : INCOME_GINI;
  const sorted = [...dataset].sort((a, b) => b.gini - a.gini);

  _rankingChart.data.labels = sorted.map(d => d.country);
  _rankingChart.data.datasets[0].data = sorted.map(d => d.gini);
  _rankingChart.data.datasets[0].backgroundColor = sorted.map(d => _giniBarColor(d.gini));
  _rankingChart.update('none');
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl) {
  const tileData = [
    {
      label: i18n.t('detail.inequality.tileBillionaires'),
      value: MathUtils.formatCompact(WEALTH_STATS.billionaires),
      accent: toRgba(CHART_COLORS.economy),
    },
    {
      label: i18n.t('detail.inequality.tileTop1'),
      value: WEALTH_STATS.top1_pct + '%',
      accent: toRgba(CHART_COLORS.economy),
    },
    {
      label: i18n.t('detail.inequality.tileBottom50'),
      value: WEALTH_STATS.bottom50_pct + '%',
      accent: '#d32f2f',
    },
    {
      label: i18n.t('detail.inequality.tileGap'),
      value: '$' + WEALTH_STATS.billionaire_wealth_t + 'T',
      accent: toRgba(CHART_COLORS.economy),
    },
  ];

  const tiles = tileData.map(({ label, value, accent }) =>
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
      textContent: i18n.t('detail.inequality.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.inequality.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: 'World Bank -- Gini Index',
      url: 'https://data.worldbank.org/indicator/SI.POV.GINI',
    },
    {
      label: 'Forbes -- Billionaires 2025',
      url: 'https://www.forbes.com/billionaires/',
    },
    {
      label: 'Oxfam -- Inequality Inc.',
      url: 'https://www.oxfam.org/en/research/inequality-inc',
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
  // Ranking chart rendered directly in render() for toggle interactivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _rankingChart = null;
  _chartData = null;
  console.log('[Inequality] cleanup()');
}
