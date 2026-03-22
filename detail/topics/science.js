/* ===================================================================
   World.One 2.0 -- Science Topic Module (PROG-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: arXiv cache (arxiv-ai.json), hardcoded annual submissions,
         Nobel Prize counts by country
   Visualizations: Total papers hero, exponential growth curve,
                   hot research fields bar, Nobel bubble chart
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'science',
  titleKey: 'detail.science.title',
  category: 'progress',
  icon: '',
  supportsTimeRange: true,
};

// --- Module State ------------------------------------------------------

let _chartData = null;   // Full annual submission data for time range filtering
let _growthChart = null;  // Directly rendered growth chart (timerangechange)

// --- Hardcoded Annual arXiv Submissions (1991-2025) --------------------
// Source: arXiv.org submission statistics, approximate annual totals
// Anchor points with linear interpolation for intermediate years

function _buildAnnualData() {
  const anchors = [
    [1991, 3000], [1995, 20000], [2000, 40000], [2005, 55000],
    [2010, 75000], [2012, 85000], [2014, 100000], [2016, 120000],
    [2018, 150000], [2019, 165000], [2020, 190000], [2021, 210000],
    [2022, 230000], [2023, 250000], [2024, 270000], [2025, 290000],
  ];

  const result = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [y1, v1] = anchors[i];
    const [y2, v2] = anchors[i + 1];
    for (let y = y1; y < y2; y++) {
      const t = (y - y1) / (y2 - y1);
      result.push({ year: y, value: Math.round(v1 + t * (v2 - v1)) });
    }
  }
  // Add last anchor
  const last = anchors[anchors.length - 1];
  result.push({ year: last[0], value: last[1] });
  return result;
}

const ANNUAL_SUBMISSIONS = _buildAnnualData();

// --- Nobel Prize Data (Top 15 countries, all-time as of 2024) ---------
// Source: Nobel Prize Committee / Wikipedia

const NOBEL_DATA = [
  { country: 'USA', count: 400 },
  { country: 'UK', count: 137 },
  { country: 'Germany', count: 112 },
  { country: 'France', count: 72 },
  { country: 'Sweden', count: 32 },
  { country: 'Switzerland', count: 28 },
  { country: 'Japan', count: 28 },
  { country: 'Russia', count: 27 },
  { country: 'Canada', count: 26 },
  { country: 'Austria', count: 22 },
  { country: 'Netherlands', count: 22 },
  { country: 'Italy', count: 20 },
  { country: 'Denmark', count: 14 },
  { country: 'Norway', count: 13 },
  { country: 'Australia', count: 12 },
];

// --- Category Mapping for arXiv Papers --------------------------------

const CATEGORY_MAP = {
  'cs.AI': 'AI & ML', 'cs.LG': 'AI & ML', 'cs.CL': 'AI & ML', 'cs.CV': 'AI & ML',
};

function _mapCategory(cat) {
  if (!cat) return 'Other';
  if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
  if (cat.startsWith('physics')) return 'Physics';
  if (cat.startsWith('math')) return 'Mathematics';
  if (cat.startsWith('stat')) return 'Statistics';
  if (cat.startsWith('q-bio')) return 'Biology';
  if (cat.startsWith('cond-mat')) return 'Materials';
  if (cat.startsWith('astro-ph')) return 'Astrophysics';
  if (cat.startsWith('econ')) return 'Economics';
  if (cat.startsWith('cs.')) return 'AI & ML'; // Most cs.* papers are ML-adjacent
  return 'Other';
}

// --- Bubble Color Palette ---------------------------------------------

const BUBBLE_PALETTE = [
  '#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8',
  '#4dd0e1', '#aed581', '#ffd54f', '#ff8a65', '#ce93d8',
  '#26c6da', '#9ccc65', '#ffca28', '#ef5350', '#ab47bc',
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached arXiv data
  const { data, tier, age } = await fetchTopicData('science');
  const papers = (data && data.papers) ? data.papers : [];

  // Store full annual data for time range
  _chartData = ANNUAL_SUBMISSIONS;

  // 2. Hero block
  _renderHero(blocks.hero, papers, tier, age);

  // 3. Chart block -- Exponential growth curve (directly rendered for timerangechange)
  await _renderGrowthCurve(blocks.chart);

  // 4. Trend block -- Hot research fields bar chart canvas placeholder
  _renderFieldsPlaceholder(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block
  _renderComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);

  // Store chart data for getChartConfigs (fields + Nobel)
  _chartData = {
    annual: ANNUAL_SUBMISSIONS,
    papers,
  };
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, papers, tier, age) {
  const badge = createTierBadge(tier, { age });
  const totalPapers = '~2,990,000';
  const dailySubs = '~1,800';

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'science-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [totalPapers]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.science.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginTop: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: dailySubs,
          style: {
            color: toRgba(CHART_COLORS.progress),
            fontSize: '1.25rem',
            fontWeight: '600',
          },
        }),
        DOMUtils.create('span', {
          textContent: i18n.t('detail.science.tileDaily'),
          style: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
        }),
      ]),
    ])
  );
}

// --- Growth Curve (Chart block, directly rendered) -----------------------

async function _renderGrowthCurve(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.science.growthTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'science-growth-canvas' }),
      ]),
    ])
  );

  await ensureChartJs();
  _growthChart = _createGrowthChart(ANNUAL_SUBMISSIONS);

  // Listen for time range changes
  chartEl.addEventListener('timerangechange', (e) => {
    const range = e.detail?.range;
    if (!range || !_growthChart) return;

    const currentYear = new Date().getFullYear();
    let filtered;

    if (range === '1y') {
      filtered = ANNUAL_SUBMISSIONS.filter(d => d.year >= currentYear - 1);
      if (filtered.length < 2) filtered = ANNUAL_SUBMISSIONS.slice(-2);
    } else if (range === '5y') {
      filtered = ANNUAL_SUBMISSIONS.filter(d => d.year >= currentYear - 5);
    } else if (range === '20y') {
      filtered = ANNUAL_SUBMISSIONS.filter(d => d.year >= currentYear - 20);
    } else {
      filtered = ANNUAL_SUBMISSIONS;
    }

    _growthChart.data.labels = filtered.map(d => String(d.year));
    _growthChart.data.datasets[0].data = filtered.map(d => d.value);
    _growthChart.update('none');
  });
}

function _createGrowthChart(data) {
  return createChart('science-growth-canvas', {
    type: 'line',
    data: {
      labels: data.map(d => String(d.year)),
      datasets: [{
        label: i18n.t('detail.science.heroUnit'),
        data: data.map(d => d.value),
        borderColor: toRgba(CHART_COLORS.progress),
        backgroundColor: toRgba(CHART_COLORS.progress, 0.15),
        fill: true,
        tension: 0.3,
        pointRadius: 1,
        pointHitRadius: 8,
        pointBackgroundColor: toRgba(CHART_COLORS.progress),
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
          beginAtZero: true,
          title: {
            display: true,
            text: i18n.t('detail.science.heroUnit'),
          },
          ticks: {
            callback: (val) => MathUtils.formatCompact(val),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${MathUtils.formatCompact(item.parsed.y)} ${i18n.t('detail.science.heroUnit')}`,
          },
        },
      },
    },
  });
}

// --- Fields Bar Chart Placeholder (Trend block) --------------------------

function _renderFieldsPlaceholder(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.science.fieldsTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'science-fields-canvas' }),
      ]),
    ])
  );

  // Nobel bubble chart placeholder below
  trendEl.appendChild(
    DOMUtils.create('div', {
      style: { marginTop: 'var(--space-md)' },
    }, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.science.nobelTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:400px;',
      }, [
        DOMUtils.create('canvas', { id: 'science-nobel-canvas' }),
      ]),
    ])
  );
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl) {
  const growthFactor = Math.round(ANNUAL_SUBMISSIONS[ANNUAL_SUBMISSIONS.length - 1].value / ANNUAL_SUBMISSIONS[0].value);

  const tileData = [
    {
      label: i18n.t('detail.science.tileDaily'),
      value: '~1,800',
      unit: i18n.t('detail.science.heroUnit'),
      accent: toRgba(CHART_COLORS.progress),
    },
    {
      label: i18n.t('detail.science.tileGrowth'),
      value: `${growthFactor}x`,
      unit: 'since 1991',
      accent: '#4caf50',
    },
    {
      label: i18n.t('detail.science.tileFields'),
      value: '8+',
      unit: i18n.t('detail.science.fieldsTitle'),
    },
    {
      label: i18n.t('detail.science.tileTotal'),
      value: '~2.99M',
      unit: i18n.t('detail.science.heroUnit'),
      accent: toRgba(CHART_COLORS.progress),
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
      textContent: i18n.t('detail.science.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.science.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.science.sourceArxiv'),
      url: 'https://arxiv.org/stats/monthly_submissions',
    },
    {
      label: i18n.t('detail.science.sourceNobel'),
      url: 'https://www.nobelprize.org/',
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
          color: toRgba(CHART_COLORS.progress, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.progress, 0.3),
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

// --- Chart Configs (lazy-loaded fields bar + Nobel bubble) ---------------

export function getChartConfigs() {
  const configs = [];

  // --- Hot Research Fields Horizontal Bar Chart ---
  const papers = (_chartData && _chartData.papers) ? _chartData.papers : [];
  let fieldCounts = {};

  // Count categories from cached papers
  for (const paper of papers) {
    const cat = paper.primary_category || null;
    const field = _mapCategory(cat);
    fieldCounts[field] = (fieldCounts[field] || 0) + 1;
  }

  // Check if we have enough categorized papers
  const totalCategorized = Object.values(fieldCounts).reduce((a, b) => a + b, 0);
  if (totalCategorized < 5) {
    // Fallback to hardcoded distribution
    fieldCounts = {
      'AI & ML': 45, 'Physics': 20, 'Mathematics': 15,
      'Statistics': 8, 'Biology': 5, 'Other': 7,
    };
  }

  // Sort descending
  const sortedFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1]);

  const fieldLabels = sortedFields.map(([f]) => f);
  const fieldValues = sortedFields.map(([, v]) => v);
  const fieldColors = fieldLabels.map((_, i) =>
    toRgba(CHART_COLORS.progress, 0.3 + (0.7 * (1 - i / fieldLabels.length)))
  );

  configs.push({
    canvasId: 'science-fields-canvas',
    blockId: 'detail-trend',
    config: {
      type: 'bar',
      data: {
        labels: fieldLabels,
        datasets: [{
          label: i18n.t('detail.science.fieldsTitle'),
          data: fieldValues,
          backgroundColor: fieldColors,
          borderColor: toRgba(CHART_COLORS.progress),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: i18n.t('detail.science.heroUnit'),
            },
            grid: {
              color: 'rgba(255,255,255,0.04)',
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: 'rgba(255,255,255,0.7)',
              font: { size: 12 },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.parsed.x} ${i18n.t('detail.science.heroUnit')}`,
            },
          },
        },
      },
    },
  });

  // --- Nobel Prizes Bubble Chart ---
  const nobelLabels = NOBEL_DATA.map(d => d.country);
  const maxCount = NOBEL_DATA[0].count;
  const maxRadius = 30;

  const bubbleData = NOBEL_DATA.map((d, i) => ({
    x: i,
    y: d.count,
    r: Math.max(4, Math.sqrt(d.count / maxCount) * maxRadius),
  }));

  const bubbleColors = NOBEL_DATA.map((_, i) =>
    BUBBLE_PALETTE[i % BUBBLE_PALETTE.length]
  );

  configs.push({
    canvasId: 'science-nobel-canvas',
    blockId: 'detail-trend',
    config: {
      type: 'bubble',
      data: {
        datasets: [{
          label: i18n.t('detail.science.nobelTitle'),
          data: bubbleData,
          backgroundColor: bubbleColors.map(c => c + '99'),
          borderColor: bubbleColors,
          borderWidth: 1.5,
        }],
      },
      options: {
        scales: {
          x: {
            type: 'linear',
            min: -0.5,
            max: NOBEL_DATA.length - 0.5,
            ticks: {
              callback: function (val) {
                const idx = Math.round(val);
                return nobelLabels[idx] || '';
              },
              maxRotation: 45,
              autoSkip: false,
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Nobel Prizes',
            },
            ticks: {
              callback: (val) => MathUtils.formatCompact(val),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = Math.round(items[0]?.parsed?.x ?? 0);
                return nobelLabels[idx] || '';
              },
              label: (item) => `${item.parsed.y} Nobel Prizes`,
            },
          },
        },
      },
    },
  });

  return configs;
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _chartData = null;
  _growthChart = null;
  console.log('[Science] cleanup()');
}
