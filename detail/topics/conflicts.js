/* ===================================================================
   World.One 1.0 -- Conflicts Topic Module (SOC-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: UCDP/PRIO Armed Conflict Dataset (static fallback),
         UNHCR displacement data (hardcoded), USGS conflict centroids
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'conflicts',
  titleKey: 'detail.conflicts.title',
  category: 'society',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _chartData = null;
let _trendChart = null;
let _tooltipEl = null;

// --- Conflict Country Data (UCDP/PRIO major conflicts) ----------------

const CONFLICT_COUNTRIES = [
  { name: 'Ukraine', lat: 49.0, lng: 31.0, intensity: 3 },
  { name: 'Gaza/Palestine', lat: 31.4, lng: 34.4, intensity: 3 },
  { name: 'Myanmar', lat: 19.8, lng: 96.1, intensity: 3 },
  { name: 'Sudan', lat: 12.9, lng: 30.2, intensity: 3 },
  { name: 'Ethiopia', lat: 9.0, lng: 38.7, intensity: 2 },
  { name: 'Somalia', lat: 5.2, lng: 46.2, intensity: 2 },
  { name: 'DR Congo', lat: -4.0, lng: 21.8, intensity: 2 },
  { name: 'Yemen', lat: 15.6, lng: 48.5, intensity: 3 },
  { name: 'Syria', lat: 35.0, lng: 38.0, intensity: 2 },
  { name: 'Afghanistan', lat: 33.9, lng: 67.7, intensity: 2 },
  { name: 'Iraq', lat: 33.2, lng: 43.7, intensity: 1 },
  { name: 'Nigeria', lat: 9.1, lng: 7.5, intensity: 2 },
  { name: 'Burkina Faso', lat: 12.4, lng: -1.6, intensity: 2 },
  { name: 'Mali', lat: 17.6, lng: -4.0, intensity: 2 },
  { name: 'Cameroon', lat: 7.4, lng: 12.4, intensity: 1 },
  { name: 'Mozambique', lat: -18.7, lng: 35.5, intensity: 1 },
  { name: 'Colombia', lat: 4.6, lng: -74.1, intensity: 1 },
  { name: 'Mexico', lat: 23.6, lng: -102.6, intensity: 1 },
  { name: 'Pakistan', lat: 30.4, lng: 69.3, intensity: 1 },
  { name: 'Philippines', lat: 14.6, lng: 121.0, intensity: 1 },
];

// --- Historical Conflict Trend 1946-2024 (UCDP/PRIO) -----------------

const CONFLICT_TREND = [
  { year: 1946, count: 17 }, { year: 1950, count: 13 }, { year: 1955, count: 14 },
  { year: 1960, count: 16 }, { year: 1965, count: 25 }, { year: 1970, count: 31 },
  { year: 1975, count: 35 }, { year: 1978, count: 36 }, { year: 1980, count: 37 },
  { year: 1985, count: 40 }, { year: 1990, count: 50 }, { year: 1991, count: 52 },
  { year: 1992, count: 51 }, { year: 1993, count: 45 }, { year: 1995, count: 35 },
  { year: 2000, count: 34 }, { year: 2005, count: 32 }, { year: 2010, count: 31 },
  { year: 2011, count: 37 }, { year: 2012, count: 33 }, { year: 2013, count: 34 },
  { year: 2014, count: 40 }, { year: 2015, count: 52 }, { year: 2016, count: 53 },
  { year: 2017, count: 49 }, { year: 2018, count: 52 }, { year: 2019, count: 54 },
  { year: 2020, count: 56 }, { year: 2021, count: 55 }, { year: 2022, count: 55 },
  { year: 2023, count: 59 }, { year: 2024, count: 56 },
];

// --- Notable event years for annotations ------------------------------

const EVENT_YEARS = {
  1991: 'End of Cold War',
  2011: 'Arab Spring',
  2014: 'ISIS rise, Ukraine crisis',
  2022: 'Russia invades Ukraine',
};

// --- Refugees/Displacement data (UNHCR 2024 mid-year) -----------------

const DISPLACEMENT = {
  refugees: 37.6,       // millions
  idps: 68.3,           // millions
  asylumSeekers: 6.9,   // millions
  total: 117,            // millions (includes others)
};

// --- Simplified continent outlines for SVG map -------------------------

const CONTINENT_PATHS = [
  'M50,80 L130,55 L160,65 L175,110 L145,140 L130,180 L105,175 L85,145 L50,130 Z',
  'M130,195 L155,180 L170,195 L175,235 L165,290 L145,320 L120,305 L115,255 L120,220 Z',
  'M410,65 L460,55 L480,70 L470,90 L490,100 L465,115 L430,105 L410,95 Z',
  'M420,130 L470,120 L500,145 L505,190 L490,240 L470,280 L440,290 L420,260 L410,210 L415,165 Z',
  'M490,55 L600,35 L700,50 L730,80 L710,115 L680,130 L640,135 L600,145 L540,140 L500,130 L485,105 L490,80 Z',
  'M680,260 L730,250 L760,265 L765,290 L740,310 L700,310 L680,290 Z',
  'M100,420 L300,415 L500,420 L700,415 L800,425 L700,445 L300,445 L100,440 Z',
];

// --- Intensity helpers -------------------------------------------------

function intensityToRadius(intensity) {
  if (intensity === 3) return 14;
  if (intensity === 2) return 9;
  return 5;
}

function intensityToColor(intensity) {
  if (intensity === 3) return toRgba(CHART_COLORS.crisis, 0.85);
  if (intensity === 2) return toRgba(CHART_COLORS.society, 0.85);
  return 'rgba(255, 215, 0, 0.85)'; // yellow for minor
}

function intensityLabel(intensity) {
  if (intensity === 3) return 'War';
  if (intensity === 2) return 'Intermediate';
  return 'Minor conflict';
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached conflict data
  const { data, tier, age } = await fetchTopicData('conflicts');

  const conflictData = data?.conflict_data || {};
  const activeConflicts = conflictData.active_conflicts || 56;
  const conflictYear = conflictData.year || 2024;

  // Static fallback values
  const battleDeaths = 122000;  // 2023, UCDP
  const displacedMillions = DISPLACEMENT.total; // 117M, UNHCR 2024
  const refugeesMillions = DISPLACEMENT.refugees; // 37.6M

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, activeConflicts, conflictYear, tier, age);

  // --- 3. Chart Block (SVG Conflict Map) ---
  _renderMap(blocks.chart);

  // --- 4. Trend Block (Historical Trend -- rendered directly for interactivity) ---
  await _renderTrend(blocks.trend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles, activeConflicts, battleDeaths, displacedMillions, refugeesMillions);

  // --- 6. Comparison Block (Refugees Doughnut) ---
  _renderComparison(blocks.comparison);

  // --- 7. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, activeConflicts, year, tier, age) {
  const badge = createTierBadge(tier, { age, year: tier === 'static' ? year : null });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'conflicts-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: toRgba(CHART_COLORS.crisis, 0.95),
          marginBottom: 'var(--space-xs)',
        },
      }, [
        String(activeConflicts),
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
          textContent: `${i18n.t('detail.conflicts.heroLabel')} (${year})`,
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- SVG Conflict Map ---------------------------------------------------

function _renderMap(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.conflicts.mapTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      _buildConflictMap(chartEl),
      _buildConflictLegend(),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.conflicts.clickCountry'),
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 'var(--space-xs)', textAlign: 'center' },
      }),
    ])
  );
}

function _buildConflictMap(containerParent) {
  const wrapper = DOMUtils.create('div', {
    style: {
      position: 'relative',
      width: '100%',
      maxWidth: '900px',
      margin: '0 auto',
    },
  });

  const svg = DOMUtils.createSVG('svg', {
    viewBox: '0 0 900 450',
    width: '100%',
    height: 'auto',
    style: 'display:block; background: rgba(255,255,255,0.02); border-radius: 8px;',
  });

  // Draw simplified continent outlines
  for (const pathData of CONTINENT_PATHS) {
    const path = DOMUtils.createSVG('path', {
      d: pathData,
      fill: 'rgba(255,255,255,0.05)',
      stroke: 'rgba(255,255,255,0.15)',
      'stroke-width': '0.5',
    });
    svg.appendChild(path);
  }

  // Grid lines
  for (let lat = -60; lat <= 60; lat += 30) {
    const { y } = MathUtils.geoToSVG(lat, 0, 900, 450);
    svg.appendChild(DOMUtils.createSVG('line', {
      x1: '0', y1: String(y), x2: '900', y2: String(y),
      stroke: 'rgba(255,255,255,0.04)', 'stroke-width': '0.5',
    }));
  }
  for (let lng = -150; lng <= 150; lng += 30) {
    const { x } = MathUtils.geoToSVG(0, lng, 900, 450);
    svg.appendChild(DOMUtils.createSVG('line', {
      x1: String(x), y1: '0', x2: String(x), y2: '450',
      stroke: 'rgba(255,255,255,0.04)', 'stroke-width': '0.5',
    }));
  }

  // Plot conflict country dots
  for (const country of CONFLICT_COUNTRIES) {
    const { x, y } = MathUtils.geoToSVG(country.lat, country.lng, 900, 450);
    const radius = intensityToRadius(country.intensity);
    const color = intensityToColor(country.intensity);

    // Outer glow for war-level conflicts
    if (country.intensity === 3) {
      const glow = DOMUtils.createSVG('circle', {
        cx: String(x), cy: String(y), r: String(radius + 4),
        fill: 'none',
        stroke: toRgba(CHART_COLORS.crisis, 0.3),
        'stroke-width': '2',
      });
      svg.appendChild(glow);
    }

    const circle = DOMUtils.createSVG('circle', {
      cx: String(x),
      cy: String(y),
      r: String(radius),
      fill: color,
      stroke: 'rgba(255,255,255,0.2)',
      'stroke-width': '0.5',
      style: 'cursor:pointer;',
    });

    circle.addEventListener('click', (e) => {
      e.stopPropagation();
      _showConflictPopup(wrapper, country, e);
    });

    svg.appendChild(circle);
  }

  wrapper.appendChild(svg);

  // Click outside removes popup
  wrapper.addEventListener('click', () => {
    if (_tooltipEl) {
      _tooltipEl.remove();
      _tooltipEl = null;
    }
  });

  return wrapper;
}

function _showConflictPopup(container, country, event) {
  if (_tooltipEl) {
    _tooltipEl.remove();
    _tooltipEl = null;
  }

  _tooltipEl = DOMUtils.create('div', {
    className: 'conflict-popup',
    style: {
      position: 'absolute',
      background: 'rgba(18, 18, 26, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '10px 14px',
      color: 'var(--text-primary)',
      fontSize: '0.85rem',
      zIndex: '10',
      pointerEvents: 'none',
      maxWidth: '220px',
    },
  }, [
    DOMUtils.create('div', {
      textContent: MathUtils.escapeHTML(country.name),
      style: { fontWeight: '700', fontSize: '1rem', marginBottom: '4px' },
    }),
    DOMUtils.create('div', {
      textContent: `${i18n.t('detail.conflicts.intensity')}: ${intensityLabel(country.intensity)}`,
      style: { color: 'var(--text-secondary)' },
    }),
  ]);

  const rect = container.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  _tooltipEl.style.left = `${Math.min(offsetX + 12, rect.width - 230)}px`;
  _tooltipEl.style.top = `${offsetY - 10}px`;

  container.appendChild(_tooltipEl);
}

function _buildConflictLegend() {
  const items = [
    { color: toRgba(CHART_COLORS.crisis, 0.85), label: 'War (intensity 3)', radius: 14 },
    { color: toRgba(CHART_COLORS.society, 0.85), label: 'Intermediate (2)', radius: 9 },
    { color: 'rgba(255, 215, 0, 0.85)', label: 'Minor conflict (1)', radius: 5 },
  ];

  const legendItems = items.map(({ color, label }) =>
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      },
    }, [
      DOMUtils.create('span', {
        style: {
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: '0',
        },
      }),
      DOMUtils.create('span', {
        textContent: label,
        style: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
      }),
    ])
  );

  return DOMUtils.create('div', {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 'var(--space-sm)',
      marginTop: 'var(--space-xs)',
      flexWrap: 'wrap',
    },
  }, legendItems);
}

// --- Trend Block (Historical Conflict Trend -- rendered directly) -------

async function _renderTrend(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.conflicts.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'conflict-trend-canvas' }),
      ]),
    ])
  );

  // Render chart directly for interactivity (time range support)
  await ensureChartJs();
  _trendChart = _createTrendChart(CONFLICT_TREND);

  // Listen for time range changes
  trendEl.addEventListener('timerangechange', (e) => {
    const range = e.detail?.range;
    if (!range || !_trendChart) return;

    let filtered;
    const currentYear = new Date().getFullYear();

    if (range === '1y') {
      filtered = CONFLICT_TREND.filter(d => d.year >= currentYear - 1);
      // Ensure at least last 2 entries if filter too restrictive
      if (filtered.length < 2) filtered = CONFLICT_TREND.slice(-2);
    } else if (range === '5y') {
      filtered = CONFLICT_TREND.filter(d => d.year >= 2019);
    } else if (range === '20y') {
      filtered = CONFLICT_TREND.filter(d => d.year >= 2004);
    } else {
      // 'max' or unknown
      filtered = CONFLICT_TREND;
    }

    _updateTrendChart(filtered);
  });
}

function _createTrendChart(trendData) {
  const eventYearSet = new Set(Object.keys(EVENT_YEARS).map(Number));

  const pointRadius = trendData.map(d => eventYearSet.has(d.year) ? 6 : 0);
  const pointBackgroundColor = trendData.map(d =>
    eventYearSet.has(d.year) ? '#ffffff' : toRgba(CHART_COLORS.crisis)
  );
  const pointBorderColor = trendData.map(d =>
    eventYearSet.has(d.year) ? toRgba(CHART_COLORS.crisis) : toRgba(CHART_COLORS.crisis)
  );
  const pointBorderWidth = trendData.map(d => eventYearSet.has(d.year) ? 3 : 1);

  return createChart('conflict-trend-canvas', {
    type: 'line',
    data: {
      labels: trendData.map(d => String(d.year)),
      datasets: [{
        label: i18n.t('detail.conflicts.heroLabel'),
        data: trendData.map(d => d.count),
        borderColor: toRgba(CHART_COLORS.crisis),
        backgroundColor: toRgba(CHART_COLORS.crisis, 0.1),
        fill: true,
        tension: 0.3,
        pointRadius,
        pointBackgroundColor,
        pointBorderColor,
        pointBorderWidth,
        pointHitRadius: 8,
        borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            callback: function (val) {
              const label = this.getLabelForValue(val);
              const year = parseInt(label, 10);
              // Show decade labels to avoid crowding
              if (year % 10 === 0 || eventYearSet.has(year)) return year;
              return null;
            },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: i18n.t('detail.conflicts.heroLabel'),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const year = parseInt(items[0]?.label, 10);
              if (EVENT_YEARS[year]) return `${year} -- ${EVENT_YEARS[year]}`;
              return items[0]?.label || '';
            },
            label: (item) => `${item.parsed.y} ${i18n.t('detail.conflicts.heroUnit')}`,
          },
        },
      },
    },
  });
}

function _updateTrendChart(filteredData) {
  if (!_trendChart) return;

  const eventYearSet = new Set(Object.keys(EVENT_YEARS).map(Number));

  _trendChart.data.labels = filteredData.map(d => String(d.year));
  _trendChart.data.datasets[0].data = filteredData.map(d => d.count);
  _trendChart.data.datasets[0].pointRadius = filteredData.map(d => eventYearSet.has(d.year) ? 6 : 0);
  _trendChart.data.datasets[0].pointBackgroundColor = filteredData.map(d =>
    eventYearSet.has(d.year) ? '#ffffff' : toRgba(CHART_COLORS.crisis)
  );
  _trendChart.data.datasets[0].pointBorderColor = filteredData.map(() => toRgba(CHART_COLORS.crisis));
  _trendChart.data.datasets[0].pointBorderWidth = filteredData.map(d => eventYearSet.has(d.year) ? 3 : 1);

  _trendChart.update('none'); // skip animation for range change
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, activeConflicts, battleDeaths, displacedMillions, refugeesMillions) {
  const tileData = [
    {
      label: i18n.t('detail.conflicts.tileActiveConflicts'),
      value: String(activeConflicts),
      unit: '2024',
    },
    {
      label: i18n.t('detail.conflicts.tileBattleDeaths'),
      value: MathUtils.formatCompact(battleDeaths),
      unit: '2023',
    },
    {
      label: i18n.t('detail.conflicts.tileDisplaced'),
      value: `${displacedMillions}M`,
      unit: '2024',
    },
    {
      label: i18n.t('detail.conflicts.tileRefugees'),
      value: `${refugeesMillions}M`,
      unit: 'UNHCR 2024',
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

// --- Comparison Block (Refugees Doughnut Chart) -------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.conflicts.refugeesTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'conflict-refugees-canvas' }),
      ]),
    ])
  );

  // Store data for lazy getChartConfigs
  _chartData = { displacement: DISPLACEMENT };
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.conflicts.title'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.conflicts.explanation'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.conflicts.comparison'),
        style: { color: 'var(--text-secondary)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.conflicts.sourceUCDP'),
      url: 'https://ucdp.uu.se/',
    },
    {
      label: i18n.t('detail.conflicts.sourceUNHCR'),
      url: 'https://www.unhcr.org/refugee-statistics/',
    },
    {
      label: 'ACLED',
      url: 'https://acleddata.com/',
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
        textContent: i18n.t('detail.sources') || 'Sources',
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

  // Refugees doughnut chart (trend chart is rendered directly in render())
  if (_chartData && _chartData.displacement) {
    const d = _chartData.displacement;

    configs.push({
      canvasId: 'conflict-refugees-canvas',
      blockId: 'detail-comparison',
      config: {
        type: 'doughnut',
        data: {
          labels: [
            i18n.t('detail.conflicts.refugees'),
            i18n.t('detail.conflicts.idps'),
            i18n.t('detail.conflicts.asylumSeekers'),
          ],
          datasets: [{
            data: [d.refugees, d.idps, d.asylumSeekers],
            backgroundColor: [
              toRgba(CHART_COLORS.crisis, 0.8),
              toRgba(CHART_COLORS.society, 0.8),
              toRgba(CHART_COLORS.economy, 0.8),
            ],
            borderColor: [
              toRgba(CHART_COLORS.crisis),
              toRgba(CHART_COLORS.society),
              toRgba(CHART_COLORS.economy),
            ],
            borderWidth: 1,
          }],
        },
        options: {
          cutout: '55%',
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
                  const val = item.parsed;
                  const total = d.refugees + d.idps + d.asylumSeekers;
                  const pct = ((val / total) * 100).toFixed(1);
                  return `${item.label}: ${val}M (${pct}%)`;
                },
              },
            },
          },
        },
      },
    });
  }

  return configs;
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _chartData = null;
  _trendChart = null;
  if (_tooltipEl) {
    _tooltipEl.remove();
    _tooltipEl = null;
  }
  console.log('[Conflicts] cleanup()');
}
