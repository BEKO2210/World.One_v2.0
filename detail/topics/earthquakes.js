/* ===================================================================
   World.One 2.0 -- Earthquakes Topic Module (RT-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: USGS Earthquake Hazards (live GeoJSON feeds, CORS-friendly)
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
  id: 'earthquakes',
  titleKey: 'detail.earthquakes.title',
  category: 'realtime',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _chartData = null;
let _tooltipEl = null;

// --- Depth to color mapping -------------------------------------------

function depthToColor(depth) {
  if (depth < 10) return '#ff3b30';   // shallow -- red
  if (depth < 70) return '#ff9500';   // medium -- orange
  if (depth < 300) return '#ffcc00';  // deep -- yellow
  return '#34c759';                    // very deep -- green
}

// --- Parse USGS GeoJSON features --------------------------------------

function parseQuakeFeatures(geojson) {
  if (!geojson || !geojson.features) return [];
  return geojson.features
    .filter(f => f.geometry && f.properties)
    .map(f => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2] || 0,
      magnitude: f.properties.mag || 0,
      place: f.properties.place || 'Unknown',
      time: f.properties.time || 0,
    }));
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch USGS live data (earthquakes have NO cache file)
  let quakes24h = [];
  let quakes7d = [];
  let tier = 'static';
  let age = null;
  let usgsSuccess = false;

  try {
    const [res24h, res7d] = await Promise.all([
      fetchWithTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', 8000),
      fetchWithTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson', 8000),
    ]);

    if (res24h.ok && res7d.ok) {
      const [json24h, json7d] = await Promise.all([res24h.json(), res7d.json()]);
      quakes24h = parseQuakeFeatures(json24h);
      quakes7d = parseQuakeFeatures(json7d);
      tier = 'live';
      age = 0;
      usgsSuccess = true;
    }
  } catch (err) {
    console.warn('[Earthquakes] USGS fetch failed:', err.message);
  }

  // Fallback: try fetchTopicData for static hero numbers
  let fallbackData = null;
  if (!usgsSuccess) {
    try {
      const result = await fetchTopicData('earthquakes');
      fallbackData = result.data;
      tier = result.tier;
      age = result.age;
    } catch (_err) {
      // Use defaults
    }
  }

  // Store 7-day data for histogram chart config
  _chartData = { quakes7d };

  // Compute hero values
  const count24h = usgsSuccess ? quakes24h.length : (fallbackData?.significant_24h?.value ?? 0);
  const largest24h = usgsSuccess
    ? quakes24h.reduce((max, q) => q.magnitude > max ? q.magnitude : max, 0)
    : 0;
  const avgDepth = usgsSuccess && quakes24h.length > 0
    ? quakes24h.reduce((sum, q) => sum + q.depth, 0) / quakes24h.length
    : 0;
  const total7d = usgsSuccess ? quakes7d.length : 0;

  // --- 2. Hero Block ---
  _renderHero(blocks.hero, count24h, largest24h, tier, age);

  // --- 3. Chart Block (Interactive SVG Earthquake Map) ---
  await _renderMap(blocks.chart, quakes24h, usgsSuccess);

  // --- 4. Trend Block (7-Day Magnitude Histogram) ---
  _renderHistogram(blocks.trend);

  // --- 5. Tiles Block ---
  _renderTiles(blocks.tiles, count24h, largest24h, avgDepth, total7d, usgsSuccess);

  // --- 6. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 7. Comparison Block ---
  _renderComparison(blocks.comparison);

  // --- 8. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, count24h, largest24h, tier, age) {
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'earthquakes-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        String(count24h),
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.earthquakes.heroUnit'),
        }),
      ]),
      largest24h > 0
        ? DOMUtils.create('div', {
            style: {
              fontSize: '1.1rem',
              color: toRgba(CHART_COLORS.realtime, 0.9),
              marginBottom: 'var(--space-xs)',
              fontWeight: '600',
            },
            textContent: `${i18n.t('detail.earthquakes.tileLargest')}: M${largest24h.toFixed(1)}`,
          })
        : null,
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-sm)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.earthquakes.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ].filter(Boolean))
  );
}

// --- SVG Earthquake Map -------------------------------------------------

async function _renderMap(chartEl, quakes24h, usgsSuccess) {
  const mapResult = await _buildSVGMap(quakes24h, usgsSuccess);

  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.earthquakes.mapTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      mapResult,
      _buildMapLegend(),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.earthquakes.clickDot'),
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 'var(--space-xs)', textAlign: 'center' },
      }),
    ])
  );
}

async function _buildSVGMap(quakes, usgsSuccess) {
  const map = await createMarkerMap();

  if (!map) {
    return DOMUtils.create('p', {
      textContent: i18n.t('detail.earthquakes.mapUnavailable'),
      style: { color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' },
    });
  }

  const { wrapper, overlay, geoToXY, svgWidth } = map;

  // Scale factor: radii designed for 900px width, now 2000px
  const scaleFactor = svgWidth / 900;

  if (!usgsSuccess || quakes.length === 0) {
    // Show "data unavailable" message on the overlay
    const text = DOMUtils.createSVG('text', {
      x: String(svgWidth / 2), y: '428',
      'text-anchor': 'middle',
      fill: 'rgba(255,255,255,0.5)',
      'font-size': '32',
    });
    text.textContent = i18n.t('detail.earthquakes.dataUnavailable');
    overlay.appendChild(text);
  } else {
    // Plot earthquake dots on the overlay
    for (const quake of quakes) {
      const { x, y } = geoToXY(quake.lat, quake.lng);
      const radius = MathUtils.remap(quake.magnitude, 2.5, 8, 3, 16) * scaleFactor;
      const color = depthToColor(quake.depth);

      const circle = DOMUtils.createSVG('circle', {
        cx: String(x),
        cy: String(y),
        r: String(radius),
        fill: color,
        opacity: '0.7',
        stroke: color,
        'stroke-width': '1',
        style: 'cursor:pointer; pointer-events:auto;',
      });

      circle.addEventListener('click', (e) => {
        e.stopPropagation();
        _showPopup(wrapper, quake, e);
      });

      overlay.appendChild(circle);
    }
  }

  // Click outside removes popup
  wrapper.addEventListener('click', () => {
    if (_tooltipEl) {
      _tooltipEl.remove();
      _tooltipEl = null;
    }
  });

  return wrapper;
}

function _showPopup(container, quake, event) {
  if (_tooltipEl) {
    _tooltipEl.remove();
    _tooltipEl = null;
  }

  _tooltipEl = DOMUtils.create('div', {
    className: 'quake-popup',
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
      maxWidth: '250px',
    },
  }, [
    DOMUtils.create('div', {
      textContent: `M${quake.magnitude.toFixed(1)}`,
      style: { fontWeight: '700', fontSize: '1.1rem', marginBottom: '4px' },
    }),
    DOMUtils.create('div', {
      textContent: MathUtils.escapeHTML(quake.place),
      style: { marginBottom: '4px' },
    }),
    DOMUtils.create('div', {
      textContent: `${i18n.t('detail.earthquakes.depth')}: ${quake.depth.toFixed(1)} km`,
      style: { color: 'var(--text-secondary)' },
    }),
    DOMUtils.create('div', {
      textContent: new Date(quake.time).toLocaleString(),
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
    }),
  ]);

  // Position near click point within the wrapper
  const rect = container.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  _tooltipEl.style.left = `${Math.min(offsetX + 12, rect.width - 260)}px`;
  _tooltipEl.style.top = `${offsetY - 10}px`;

  container.appendChild(_tooltipEl);
}

function _buildMapLegend() {
  const items = [
    { color: '#ff3b30', label: '< 10 km' },
    { color: '#ff9500', label: '10 - 70 km' },
    { color: '#ffcc00', label: '70 - 300 km' },
    { color: '#34c759', label: '> 300 km' },
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
  }, [
    DOMUtils.create('span', {
      textContent: `${i18n.t('detail.earthquakes.depth')}:`,
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600' },
    }),
    ...legendItems,
  ]);
}

// --- Histogram Block (7-Day Magnitude) ----------------------------------

function _renderHistogram(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.earthquakes.histogramTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'quake-histogram-canvas' }),
      ]),
    ])
  );
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, count24h, largest24h, avgDepth, total7d, usgsSuccess) {
  const tileData = [
    {
      label: i18n.t('detail.earthquakes.tileSignificant'),
      value: usgsSuccess ? String(count24h) : '--',
      unit: '24h',
    },
    {
      label: i18n.t('detail.earthquakes.tileLargest'),
      value: usgsSuccess && largest24h > 0 ? `M${largest24h.toFixed(1)}` : '--',
      unit: '24h',
    },
    {
      label: i18n.t('detail.earthquakes.tileDepthAvg'),
      value: usgsSuccess && avgDepth > 0 ? `${avgDepth.toFixed(0)} km` : '--',
      unit: '24h',
    },
    {
      label: i18n.t('detail.earthquakes.tileTotalWeek'),
      value: usgsSuccess ? String(total7d) : '--',
      unit: '7d',
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

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.earthquakes.title'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.earthquakes.explanation'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.earthquakes.comparison'),
        style: { color: 'var(--text-secondary)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Comparison Block ---------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.earthquakes.comparison'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.earthquakes.comparison'),
        style: { color: 'var(--text-secondary)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.earthquakes.sourceUSGS'),
      url: 'https://earthquake.usgs.gov/earthquakes/feed/',
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

  // Magnitude histogram: 5 bins from 7-day data
  if (_chartData && _chartData.quakes7d && _chartData.quakes7d.length > 0) {
    const bins = [
      { label: '2.5-3.0', min: 2.5, max: 3.0, count: 0 },
      { label: '3.0-4.0', min: 3.0, max: 4.0, count: 0 },
      { label: '4.0-5.0', min: 4.0, max: 5.0, count: 0 },
      { label: '5.0-6.0', min: 5.0, max: 6.0, count: 0 },
      { label: '6.0+', min: 6.0, max: Infinity, count: 0 },
    ];

    for (const quake of _chartData.quakes7d) {
      const mag = quake.magnitude;
      for (const bin of bins) {
        if (mag >= bin.min && mag < bin.max) {
          bin.count++;
          break;
        }
      }
    }

    configs.push({
      canvasId: 'quake-histogram-canvas',
      blockId: 'detail-trend',
      config: {
        type: 'bar',
        data: {
          labels: bins.map(b => b.label),
          datasets: [{
            label: i18n.t('detail.earthquakes.count'),
            data: bins.map(b => b.count),
            backgroundColor: toRgba(CHART_COLORS.realtime, 0.7),
            borderColor: toRgba(CHART_COLORS.realtime),
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          scales: {
            x: {
              title: {
                display: true,
                text: i18n.t('detail.earthquakes.magnitude'),
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: i18n.t('detail.earthquakes.count'),
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => `${item.parsed.y} ${i18n.t('detail.earthquakes.count')}`,
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
  if (_tooltipEl) {
    _tooltipEl.remove();
    _tooltipEl = null;
  }
  console.log('[Earthquakes] cleanup()');
}
