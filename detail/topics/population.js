/* ===================================================================
   World.One 2.0 -- Population Topic Module (SOC-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: UN DESA World Population Prospects 2024, World Bank
   Visualizations: Live counter, Births/Deaths clock, Population
                   Pyramid (Chart.js horizontal bar), Urbanization
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'population',
  titleKey: 'detail.population.title',
  category: 'society',
  icon: '',
  supportsTimeRange: true,
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _chartData = null;
let _pyramidChart = null;
let _currentPyramidYear = 2026;

// --- Population Pyramid Data (UN DESA WPP 2024, millions) ---------------

const PYRAMID_DATA = {
  1960: {
    labels: ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+'],
    male:   [165, 148, 131, 118, 107, 97, 87, 78, 69, 59, 49, 39, 29, 20, 12, 6, 3],
    female: [158, 142, 126, 114, 104, 95, 86, 78, 70, 61, 51, 41, 31, 22, 14, 8, 4],
  },
  2000: {
    labels: ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+'],
    male:   [310, 303, 302, 291, 277, 264, 247, 223, 195, 173, 149, 120, 96, 71, 47, 25, 13],
    female: [293, 287, 285, 276, 264, 254, 240, 219, 194, 173, 152, 125, 103, 80, 57, 34, 21],
  },
  2026: {
    labels: ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+'],
    male:   [342, 346, 349, 345, 340, 337, 338, 325, 303, 276, 249, 225, 195, 155, 114, 73, 48],
    female: [322, 326, 329, 327, 324, 323, 327, 318, 300, 277, 254, 233, 206, 170, 131, 91, 72],
  },
  2050: {
    labels: ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+'],
    male:   [363, 364, 362, 357, 352, 349, 347, 346, 343, 338, 330, 314, 293, 262, 223, 169, 125],
    female: [342, 343, 341, 337, 334, 333, 333, 334, 334, 332, 328, 318, 303, 278, 246, 199, 172],
  },
};

const PYRAMID_YEARS = [1960, 2000, 2026, 2050];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch population data
  const { data, tier, age } = await fetchTopicData('population');

  // Extract latest population from cache or use static fallback
  let latestPop = 8100000000;
  let growthRate = 0.009; // 0.9%
  let urbanPercent = 57;
  let urbanSeries = [];

  if (data) {
    if (data.total && data.total.length > 0) {
      latestPop = data.total[data.total.length - 1].value;
    }
    if (data.urban_percent && data.urban_percent.length > 0) {
      urbanSeries = data.urban_percent;
      urbanPercent = data.urban_percent[data.urban_percent.length - 1].value;
    }
  }

  // Store data for getChartConfigs
  _chartData = { urbanSeries };

  // 2. Hero block -- Live Population Counter
  _renderHero(blocks.hero, latestPop, growthRate, tier, age);

  // 3. Chart block -- Births/Deaths Clock
  _renderBirthsDeathsClock(blocks.chart);

  // 4. Trend block -- Population Pyramid
  await _renderPyramid(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles, growthRate, urbanPercent);

  // 6. Comparison block -- Urbanization chart canvas
  _renderUrbanization(blocks.comparison);

  // 7. Explanation block
  _renderExplanation(blocks.explanation);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero (Live Counter) ------------------------------------------------

function _renderHero(heroEl, latestPop, growthRate, tier, age) {
  const perSecond = (latestPop * growthRate) / (365.25 * 24 * 3600);
  const startTime = Date.now();
  const badge = createTierBadge(tier, { age });

  const counterEl = DOMUtils.create('div', {
    className: 'pop-counter',
    style: {
      fontSize: '2.5rem',
      fontWeight: '700',
      color: 'var(--text-primary)',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: '1.2',
      marginBottom: 'var(--space-xs)',
    },
  });

  const update = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const current = Math.round(latestPop + elapsed * perSecond);
    counterEl.textContent = MathUtils.formatNumber(current);
  };
  update();
  _intervals.push(setInterval(update, 1000));

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'pop-hero' }, [
      counterEl,
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-sm)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.population.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('div', {
        textContent: i18n.t('detail.population.liveCounter'),
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: '0.7' },
      }),
    ])
  );
}

// --- Births/Deaths Clock ------------------------------------------------

function _renderBirthsDeathsClock(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: `${i18n.t('detail.population.births')} & ${i18n.t('detail.population.deaths')}`,
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const BIRTHS_PER_SEC = 4.3;
  const DEATHS_PER_SEC = 1.8;
  const startTime = Date.now();

  // Births counter
  let birthCount = 0;
  const birthCountEl = DOMUtils.create('div', {
    style: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#34c759',
      fontVariantNumeric: 'tabular-nums',
    },
    textContent: '0',
  });

  // Deaths counter
  let deathCount = 0;
  const deathCountEl = DOMUtils.create('div', {
    style: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#ff3b30',
      fontVariantNumeric: 'tabular-nums',
    },
    textContent: '0',
  });

  const updateBirths = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    birthCount = Math.round(elapsed * BIRTHS_PER_SEC);
    birthCountEl.textContent = MathUtils.formatNumber(birthCount);
  };

  const updateDeaths = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    deathCount = Math.round(elapsed * DEATHS_PER_SEC);
    deathCountEl.textContent = MathUtils.formatNumber(deathCount);
  };

  _intervals.push(setInterval(updateBirths, 1000));
  _intervals.push(setInterval(updateDeaths, 1000));

  const birthsBox = DOMUtils.create('div', {
    style: {
      flex: '1',
      padding: 'var(--space-sm)',
      background: 'rgba(52, 199, 89, 0.08)',
      borderRadius: '8px',
      border: '1px solid rgba(52, 199, 89, 0.2)',
      textAlign: 'center',
    },
  }, [
    DOMUtils.create('div', {
      textContent: i18n.t('detail.population.births'),
      style: { color: 'rgba(52, 199, 89, 0.9)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' },
    }),
    birthCountEl,
    DOMUtils.create('div', {
      textContent: `~${BIRTHS_PER_SEC}${i18n.t('detail.population.perSecond')}`,
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' },
    }),
  ]);

  const deathsBox = DOMUtils.create('div', {
    style: {
      flex: '1',
      padding: 'var(--space-sm)',
      background: 'rgba(255, 59, 48, 0.08)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 59, 48, 0.2)',
      textAlign: 'center',
    },
  }, [
    DOMUtils.create('div', {
      textContent: i18n.t('detail.population.deaths'),
      style: { color: 'rgba(255, 59, 48, 0.9)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' },
    }),
    deathCountEl,
    DOMUtils.create('div', {
      textContent: `~${DEATHS_PER_SEC}${i18n.t('detail.population.perSecond')}`,
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' },
    }),
  ]);

  const clockRow = DOMUtils.create('div', {
    style: {
      display: 'flex',
      gap: 'var(--space-sm)',
      marginBottom: 'var(--space-sm)',
    },
  }, [birthsBox, deathsBox]);

  chartEl.appendChild(clockRow);

  // Net growth text
  const netGrowth = (BIRTHS_PER_SEC - DEATHS_PER_SEC).toFixed(1);
  chartEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.population.netGrowth', { count: netGrowth }),
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' },
    })
  );
}

// --- Population Pyramid (Chart.js horizontal bar) -----------------------

async function _renderPyramid(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.population.pyramidTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Compact inline year selector — single row of pill buttons
  const yearBtns = PYRAMID_YEARS.map(year => {
    const isActive = year === _currentPyramidYear;
    const label = year === 2050 ? `${year}*` : String(year);
    return DOMUtils.create('button', {
      textContent: label,
      'data-year': String(year),
      type: 'button',
      style: {
        padding: '4px 12px',
        borderRadius: '20px',
        border: 'none',
        background: isActive ? toRgba(CHART_COLORS.society, 0.2) : 'transparent',
        color: isActive ? toRgba(CHART_COLORS.society) : 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: isActive ? '700' : '400',
        fontFamily: 'var(--font-mono)',
        transition: 'all 0.15s ease',
      },
    });
  });

  const yearSelector = DOMUtils.create('div', {
    style: {
      display: 'inline-flex',
      gap: '2px',
      marginBottom: 'var(--space-sm)',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '24px',
      padding: '3px',
    },
  }, yearBtns);

  // Click handler
  yearSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-year]');
    if (!btn) return;
    const year = parseInt(btn.getAttribute('data-year'), 10);
    if (year === _currentPyramidYear) return;
    _currentPyramidYear = year;
    for (const b of yearBtns) {
      const isActive = parseInt(b.getAttribute('data-year'), 10) === year;
      b.style.background = isActive ? toRgba(CHART_COLORS.society, 0.2) : 'transparent';
      b.style.color = isActive ? toRgba(CHART_COLORS.society) : 'var(--text-muted)';
      b.style.fontWeight = isActive ? '700' : '400';
    }
    _updatePyramid(year);
  });

  trendEl.appendChild(yearSelector);

  // Canvas container
  const canvasContainer = DOMUtils.create('div', {
    style: { position: 'relative', height: 'min(450px, 60vh)' },
  }, [
    DOMUtils.create('canvas', { id: 'pop-pyramid-canvas' }),
  ]);
  trendEl.appendChild(canvasContainer);

  // Load Chart.js and create pyramid
  await ensureChartJs();
  _pyramidChart = createChart('pop-pyramid-canvas', _buildPyramidConfig(_currentPyramidYear));

  // Listen for timerangechange
  trendEl.addEventListener('timerangechange', (e) => {
    const range = e.detail.range;
    const rangeMap = { '1y': 2026, '5y': 2000, '20y': 1960, 'max': 2050 };
    const year = rangeMap[range] || 2026;
    if (year !== _currentPyramidYear) {
      _currentPyramidYear = year;
      for (const b of yearBtns) {
        const isActive = parseInt(b.getAttribute('data-year'), 10) === year;
        b.style.background = isActive ? toRgba(CHART_COLORS.society, 0.2) : 'transparent';
        b.style.color = isActive ? toRgba(CHART_COLORS.society) : 'var(--text-muted)';
        b.style.fontWeight = isActive ? '700' : '400';
      }
      _updatePyramid(year);
    }
  });
}

function _buildPyramidConfig(year) {
  const d = PYRAMID_DATA[year];
  // Male values as negative (left side), female as positive (right side)
  const maleData = d.male.map(v => -v);
  const femaleData = d.female;

  return {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        {
          label: i18n.t('detail.population.male'),
          data: maleData,
          backgroundColor: toRgba(CHART_COLORS.progress, 0.7),
          borderColor: toRgba(CHART_COLORS.progress),
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: i18n.t('detail.population.female'),
          data: femaleData,
          backgroundColor: toRgba(CHART_COLORS.society, 0.7),
          borderColor: toRgba(CHART_COLORS.society),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          stacked: false,
          ticks: {
            callback: (val) => MathUtils.formatCompact(Math.abs(val)),
          },
          title: {
            display: true,
            text: i18n.t('detail.population.chartAxisLabel'),
          },
          grid: {
            color: 'rgba(255,255,255,0.04)',
          },
        },
        y: {
          stacked: false,
          grid: { display: false },
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { size: 11 },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.dataset.label;
              const val = Math.abs(ctx.raw);
              return `${label}: ${MathUtils.formatCompact(val)}`;
            },
          },
        },
      },
    },
  };
}

function _updatePyramid(year) {
  if (!_pyramidChart) return;
  const d = PYRAMID_DATA[year];
  if (!d) return;

  _pyramidChart.data.labels = d.labels;
  _pyramidChart.data.datasets[0].data = d.male.map(v => -v);
  _pyramidChart.data.datasets[1].data = d.female;
  _pyramidChart.update();
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, growthRate, urbanPercent) {
  const tileData = [
    {
      label: i18n.t('detail.population.tileGrowthRate'),
      value: `${(growthRate * 100).toFixed(1)}%`,
      unit: '/yr',
    },
    {
      label: i18n.t('detail.population.tileBirthsPerSec'),
      value: '~4.3',
      unit: '',
    },
    {
      label: i18n.t('detail.population.tileDeathsPerSec'),
      value: '~1.8',
      unit: '',
    },
    {
      label: i18n.t('detail.population.tileUrbanPercent'),
      value: `${Math.round(urbanPercent)}%`,
      unit: '',
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Urbanization Chart (Comparison block) --------------------------------

function _renderUrbanization(compEl) {
  compEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.population.urbanTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  compEl.appendChild(
    DOMUtils.create('div', {
      style: { position: 'relative', height: '300px' },
    }, [
      DOMUtils.create('canvas', { id: 'pop-urban-canvas' }),
    ])
  );

  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.population.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginTop: 'var(--space-sm)' },
    })
  );
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  const paragraphs = [
    i18n.t('detail.population.explainP1'),
    i18n.t('detail.population.explainP2'),
    i18n.t('detail.population.explainP3'),
  ];

  explEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.population.explainTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      ...paragraphs.map(text =>
        DOMUtils.create('p', {
          textContent: text,
          style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6', fontSize: '0.9rem' },
        })
      ),
    ])
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.population.sourceUN'),
      url: 'https://population.un.org/wpp/',
    },
    {
      label: i18n.t('detail.population.sourceWorldBank'),
      url: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
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
          borderBottom: `1px solid ${toRgba(CHART_COLORS.society, 0.3)}`,
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

// --- Chart Configs (lazy-loaded urbanization chart) ----------------------

export function getChartConfigs() {
  const configs = [];

  // Urbanization line chart
  if (_chartData && _chartData.urbanSeries && _chartData.urbanSeries.length > 0) {
    const labels = _chartData.urbanSeries.map(d => d.year);
    const values = _chartData.urbanSeries.map(d => d.value);

    configs.push({
      canvasId: 'pop-urban-canvas',
      blockId: 'detail-comparison',
      config: {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: i18n.t('detail.population.urbanTitle'),
            data: values,
            borderColor: toRgba(CHART_COLORS.society),
            backgroundColor: toRgba(CHART_COLORS.society, 0.1),
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHitRadius: 4,
            borderWidth: 2,
          }],
        },
        options: {
          scales: {
            x: {
              ticks: {
                callback: function (val, idx) {
                  const label = this.getLabelForValue(val);
                  const year = parseInt(label, 10);
                  if (year % 10 === 0) return year;
                  return null;
                },
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: false,
              min: 30,
              max: 70,
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
                label: (item) => `${item.parsed.y.toFixed(1)}%`,
              },
            },
          },
        },
      },
    });
  }

  return configs;
}

// --- Cleanup --------------------------------------------------------------

export function cleanup() {
  // CRITICAL: Clear ALL interval IDs (3 intervals: live counter, births, deaths)
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _chartData = null;

  // Null pyramid chart reference (detail-app.js destroyAllCharts handles actual destruction)
  _pyramidChart = null;
  _currentPyramidYear = 2026;

  console.log('[Population] cleanup()');
}
