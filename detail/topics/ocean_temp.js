/* ===================================================================
   World.One 2.0 -- Ocean Temperature Topic Module (OCEAN-01)
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
  { min: 0,  max: 4,  labelKey: 'detail.ocean_temp.dhwWatch',   descKey: 'detail.ocean_temp.dhwWatchDesc',   color: '#fbc02d', icon: '👁' },
  { min: 4,  max: 8,  labelKey: 'detail.ocean_temp.dhwWarning', descKey: 'detail.ocean_temp.dhwWarningDesc', color: '#ff9800', icon: '⚠' },
  { min: 8,  max: 12, labelKey: 'detail.ocean_temp.dhwAlert1',  descKey: 'detail.ocean_temp.dhwAlert1Desc',  color: '#f44336', icon: '🔴' },
  { min: 12, max: 20, labelKey: 'detail.ocean_temp.dhwAlert2',  descKey: 'detail.ocean_temp.dhwAlert2Desc',  color: '#b71c1c', icon: '💀' },
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
        textContent: `${latest.year} \u2022 ${i18n.t('detail.ocean_temp.sourceNOAA')}`,
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
        label: i18n.t('detail.ocean_temp.sstAnomalyLabel'),
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
            text: i18n.t('detail.ocean_temp.anomalyAxis'),
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
              return `${i18n.t('detail.ocean_temp.sstTooltip')}: ${sign}${v.toFixed(2)} °C`;
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
                content: i18n.t('detail.ocean_temp.baseline'),
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
      textContent: i18n.t('detail.ocean_temp.milestonesTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const tiles = [];

  // Warmest year
  if (sstData.length > 0) {
    const warmest = sstData.reduce((a, b) => a.anomaly > b.anomaly ? a : b);
    tiles.push(_createTile(
      i18n.t('detail.ocean_temp.warmestYear'),
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
      i18n.t('detail.ocean_temp.rateOfWarming'),
      `+${slopePerDecade.toFixed(2)} \u00B0C`,
      i18n.t('detail.ocean_temp.perDecade'),
      '#ff9500'
    ));
  }

  // Since pre-industrial
  if (sstData.length > 20) {
    const preIndustrial = sstData.filter(d => d.year >= 1880 && d.year <= 1900);
    const avgPreInd = preIndustrial.reduce((s, d) => s + d.anomaly, 0) / (preIndustrial.length || 1);
    const diff = latest.anomaly - avgPreInd;
    tiles.push(_createTile(
      i18n.t('detail.ocean_temp.sincePreIndustrial'),
      `+${diff.toFixed(2)} \u00B0C`,
      i18n.t('detail.ocean_temp.vsAverage'),
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
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: 'var(--space-md)' },
    })
  );

  // Current global DHW
  const currentDHW = 6;

  // Card-based layout — stacks vertically on mobile, 2-col on desktop
  const cards = CORAL_THRESHOLDS.map(t => {
    const isCurrent = currentDHW >= t.min && currentDHW < t.max;
    return DOMUtils.create('div', {
      style: {
        background: isCurrent ? `${t.color}18` : 'var(--card-bg, rgba(255,255,255,0.04))',
        border: isCurrent ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: 'var(--space-sm) var(--space-md)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-sm)',
        transition: 'transform 0.2s ease',
      },
    }, [
      // Left: colored DHW badge
      DOMUtils.create('div', {
        style: {
          background: t.color,
          color: t.color === '#fbc02d' ? '#1a1a2e' : '#fff',
          borderRadius: '8px',
          padding: '6px 10px',
          fontSize: '0.75rem',
          fontWeight: '700',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          flexShrink: '0',
          minWidth: '70px',
          textAlign: 'center',
          lineHeight: '1.3',
        },
      }, [
        DOMUtils.create('div', { textContent: `${t.min}–${t.max}` }),
        DOMUtils.create('div', {
          textContent: i18n.t('detail.ocean_temp.dhwUnit'),
          style: { fontSize: '0.65rem', opacity: '0.8' },
        }),
      ]),
      // Right: label + description
      DOMUtils.create('div', {
        style: { flex: '1', minWidth: '0' },
      }, [
        DOMUtils.create('div', {
          textContent: i18n.t(t.labelKey),
          style: {
            color: t.color,
            fontWeight: '600',
            fontSize: '0.9rem',
            marginBottom: '2px',
          },
        }),
        DOMUtils.create('div', {
          textContent: i18n.t(t.descKey),
          style: {
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            lineHeight: '1.4',
          },
        }),
        ...(isCurrent ? [DOMUtils.create('div', {
          textContent: `${i18n.t('detail.ocean_temp.currentLabel')} ~${currentDHW} ${i18n.t('detail.ocean_temp.dhwUnit')}`,
          style: {
            marginTop: '6px',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            background: 'rgba(255,255,255,0.08)',
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
          },
        })] : []),
      ]),
    ]);
  });

  // Gradient bar showing the full 0–20 DHW scale
  const gradientBar = DOMUtils.create('div', {
    style: {
      marginTop: 'var(--space-sm)',
      height: '8px',
      borderRadius: '4px',
      background: 'linear-gradient(90deg, #fbc02d 0%, #fbc02d 20%, #ff9800 20%, #ff9800 40%, #f44336 40%, #f44336 60%, #b71c1c 60%, #b71c1c 100%)',
      position: 'relative',
    },
  }, [
    // Current position marker
    DOMUtils.create('div', {
      style: {
        position: 'absolute',
        left: `${(currentDHW / 20) * 100}%`,
        top: '-4px',
        width: '4px',
        height: '16px',
        background: '#fff',
        borderRadius: '2px',
        boxShadow: '0 0 6px rgba(255,255,255,0.5)',
      },
    }),
  ]);

  const scale = DOMUtils.create('div', {
    style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' },
  }, [
    DOMUtils.create('span', { textContent: '0' }),
    DOMUtils.create('span', { textContent: `20 ${i18n.t('detail.ocean_temp.dhwUnit')}` }),
  ]);

  const container = DOMUtils.create('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-sm)' },
  }, cards);

  tilesEl.appendChild(container);
  tilesEl.appendChild(gradientBar);
  tilesEl.appendChild(scale);
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(expEl) {
  const paragraphs = [
    i18n.t('detail.ocean_temp.explainP1'),
    i18n.t('detail.ocean_temp.explainP2'),
    i18n.t('detail.ocean_temp.explainP3'),
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
    title: i18n.t('detail.ocean_temp.choroplethTitle'),
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
