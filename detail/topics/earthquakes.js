/* ===================================================================
   World.One 1.0 -- Earthquakes Topic Module (RT-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: USGS Earthquake Hazards (live GeoJSON feeds, CORS-friendly)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

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

// --- Simplified continent outlines for SVG map -------------------------

const CONTINENT_PATHS = [
  // North America (simplified)
  'M50,80 L130,55 L160,65 L175,110 L145,140 L130,180 L105,175 L85,145 L50,130 Z',
  // South America (simplified)
  'M130,195 L155,180 L170,195 L175,235 L165,290 L145,320 L120,305 L115,255 L120,220 Z',
  // Europe (simplified)
  'M410,65 L460,55 L480,70 L470,90 L490,100 L465,115 L430,105 L410,95 Z',
  // Africa (simplified)
  'M420,130 L470,120 L500,145 L505,190 L490,240 L470,280 L440,290 L420,260 L410,210 L415,165 Z',
  // Asia (simplified)
  'M490,55 L600,35 L700,50 L730,80 L710,115 L680,130 L640,135 L600,145 L540,140 L500,130 L485,105 L490,80 Z',
  // Australia (simplified)
  'M680,260 L730,250 L760,265 L765,290 L740,310 L700,310 L680,290 Z',
  // Antarctica (simplified)
  'M100,420 L300,415 L500,420 L700,415 L800,425 L700,445 L300,445 L100,440 Z',
];

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
  _renderMap(blocks.chart, quakes24h, usgsSuccess);

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

function _renderMap(chartEl, quakes24h, usgsSuccess) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.earthquakes.mapTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      _buildSVGMap(quakes24h, chartEl, usgsSuccess),
      _buildMapLegend(),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.earthquakes.clickDot'),
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 'var(--space-xs)', textAlign: 'center' },
      }),
    ])
  );
}

function _buildSVGMap(quakes, containerEl, usgsSuccess) {
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

  // Grid lines for reference
  for (let lat = -60; lat <= 60; lat += 30) {
    const { y } = MathUtils.geoToSVG(lat, 0, 900, 450);
    const line = DOMUtils.createSVG('line', {
      x1: '0', y1: String(y), x2: '900', y2: String(y),
      stroke: 'rgba(255,255,255,0.04)',
      'stroke-width': '0.5',
    });
    svg.appendChild(line);
  }
  for (let lng = -150; lng <= 150; lng += 30) {
    const { x } = MathUtils.geoToSVG(0, lng, 900, 450);
    const line = DOMUtils.createSVG('line', {
      x1: String(x), y1: '0', x2: String(x), y2: '450',
      stroke: 'rgba(255,255,255,0.04)',
      'stroke-width': '0.5',
    });
    svg.appendChild(line);
  }

  if (!usgsSuccess || quakes.length === 0) {
    // Show "data unavailable" message
    const text = DOMUtils.createSVG('text', {
      x: '450', y: '225',
      'text-anchor': 'middle',
      fill: 'rgba(255,255,255,0.5)',
      'font-size': '16',
    });
    text.textContent = 'Data unavailable -- USGS fetch failed';
    svg.appendChild(text);
  } else {
    // Plot earthquake dots
    for (const quake of quakes) {
      const { x, y } = MathUtils.geoToSVG(quake.lat, quake.lng, 900, 450);
      const radius = MathUtils.remap(quake.magnitude, 2.5, 8, 3, 16);
      const color = depthToColor(quake.depth);

      const circle = DOMUtils.createSVG('circle', {
        cx: String(x),
        cy: String(y),
        r: String(radius),
        fill: color,
        opacity: '0.7',
        stroke: color,
        'stroke-width': '0.5',
        style: 'cursor:pointer;',
      });

      circle.addEventListener('click', (e) => {
        e.stopPropagation();
        _showPopup(wrapper, quake, e);
      });

      svg.appendChild(circle);
    }
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
