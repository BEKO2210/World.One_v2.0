/* ===================================================================
   World.One 2.0 -- Disasters Topic Module (CRISIS-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: ReliefWeb disaster events (cached disasters.json),
         Supplementary affected/damage data (hardcoded, Pitfall 4 fix),
         Historical decade trends (hardcoded EM-DAT/UNDRR),
         DOM-based timeline + dual-axis Chart.js trend chart
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'disasters',
  titleKey: 'detail.disasters.title',
  category: 'crisis',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _cacheData = null;

// --- Disaster Supplementary Details (Pitfall 4 mitigation) -------------
// Cache only has name, date, type, countries -- no affected/damage fields.
// Source: EM-DAT/UNDRR annual disaster reports

const DISASTER_DETAILS = {
  'Myanmar - Cyclone Mocha': { affected: 7800000, damageB: 1.3, icon: '\u{1F300}' },
  'Libya - Floods': { affected: 884000, damageB: 1.8, icon: '\u{1F30A}' },
  'Morocco - Earthquake': { affected: 380000, damageB: 6.5, icon: '\u{1F30D}' },
  'Turkiye - Syria Earthquake': { affected: 15700000, damageB: 34.2, icon: '\u{1F30D}' },
  'Pakistan - Floods': { affected: 33000000, damageB: 30.0, icon: '\u{1F30A}' },
  'India - Heat Wave': { affected: 500000000, damageB: 0.2, icon: '\u{1F321}' },
  'Brazil - Floods': { affected: 2300000, damageB: 3.4, icon: '\u{1F30A}' },
  'Chile - Wildfires': { affected: 26000, damageB: 2.8, icon: '\u{1F525}' },
  'Japan - Noto Earthquake': { affected: 345000, damageB: 17.6, icon: '\u{1F30D}' },
  'Philippines - Typhoon Rai': { affected: 9700000, damageB: 1.0, icon: '\u{1F300}' },
  'Afghanistan - Earthquake': { affected: 118000, damageB: 0.5, icon: '\u{1F30D}' },
  'East Africa - Drought': { affected: 36000000, damageB: 5.2, icon: '\u{2600}' },
  'Sudan - Conflict': { affected: 24800000, damageB: 2.0, icon: '\u{26A0}' },
  'Ukraine - Conflict': { affected: 17600000, damageB: 12.0, icon: '\u{26A0}' },
};

// --- Historical Disaster Trends (decade aggregates) --------------------
// Source: EM-DAT (CRED, UCLouvain)
// Note: 2020s is partial decade (2020-2025)

const DISASTER_TRENDS = [
  { decade: '1970s', count: 711, costB: 131 },
  { decade: '1980s', count: 1681, costB: 213 },
  { decade: '1990s', count: 2742, costB: 660 },
  { decade: '2000s', count: 3852, costB: 904 },
  { decade: '2010s', count: 3165, costB: 1413 },
  { decade: '2020s', count: 1890, costB: 1100 },
];

// --- Disaster Type Colors -----------------------------------------------

const DISASTER_TYPE_COLORS = {
  'Earthquake': { color: '#ff9500', icon: '\u{1F30D}' },
  'Flood': { color: '#5ac8fa', icon: '\u{1F30A}' },
  'Cyclone': { color: '#af52de', icon: '\u{1F300}' },
  'Heat Wave': { color: '#ff3b30', icon: '\u{1F321}' },
  'Wildfire': { color: '#ff6b35', icon: '\u{1F525}' },
  'Typhoon': { color: '#007aff', icon: '\u{1F300}' },
  'Drought': { color: '#c7a44a', icon: '\u{2600}' },
  'Complex Emergency': { color: '#8e8e93', icon: '\u{26A0}' },
};

// --- Number formatting helper -------------------------------------------

function _formatAffected(num) {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached disaster data
  const { data, tier, age } = await fetchTopicData('disasters');
  _cacheData = data;

  const disasters = data?.disasters || [];
  const eventCount = disasters.length;

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, eventCount, tier, age);

  // --- 3. Chart Block (DOM-based Timeline) ---
  _renderTimeline(blocks.chart, disasters);

  // --- 4. Trend Block (Historical dual-axis chart) ---
  _renderTrendCanvas(blocks.trend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles, disasters);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block ---
  _renderComparison(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, eventCount, tier, age) {
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'disasters-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: toRgba(CHART_COLORS.crisis, 0.95),
          marginBottom: 'var(--space-xs)',
        },
      }, [
        String(eventCount),
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
          textContent: `${i18n.t('detail.disasters.heroLabel')} ${i18n.t('detail.disasters.heroUnit')}`,
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (DOM-based Disaster Timeline) --------------------------

function _renderTimeline(chartEl, disasters) {
  // Sort by date chronologically
  const sorted = [...disasters].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.disasters.timelineTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const timelineContainer = DOMUtils.create('div', {
    className: 'disaster-timeline',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-xs)',
    },
  });

  sorted.forEach((event, idx) => {
    const typeInfo = DISASTER_TYPE_COLORS[event.type] || { color: '#8e8e93', icon: '\u{26A0}' };
    const details = DISASTER_DETAILS[event.name] || null;

    // Format date
    const dateObj = new Date(event.date);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    // Affected and damage text
    const affectedText = details ? _formatAffected(details.affected) : 'N/A';
    const damageText = details ? `$${details.damageB}B` : 'N/A';

    // Country text
    const countryText = event.countries ? event.countries.join(', ') : 'Unknown';

    // Status indicator
    const statusColor = event.status === 'ongoing' ? '#ff3b30' : 'var(--text-secondary)';
    const statusText = event.status === 'ongoing' ? 'ONGOING' : 'Past';

    const card = DOMUtils.create('div', {
      style: {
        display: 'flex',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        borderLeft: `4px solid ${typeInfo.color}`,
        marginLeft: idx % 2 === 0 ? '0' : '12px',
      },
    }, [
      // Date column
      DOMUtils.create('div', {
        style: {
          minWidth: '80px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          flexShrink: '0',
        },
      }, [
        DOMUtils.create('div', {
          textContent: dateStr,
          style: { marginBottom: '4px' },
        }),
        DOMUtils.create('div', {
          textContent: statusText,
          style: { color: statusColor, fontSize: '0.65rem', fontWeight: '600', letterSpacing: '0.05em' },
        }),
      ]),
      // Details column
      DOMUtils.create('div', {
        style: { flex: '1' },
      }, [
        DOMUtils.create('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
          },
        }, [
          DOMUtils.create('span', {
            textContent: typeInfo.icon,
            style: { fontSize: '1.1rem' },
          }),
          DOMUtils.create('span', {
            textContent: event.name,
            style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' },
          }),
        ]),
        DOMUtils.create('div', {
          textContent: `${event.type} \u00B7 ${countryText}`,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px' },
        }),
        DOMUtils.create('div', {
          style: {
            display: 'flex',
            gap: 'var(--space-sm)',
            fontSize: '0.8rem',
          },
        }, [
          DOMUtils.create('span', {
            style: { color: 'var(--text-secondary)' },
          }, [
            DOMUtils.create('span', {
              textContent: `${i18n.t('detail.disasters.tileAffected')}: `,
              style: { fontWeight: '400' },
            }),
            DOMUtils.create('span', {
              textContent: affectedText,
              style: { color: 'var(--text-primary)', fontWeight: '600' },
            }),
          ]),
          DOMUtils.create('span', {
            style: { color: 'var(--text-secondary)' },
          }, [
            DOMUtils.create('span', {
              textContent: `${i18n.t('detail.disasters.tileDamage')}: `,
              style: { fontWeight: '400' },
            }),
            DOMUtils.create('span', {
              textContent: damageText,
              style: { color: 'var(--text-primary)', fontWeight: '600' },
            }),
          ]),
        ]),
      ]),
    ]);

    timelineContainer.appendChild(card);
  });

  chartEl.appendChild(timelineContainer);
}

// --- Trend Block (Historical Dual-Axis Chart) ---------------------------

function _renderTrendCanvas(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.disasters.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'disaster-trend-chart' }),
      ]),
    ])
  );
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, disasters) {
  // Calculate total affected
  let totalAffected = 0;
  for (const d of disasters) {
    const details = DISASTER_DETAILS[d.name];
    if (details) totalAffected += details.affected;
  }

  // Calculate total damage
  let totalDamage = 0;
  for (const d of disasters) {
    const details = DISASTER_DETAILS[d.name];
    if (details) totalDamage += details.damageB;
  }

  // Find most common type
  const typeCounts = {};
  for (const d of disasters) {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
  }
  let mostCommonType = 'Unknown';
  let maxCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonType = type;
    }
  }

  const tileData = [
    {
      label: i18n.t('detail.disasters.tileAffected'),
      value: `~${_formatAffected(totalAffected)}`,
      unit: 'total',
      accent: toRgba(CHART_COLORS.crisis, 0.95),
    },
    {
      label: i18n.t('detail.disasters.tileDamage'),
      value: `$${totalDamage.toFixed(0)}B+`,
      unit: 'total',
      accent: '#ff9500',
    },
    {
      label: i18n.t('detail.disasters.tileType'),
      value: mostCommonType,
      unit: `${maxCount} events`,
      accent: DISASTER_TYPE_COLORS[mostCommonType]?.color || '#8e8e93',
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
      textContent: i18n.t('detail.disasters.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block (1970s vs 2010s) ----------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.disasters.comparisonTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.disasters.comparison'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: 'var(--space-sm)' },
      }),
      _buildComparisonGrid(),
    ])
  );
}

function _buildComparisonGrid() {
  const items = [
    { label: '1970s Events', value: '711', accent: toRgba(CHART_COLORS.crisis, 0.5) },
    { label: '2010s Events', value: '3,165', accent: toRgba(CHART_COLORS.crisis, 0.95) },
    { label: '1970s Cost', value: '$131B', accent: 'rgba(255,149,0,0.5)' },
    { label: '2010s Cost', value: '$1,413B', accent: 'rgba(255,149,0,0.95)' },
  ];

  const cells = items.map(({ label, value, accent }) =>
    DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        textAlign: 'center',
      },
    }, [
      DOMUtils.create('div', {
        textContent: value,
        style: { color: accent, fontSize: '1.3rem', fontWeight: '700', marginBottom: '4px' },
      }),
      DOMUtils.create('div', {
        textContent: label,
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem' },
      }),
    ])
  );

  return DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 'var(--space-sm)',
    },
  }, cells);
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.disasters.sourceEMDAT'),
      url: 'https://www.emdat.be/',
    },
    {
      label: i18n.t('detail.disasters.sourceReliefWeb'),
      url: 'https://reliefweb.int/',
    },
    {
      label: 'UNDRR',
      url: 'https://www.undrr.org/',
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

  // Use economy color with fallback
  const economyColor = CHART_COLORS.economy || { r: 255, g: 149, b: 0 };

  configs.push({
    canvasId: 'disaster-trend-chart',
    blockId: 'detail-trend',
    config: {
      type: 'bar',
      data: {
        labels: DISASTER_TRENDS.map(d => d.decade),
        datasets: [
          {
            label: i18n.t('detail.disasters.eventCount'),
            data: DISASTER_TRENDS.map(d => d.count),
            backgroundColor: toRgba(CHART_COLORS.crisis, 0.5),
            borderColor: toRgba(CHART_COLORS.crisis),
            borderWidth: 1,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line',
            label: i18n.t('detail.disasters.costBillion'),
            data: DISASTER_TRENDS.map(d => d.costB),
            borderColor: toRgba(economyColor),
            backgroundColor: toRgba(economyColor, 0.1),
            pointRadius: 4,
            pointHitRadius: 8,
            pointBackgroundColor: toRgba(economyColor),
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: i18n.t('detail.disasters.eventCount'),
            },
            beginAtZero: true,
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: i18n.t('detail.disasters.costBillion'),
            },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
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
                  return `Events: ${item.parsed.y.toLocaleString()}`;
                }
                return `Cost: $${item.parsed.y}B`;
              },
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
  _cacheData = null;
  console.log('[Disasters] cleanup()');
}
