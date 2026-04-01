/* ===================================================================
   World.One 2.0 -- Solar Topic Module (RT-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: NOAA SWPC (live observed sunspots + Kp index),
         Cache pipeline (predicted solar cycle 25)
   Visualizations: Solar cycle 25 chart (observed + predicted with
                   confidence bands), Aurora Kp-index SVG map with
                   latitude bands colored by current Kp value
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { createMarkerMap } from '../utils/marker-map.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'solar',
  titleKey: 'detail.solar.title',
  category: 'realtime',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _observedData = null;
let _predictedData = null;
let _currentKp = null;

// --- Kp-Index Aurora Visibility Bands ----------------------------------
// Maps Kp value to the latitude where aurora becomes visible and band color

const KP_BANDS = [
  { kp: 9, lat: 30, color: 'rgba(255, 0, 100, 0.15)', label: 'Kp 9 -- 30\u00B0' },
  { kp: 7, lat: 40, color: 'rgba(255, 100, 0, 0.12)', label: 'Kp 7 -- 40\u00B0' },
  { kp: 5, lat: 50, color: 'rgba(0, 255, 100, 0.10)', label: 'Kp 5 -- 50\u00B0' },
  { kp: 3, lat: 60, color: 'rgba(0, 100, 255, 0.08)', label: 'Kp 3 -- 60\u00B0' },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // --- 1. Fetch cache data for predicted cycle ---
  let cacheResult = null;
  try {
    cacheResult = await fetchTopicData('solar');
  } catch (err) {
    console.warn('[Solar] Cache fetch failed:', err.message);
  }

  if (cacheResult && cacheResult.data && cacheResult.data.solar_cycle) {
    _predictedData = cacheResult.data.solar_cycle;
  }

  // --- 2. Fetch LIVE observed sunspot data from NOAA SWPC ---
  let heroValue = 150; // static fallback
  let heroTier = 'static';
  let heroAge = null;

  try {
    const obsRes = await fetchWithTimeout(
      'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json',
      8000
    );
    if (obsRes.ok) {
      const obsJson = await obsRes.json();
      if (Array.isArray(obsJson) && obsJson.length > 0) {
        _observedData = obsJson;
        // Most recent entry's ssn field
        const latest = obsJson[obsJson.length - 1];
        heroValue = Math.round(latest.ssn || latest.smoothed_ssn || 150);
        heroTier = 'live';
        heroAge = 0;
      }
    }
  } catch (err) {
    console.warn('[Solar] Live observed fetch failed:', err.message);
    // Fall back to predicted from cache
    if (_predictedData && _predictedData.length > 0) {
      heroValue = Math.round(_predictedData[0].predicted_ssn || 150);
      heroTier = cacheResult ? cacheResult.tier : 'static';
      heroAge = cacheResult ? cacheResult.age : null;
    }
  }

  // --- 3. Hero block ---
  const badge = createTierBadge(heroTier, { age: heroAge });
  _renderHero(blocks.hero, heroValue, badge);

  // --- 4. Chart block: Solar Cycle 25 canvas ---
  _renderChartBlock(blocks.chart);

  // --- 5. Trend block: Aurora Kp-Index Map ---
  await _renderKpMap(blocks.trend);

  // --- 6. Context tiles ---
  _renderTiles(blocks.tiles, heroValue);

  // --- 7. Explanation block ---
  _renderExplanation(blocks.explanation);

  // --- 8. Comparison block ---
  _renderComparison(blocks.comparison, heroValue);

  // --- 9. Sources block ---
  _renderSources(blocks.sources);
}

// --- Hero Block ---------------------------------------------------------

function _renderHero(heroEl, ssnValue, badge) {
  heroEl.appendChild(
    DOMUtils.create('div', { className: 'solar-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        String(ssnValue),
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.solar.heroUnit'),
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
          textContent: i18n.t('detail.solar.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('div', {
        textContent: i18n.t('detail.solar.tileCyclePhase') + ': Maximum (2024\u20132026)',
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
      }),
    ])
  );
}

// --- Chart Block (Solar Cycle 25) ----------------------------------------

function _renderChartBlock(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.solar.cycleTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: {
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
        },
      }, [
        DOMUtils.create('canvas', { id: 'solar-cycle-chart' }),
      ]),
    ])
  );
}

// --- Aurora Kp-Index Map (trend block) -----------------------------------

async function _renderKpMap(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.solar.kpTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Fetch live Kp index from NOAA
  let currentKp = 3; // Static fallback
  try {
    const kpRes = await fetchWithTimeout(
      'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
      8000
    );
    if (kpRes.ok) {
      const kpJson = await kpRes.json();
      if (Array.isArray(kpJson) && kpJson.length > 0) {
        const lastEntry = kpJson[kpJson.length - 1];
        currentKp = Math.round(parseFloat(lastEntry.kp_index || lastEntry.kp || '3'));
      }
    }
  } catch (err) {
    console.warn('[Solar] Kp fetch failed, using fallback Kp=3:', err.message);
  }
  _currentKp = currentKp;

  // Build map using world.svg
  const map = await createMarkerMap();

  if (!map) {
    trendEl.appendChild(
      DOMUtils.create('p', {
        textContent: i18n.t('detail.solar.mapUnavailable'),
        style: { color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' },
      })
    );
    return;
  }

  const { wrapper, overlay, geoToXY, svgWidth, svgHeight } = map;

  // Draw latitude bands colored by Kp level on the overlay
  for (const band of KP_BANDS) {
    if (currentKp >= band.kp) {
      const northPos = geoToXY(band.lat, 0);
      const southPos = geoToXY(-band.lat, 0);
      const polarNorth = geoToXY(90, 0);
      const polarSouth = geoToXY(-90, 0);

      // Northern hemisphere band (from pole down to latitude)
      overlay.appendChild(DOMUtils.createSVG('rect', {
        x: '0',
        y: String(polarNorth.y),
        width: String(svgWidth),
        height: String(northPos.y - polarNorth.y),
        fill: band.color,
      }));

      // Southern hemisphere band (from latitude down to pole)
      overlay.appendChild(DOMUtils.createSVG('rect', {
        x: '0',
        y: String(southPos.y),
        width: String(svgWidth),
        height: String(polarSouth.y - southPos.y),
        fill: band.color,
      }));
    }
  }

  trendEl.appendChild(wrapper);

  // Legend
  const legendItems = [];
  legendItems.push(
    DOMUtils.create('span', {
      textContent: `${i18n.t('detail.solar.kpCurrent')}: ${currentKp}`,
      style: {
        color: 'var(--text-primary)',
        fontWeight: '700',
        fontSize: '1rem',
        marginRight: 'var(--space-sm)',
      },
    })
  );

  for (const band of KP_BANDS) {
    if (currentKp >= band.kp) {
      legendItems.push(
        DOMUtils.create('span', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginRight: '10px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          },
        }, [
          DOMUtils.create('span', {
            style: {
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              background: band.color.replace(/0\.\d+\)$/, '0.5)'),
            },
          }),
          DOMUtils.create('span', { textContent: band.label }),
        ])
      );
    }
  }

  trendEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 'var(--space-xs)',
        gap: '6px',
      },
    }, legendItems)
  );
}

// --- Context Tiles -------------------------------------------------------

function _renderTiles(tilesEl, ssnValue) {
  // Determine flare risk from SSN
  let flareRisk = 'Low';
  if (ssnValue > 200) flareRisk = 'Very High';
  else if (ssnValue > 150) flareRisk = 'High';
  else if (ssnValue > 100) flareRisk = 'Moderate';

  const tileData = [
    {
      label: i18n.t('detail.solar.tileFlareRisk'),
      value: flareRisk,
      unit: '',
    },
    {
      label: i18n.t('detail.solar.tileSolarWind'),
      value: '~400',
      unit: 'km/s',
    },
    {
      label: i18n.t('detail.solar.tileCyclePhase'),
      value: 'Maximum',
      unit: '2024\u20132026',
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
      unit
        ? DOMUtils.create('div', {
            textContent: unit,
            style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' },
          })
        : null,
    ].filter(Boolean))
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
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.solar.title'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.solar.explanation'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl, currentSSN) {
  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.solar.comparison'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-sm)',
        },
      }, [
        _comparisonCard(
          i18n.t('detail.solar.cycleTitle'),
          String(currentSSN),
          i18n.t('detail.solar.heroUnit'),
          toRgba(CHART_COLORS.realtime, 0.15)
        ),
        _comparisonCard(
          'Cycle 19 (1958)',
          '285',
          i18n.t('detail.solar.heroUnit'),
          'rgba(255, 215, 0, 0.15)'
        ),
      ]),
    ])
  );
}

function _comparisonCard(title, value, unit, bgColor) {
  return DOMUtils.create('div', {
    style: {
      flex: '1',
      minWidth: '140px',
      padding: 'var(--space-sm)',
      background: bgColor,
      borderRadius: '8px',
      textAlign: 'center',
    },
  }, [
    DOMUtils.create('div', {
      textContent: title,
      style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px' },
    }),
    DOMUtils.create('div', {
      textContent: value,
      style: { color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: '700' },
    }),
    DOMUtils.create('div', {
      textContent: unit,
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
    }),
  ]);
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.solar.sourceNOAA'),
      url: 'https://www.swpc.noaa.gov/',
    },
    {
      label: i18n.t('detail.solar.sourceSWPC'),
      url: 'https://www.sidc.be/silso/',
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
          color: toRgba(CHART_COLORS.realtime, 0.9),
          textDecoration: 'none',
          borderBottom: `1px solid ${toRgba(CHART_COLORS.realtime, 0.3)}`,
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

// --- Chart Configs (Solar Cycle 25) --------------------------------------

export function getChartConfigs() {
  const configs = [];

  // Build observed data (filter from 2019 onward for Cycle 25)
  const observedLabels = [];
  const observedValues = [];
  if (_observedData && _observedData.length > 0) {
    for (const entry of _observedData) {
      const tag = entry['time-tag'] || '';
      if (tag >= '2019-01') {
        observedLabels.push(tag.slice(0, 7)); // YYYY-MM
        observedValues.push(entry.ssn || 0);
      }
    }
  }

  // Build predicted data from cache
  const predictedLabels = [];
  const predictedValues = [];
  const highValues = [];
  const lowValues = [];
  if (_predictedData && _predictedData.length > 0) {
    for (const entry of _predictedData) {
      const tag = entry['time-tag'] || '';
      predictedLabels.push(tag.slice(0, 7));
      predictedValues.push(entry.predicted_ssn || 0);
      highValues.push(entry.high_ssn || 0);
      lowValues.push(entry.low_ssn || 0);
    }
  }

  // Merge labels (union of observed + predicted, sorted)
  const allLabelsSet = new Set([...observedLabels, ...predictedLabels]);
  const allLabels = [...allLabelsSet].sort();

  // Map observed and predicted to merged label set
  const obsMap = new Map(observedLabels.map((l, i) => [l, observedValues[i]]));
  const predMap = new Map(predictedLabels.map((l, i) => [l, predictedValues[i]]));
  const highMap = new Map(predictedLabels.map((l, i) => [l, highValues[i]]));
  const lowMap = new Map(predictedLabels.map((l, i) => [l, lowValues[i]]));

  const obsAligned = allLabels.map(l => obsMap.has(l) ? obsMap.get(l) : null);
  const predAligned = allLabels.map(l => predMap.has(l) ? predMap.get(l) : null);
  const highAligned = allLabels.map(l => highMap.has(l) ? highMap.get(l) : null);
  const lowAligned = allLabels.map(l => lowMap.has(l) ? lowMap.get(l) : null);

  configs.push({
    canvasId: 'solar-cycle-chart',
    config: {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: i18n.t('detail.solar.cycleObserved'),
            data: obsAligned,
            borderColor: toRgba(CHART_COLORS.realtime, 0.9),
            backgroundColor: toRgba(CHART_COLORS.realtime, 0.1),
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.3,
            spanGaps: false,
            fill: false,
            order: 1,
          },
          {
            label: i18n.t('detail.solar.cyclePredicted'),
            data: predAligned,
            borderColor: toRgba(CHART_COLORS.realtime, 0.5),
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.3,
            spanGaps: false,
            fill: false,
            order: 2,
          },
          {
            label: 'High bound',
            data: highAligned,
            borderColor: 'transparent',
            backgroundColor: toRgba(CHART_COLORS.realtime, 0.06),
            borderWidth: 0,
            pointRadius: 0,
            fill: '+1',
            order: 3,
          },
          {
            label: 'Low bound',
            data: lowAligned,
            borderColor: 'transparent',
            backgroundColor: toRgba(CHART_COLORS.realtime, 0.06),
            borderWidth: 0,
            pointRadius: 0,
            fill: false,
            order: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              filter: (item) => item.text !== 'High bound' && item.text !== 'Low bound',
            },
          },
          tooltip: {
            filter: (item) => item.dataset.label !== 'High bound' && item.dataset.label !== 'Low bound',
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 12,
              maxRotation: 45,
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'SSN',
            },
          },
        },
      },
    },
  });

  return configs;
}

// --- Cleanup -------------------------------------------------------------

export function cleanup() {
  _observedData = null;
  _predictedData = null;
  _currentKp = null;
  console.log('[Solar] cleanup()');
}
