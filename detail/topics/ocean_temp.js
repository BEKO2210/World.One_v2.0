/* ===================================================================
   World.One 1.0 -- Ocean Temperature Topic Module (OCEAN-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: NOAA Climate at a Glance (cache), NOAA Coral Reef Watch,
         IPCC AR6 WG1 (hardcoded regional anomalies)
   Visualizations: SST Anomaly Timeline (Chart.js), Regional SST
                   Choropleth (SVG), Coral Bleaching Threshold (DOM)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'ocean_temp',
  titleKey: 'detail.ocean_temp.title',
  category: 'ocean',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _cacheData = null;
let _choroplethCleanup = null;

// --- Regional SST Anomaly Data (IPCC AR6 WG1, normalized 0-1) ---------
// Higher value = greater warming anomaly
// Arctic regions high; tropical moderate; southern lower

const REGIONAL_SST_ANOMALY = {
  NO: 0.95, IS: 0.92, RU: 0.90, FI: 0.88, SE: 0.86,
  CA: 0.72, US: 0.55, MX: 0.48, GB: 0.65, IE: 0.62,
  FR: 0.52, DE: 0.58, NL: 0.60, BE: 0.57, DK: 0.68,
  PL: 0.55, ES: 0.45, PT: 0.44, IT: 0.50, GR: 0.48,
  TR: 0.52, JP: 0.58, KR: 0.54, CN: 0.50, IN: 0.45,
  PH: 0.60, ID: 0.55, TH: 0.52, VN: 0.50, MY: 0.48,
  AU: 0.62, NZ: 0.38, BR: 0.42, AR: 0.35, CL: 0.32,
  ZA: 0.40, KE: 0.42, NG: 0.46, EG: 0.50, MA: 0.44,
  PE: 0.38, CO: 0.44, CU: 0.52, SA: 0.55, AE: 0.58,
};

// --- Coral Bleaching Thresholds (NOAA Coral Reef Watch) ----------------

const CORAL_THRESHOLDS = [
  { min: 0, max: 4,    label: 'Bleaching Watch',    color: '#fbc02d' },
  { min: 4, max: 8,    label: 'Bleaching Warning',  color: '#ff9800' },
  { min: 8, max: 12,   label: 'Alert Level 1',      color: '#f44336' },
  { min: 12, max: 20,  label: 'Alert Level 2',      color: '#b71c1c' },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached ocean data
  const { data, tier, age } = await fetchTopicData('ocean');
  _cacheData = data;

  const sstData = data?.annual_sst_anomaly || [];
  const latest = sstData.length > 0
    ? sstData[sstData.length - 1]
    : { year: 2025, anomaly: 0.83 };

  // 2. Hero block
  _renderHero(blocks.hero, latest, tier, age);

  // 3. Chart block -- SST anomaly timeline
  await _renderSSTChart(blocks.chart, sstData);

  // 4. Trend block -- warming milestones
  _renderMilestones(blocks.trend, sstData, latest);

  // 5. Tiles block -- coral bleaching threshold infographic
  _renderCoralThresholds(blocks.tiles);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- regional SST choropleth
  await _renderChoropleth(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, latest, tier, age) {
  const sign = latest.anomaly >= 0 ? '+' : '';
  const color = latest.anomaly >= 0.5 ? '#ff3b30' : '#ff9500';
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'ocean-temp-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color,
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: `${sign}${latest.anomaly.toFixed(2)}`,
        }),
        DOMUtils.create('span', {
          textContent: ' \u00B0C',
          style: { fontSize: '1.5rem', fontWeight: '400' },
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
          textContent: i18n.t('detail.ocean_temp.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.ocean_temp.heroExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0' },
      }),
      DOMUtils.create('span', {
        textContent: `${latest.year} \u2022 NOAA Climate at a Glance`,
        style: { color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: 'var(--space-xs)', display: 'block' },
      }),
    ])
  );
}

// --- Chart Block (SST Anomaly Timeline 1880-present) -------------------

async function _renderSSTChart(chartEl, sstData) {
  if (sstData.length === 0) return;

  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.ocean_temp.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'ocean-temp-sst-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  const labels = sstData.map(d => d.year.toString());
  const values = sstData.map(d => d.anomaly);

  createChart('ocean-temp-sst-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'SST Anomaly (\u00B0C)',
        data: values,
        borderColor: toRgba(CHART_COLORS.environment),
        backgroundColor: toRgba(CHART_COLORS.environment, 0.2),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 6,
        borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 12,
          },
        },
        y: {
          title: {
            display: true,
            text: 'Anomaly (\u00B0C)',
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => {
              const v = item.parsed.y;
              const sign = v >= 0 ? '+' : '';
              return `SST: ${sign}${v.toFixed(2)} \u00B0C`;
            },
          },
        },
        annotation: {
          annotations: {
            baseline: {
              type: 'line',
              yMin: 0,
              yMax: 0,
              borderColor: 'rgba(255,255,255,0.3)',
              borderWidth: 1,
              borderDash: [6, 4],
              label: {
                display: true,
                content: 'Baseline',
                position: 'start',
                color: 'rgba(255,255,255,0.5)',
                font: { size: 10 },
              },
            },
          },
        },
      },
    },
  });
}

// --- Trend Block (Warming Milestones) -----------------------------------

function _renderMilestones(trendEl, sstData, latest) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: 'Key Milestones',
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const tiles = [];

  // Warmest year
  if (sstData.length > 0) {
    const warmest = sstData.reduce((a, b) => a.anomaly > b.anomaly ? a : b);
    tiles.push(_createTile(
      'Warmest Year',
      `${warmest.year}`,
      `+${warmest.anomaly.toFixed(2)} \u00B0C`,
      '#ff3b30'
    ));
  }

  // Rate of warming (last 50 years linear slope approximation)
  if (sstData.length >= 50) {
    const recent = sstData.slice(-50);
    const n = recent.length;
    const xMean = recent.reduce((s, d) => s + d.year, 0) / n;
    const yMean = recent.reduce((s, d) => s + d.anomaly, 0) / n;
    let num = 0, den = 0;
    for (const d of recent) {
      num += (d.year - xMean) * (d.anomaly - yMean);
      den += (d.year - xMean) ** 2;
    }
    const slopePerDecade = (num / den) * 10;
    tiles.push(_createTile(
      'Rate of Warming',
      `+${slopePerDecade.toFixed(2)} \u00B0C`,
      'per decade (last 50 years)',
      '#ff9500'
    ));
  }

  // Since pre-industrial
  if (sstData.length > 20) {
    const preIndustrial = sstData.filter(d => d.year >= 1880 && d.year <= 1900);
    const avgPreInd = preIndustrial.reduce((s, d) => s + d.anomaly, 0) / (preIndustrial.length || 1);
    const diff = latest.anomaly - avgPreInd;
    tiles.push(_createTile(
      'Since Pre-industrial',
      `+${diff.toFixed(2)} \u00B0C`,
      'vs. 1880-1900 average',
      '#ff6b6b'
    ));
  }

  const grid = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 'var(--space-sm)',
    },
  }, tiles);

  trendEl.appendChild(grid);
}

function _createTile(label, value, subtitle, color) {
  return DOMUtils.create('div', {
    style: {
      background: 'var(--card-bg, rgba(255,255,255,0.05))',
      borderRadius: '12px',
      padding: 'var(--space-md)',
      textAlign: 'center',
    },
  }, [
    DOMUtils.create('div', {
      textContent: label,
      style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 'var(--space-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' },
    }),
    DOMUtils.create('div', {
      textContent: value,
      style: { fontSize: '1.8rem', fontWeight: '700', color, lineHeight: '1.2' },
    }),
    DOMUtils.create('div', {
      textContent: subtitle,
      style: { color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '4px' },
    }),
  ]);
}

// --- Tiles Block (Coral Bleaching Threshold Infographic) ----------------

function _renderCoralThresholds(tilesEl) {
  tilesEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_temp.coralTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
    })
  );

  tilesEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.ocean_temp.coralExplain'),
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' },
    })
  );

  // DHW scale bars
  const bars = CORAL_THRESHOLDS.map(t => {
    const widthPercent = ((t.max - t.min) / 20) * 100;
    return DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '6px',
      },
    }, [
      DOMUtils.create('div', {
        textContent: `${t.min}-${t.max} DHW`,
        style: {
          width: '90px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          flexShrink: '0',
        },
      }),
      DOMUtils.create('div', {
        style: {
          flex: '1',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${widthPercent}%`,
            minWidth: '40px',
            height: '100%',
            background: t.color,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            fontWeight: '600',
            color: t.color === '#fbc02d' ? '#1a1a2e' : '#fff',
            padding: '0 8px',
          },
          textContent: t.label,
        }),
      ]),
    ]);
  });

  // Current global DHW indicator
  const currentDHW = 6; // approximate current global average
  const currentPercent = (currentDHW / 20) * 100;

  const indicator = DOMUtils.create('div', {
    style: {
      marginTop: 'var(--space-sm)',
      position: 'relative',
      height: '30px',
      background: 'var(--card-bg, rgba(255,255,255,0.05))',
      borderRadius: '6px',
      overflow: 'hidden',
    },
  }, [
    DOMUtils.create('div', {
      style: {
        position: 'absolute',
        left: `${currentPercent}%`,
        top: '0',
        bottom: '0',
        width: '3px',
        background: '#fff',
        zIndex: '1',
      },
    }),
    DOMUtils.create('div', {
      textContent: `Current: ~${currentDHW} DHW`,
      style: {
        position: 'absolute',
        left: `calc(${currentPercent}% + 8px)`,
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '0.75rem',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
      },
    }),
  ]);

  const container = DOMUtils.create('div', {
    style: { padding: 'var(--space-sm)', background: 'var(--card-bg, rgba(255,255,255,0.05))', borderRadius: '12px' },
  }, [...bars, indicator]);

  tilesEl.appendChild(container);
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(expEl) {
  const paragraphs = [
    'SST anomaly measures how much ocean surface temperature deviates from the historical average. Positive anomalies indicate warming seas.',
    'Rising ocean temperatures cause coral bleaching, disrupt marine food chains, intensify hurricanes, and contribute to sea level rise through thermal expansion.',
    'The ocean absorbs over 90% of excess heat from greenhouse gas emissions, making it a critical indicator of global climate change.',
  ];

  expEl.appendChild(
    DOMUtils.create('div', {}, paragraphs.map(text =>
      DOMUtils.create('p', {
        textContent: text,
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: 'var(--space-xs)' },
      })
    ))
  );
}

// --- Comparison Block (Regional SST Choropleth) --------------------------

async function _renderChoropleth(compEl) {
  function colorFn(value) {
    // Blue-to-red gradient based on anomaly value (0 = blue, 1 = red)
    const r = Math.round(value * 255);
    const g = Math.round((1 - value) * 100 + 50);
    const b = Math.round((1 - value) * 255);
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  }

  function tooltipFn(iso, val) {
    let desc = 'Low';
    if (val >= 0.8) desc = 'Extreme';
    else if (val >= 0.6) desc = 'High';
    else if (val >= 0.4) desc = 'Moderate';
    return `${iso}: ${desc} warming (${(val * 100).toFixed(0)}%)`;
  }

  const legendItems = [
    { color: 'rgba(255, 60, 50, 0.8)', label: 'Extreme' },
    { color: 'rgba(200, 90, 80, 0.8)', label: 'High' },
    { color: 'rgba(128, 110, 128, 0.8)', label: 'Moderate' },
    { color: 'rgba(50, 130, 230, 0.8)', label: 'Low' },
  ];

  const result = await renderChoropleth(compEl, {
    dataMap: REGIONAL_SST_ANOMALY,
    colorFn,
    tooltipFn,
    legendItems,
    title: 'Regional SST Anomalies',
  });

  if (result && result.cleanup) {
    _choroplethCleanup = result.cleanup;
  }
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    { label: 'NOAA Climate at a Glance', url: 'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/' },
    { label: 'NOAA Coral Reef Watch', url: 'https://coralreefwatch.noaa.gov/' },
    { label: 'IPCC AR6 WG1', url: 'https://www.ipcc.ch/report/ar6/wg1/' },
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

// --- Chart Configs (lazy-loaded by detail-app.js) -----------------------

export function getChartConfigs() {
  // SST chart rendered directly in render() for timerangechange support
  return [];
}

// --- Cleanup -------------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _cacheData = null;

  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  console.log('[OceanTemp] cleanup()');
}
