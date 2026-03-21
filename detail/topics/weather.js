/* ===================================================================
   World.One 1.0 -- Weather Topic Module (RT-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Open-Meteo forecast API (live, 24 cities worldwide)
   Visualizations: City cards with SVG sparklines, extreme weather
                   warnings with color-coded severity badges
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'weather',
  titleKey: 'detail.weather.title',
  category: 'realtime',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null; // No intervals -- one-shot fetch

// --- 24 Cities (all continents) ----------------------------------------

const WEATHER_CITIES = [
  // Europe (5)
  { name: 'Berlin', lat: 52.52, lng: 13.41 },
  { name: 'London', lat: 51.51, lng: -0.13 },
  { name: 'Paris', lat: 48.86, lng: 2.35 },
  { name: 'Moscow', lat: 55.76, lng: 37.62 },
  { name: 'Rome', lat: 41.90, lng: 12.50 },
  // North America (4)
  { name: 'New York', lat: 40.71, lng: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Mexico City', lat: 19.43, lng: -99.13 },
  { name: 'Toronto', lat: 43.65, lng: -79.38 },
  // South America (3)
  { name: 'Sao Paulo', lat: -23.55, lng: -46.63 },
  { name: 'Buenos Aires', lat: -34.60, lng: -58.38 },
  { name: 'Lima', lat: -12.05, lng: -77.04 },
  // Asia (5)
  { name: 'Tokyo', lat: 35.68, lng: 139.69 },
  { name: 'Beijing', lat: 39.90, lng: 116.40 },
  { name: 'Mumbai', lat: 19.08, lng: 72.88 },
  { name: 'Dubai', lat: 25.20, lng: 55.27 },
  { name: 'Seoul', lat: 37.57, lng: 126.98 },
  // Africa (4)
  { name: 'Lagos', lat: 6.45, lng: 3.40 },
  { name: 'Cairo', lat: 30.04, lng: 31.24 },
  { name: 'Nairobi', lat: -1.29, lng: 36.82 },
  { name: 'Cape Town', lat: -33.93, lng: 18.42 },
  // Oceania (2)
  { name: 'Sydney', lat: -33.87, lng: 151.21 },
  { name: 'Auckland', lat: -36.85, lng: 174.76 },
  // Antarctica (1)
  { name: 'McMurdo', lat: -77.85, lng: 166.67 },
];

// --- WMO Weather Code Mapping (WMO Code Table 4677) -------------------

const WMO_CODES = {
  0:  { desc: 'Clear sky',         icon: 'sun',      severity: 0 },
  1:  { desc: 'Mainly clear',      icon: 'sun',      severity: 0 },
  2:  { desc: 'Partly cloudy',     icon: 'cloud-sun', severity: 0 },
  3:  { desc: 'Overcast',          icon: 'cloud',    severity: 0 },
  45: { desc: 'Fog',               icon: 'fog',      severity: 1 },
  48: { desc: 'Rime fog',          icon: 'fog',      severity: 1 },
  51: { desc: 'Light drizzle',     icon: 'drizzle',  severity: 1 },
  53: { desc: 'Moderate drizzle',  icon: 'drizzle',  severity: 1 },
  55: { desc: 'Dense drizzle',     icon: 'drizzle',  severity: 2 },
  61: { desc: 'Slight rain',       icon: 'rain',     severity: 1 },
  63: { desc: 'Moderate rain',     icon: 'rain',     severity: 2 },
  65: { desc: 'Heavy rain',        icon: 'rain',     severity: 3 },
  71: { desc: 'Slight snow',       icon: 'snow',     severity: 1 },
  73: { desc: 'Moderate snow',     icon: 'snow',     severity: 2 },
  75: { desc: 'Heavy snow',        icon: 'snow',     severity: 3 },
  77: { desc: 'Snow grains',       icon: 'snow',     severity: 1 },
  80: { desc: 'Slight showers',    icon: 'showers',  severity: 1 },
  81: { desc: 'Moderate showers',  icon: 'showers',  severity: 2 },
  82: { desc: 'Violent showers',   icon: 'showers',  severity: 3 },
  85: { desc: 'Slight snow showers', icon: 'snow',   severity: 2 },
  86: { desc: 'Heavy snow showers', icon: 'snow',    severity: 3 },
  95: { desc: 'Thunderstorm',      icon: 'thunder',  severity: 3 },
  96: { desc: 'Thunderstorm + hail', icon: 'thunder', severity: 4 },
  99: { desc: 'Severe thunderstorm', icon: 'thunder', severity: 4 },
};

function severityColor(severity) {
  if (severity >= 4) return '#ff3b30';   // Red -- severe
  if (severity >= 3) return '#ff9500';   // Orange -- heavy
  if (severity >= 2) return '#ffcc00';   // Yellow -- moderate
  return 'var(--text-secondary)';        // Gray -- normal
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // --- 1. Hero block ---
  const badge = createTierBadge('live', { age: 0 });
  _renderHero(blocks.hero, badge);

  // --- 2. Fetch weather data for all 24 cities ---
  const cityResults = await _fetchAllCities();
  _chartData = { cityResults };

  // --- 3. Update hero with extremes ---
  _updateHeroExtremes(blocks.hero, cityResults);

  // --- 4. City cards grid (chart block) ---
  _renderCityCards(blocks.chart, cityResults);

  // --- 5. Extreme weather warnings (trend block) ---
  _renderWarnings(blocks.trend, cityResults);

  // --- 6. Context tiles ---
  _renderTiles(blocks.tiles, cityResults);

  // --- 7. Explanation block ---
  _renderExplanation(blocks.explanation);

  // --- 8. Comparison block ---
  _renderComparison(blocks.comparison);

  // --- 9. Sources block ---
  _renderSources(blocks.sources);
}

// --- Hero Block ---------------------------------------------------------

function _renderHero(heroEl, badge) {
  heroEl.appendChild(
    DOMUtils.create('div', { className: 'weather-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        String(WEATHER_CITIES.length),
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.weather.heroUnit'),
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
          textContent: i18n.t('detail.weather.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      // Extremes placeholder -- updated after data loads
      DOMUtils.create('div', {
        className: 'weather-extremes',
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
      }),
    ])
  );
}

function _updateHeroExtremes(heroEl, cityResults) {
  const valid = cityResults.filter(c => c.currentTemp !== null);
  if (valid.length === 0) return;

  let hottest = valid[0];
  let coldest = valid[0];
  for (const c of valid) {
    if (c.currentTemp > hottest.currentTemp) hottest = c;
    if (c.currentTemp < coldest.currentTemp) coldest = c;
  }

  const extremesEl = heroEl.querySelector('.weather-extremes');
  if (extremesEl) {
    extremesEl.textContent = '';
    extremesEl.appendChild(
      DOMUtils.create('div', {
        style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' },
      }, [
        DOMUtils.create('span', {
          textContent: `${hottest.name}: ${hottest.currentTemp.toFixed(1)}\u00B0C`,
          style: { color: '#ff3b30', fontWeight: '600' },
        }),
        DOMUtils.create('span', {
          textContent: `${coldest.name}: ${coldest.currentTemp.toFixed(1)}\u00B0C`,
          style: { color: '#5ac8fa', fontWeight: '600' },
        }),
      ])
    );
  }
}

// --- Fetch All Cities ----------------------------------------------------

async function _fetchAllCities() {
  const promises = WEATHER_CITIES.map(city => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&hourly=temperature_2m,weather_code&forecast_hours=24&timezone=auto`;
    return fetchWithTimeout(url, 8000)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => ({
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        hourlyTemps: json.hourly?.temperature_2m || [],
        hourlyWeather: json.hourly?.weather_code || [],
        currentTemp: json.hourly?.temperature_2m?.[0] ?? null,
        currentCode: json.hourly?.weather_code?.[0] ?? 0,
        available: true,
      }))
      .catch(_err => ({
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        hourlyTemps: [],
        hourlyWeather: [],
        currentTemp: null,
        currentCode: 0,
        available: false,
      }));
  });

  const results = await Promise.allSettled(promises);
  return results.map(r => r.status === 'fulfilled' ? r.value : {
    name: 'Unknown',
    lat: 0,
    lng: 0,
    hourlyTemps: [],
    hourlyWeather: [],
    currentTemp: null,
    currentCode: 0,
    available: false,
  });
}

// --- City Cards Grid (chart block) ---------------------------------------

function _renderCityCards(chartEl, cityResults) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.weather.citiesTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const cards = cityResults.map(city => _buildCityCard(city));

  chartEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, cards)
  );
}

function _buildCityCard(city) {
  // Determine warning level from max weather code in 24h
  const maxCode = city.hourlyWeather.length > 0
    ? Math.max(...city.hourlyWeather)
    : 0;
  const warnInfo = _getWarningInfo(maxCode);
  const borderColor = warnInfo ? severityColor(warnInfo.severity) : 'transparent';

  // Current weather description
  const currentWeather = WMO_CODES[city.currentCode] || WMO_CODES[0];

  // Temperature display
  const tempDisplay = city.currentTemp !== null
    ? `${city.currentTemp.toFixed(1)}\u00B0C`
    : '--';

  // Build sparkline
  const sparkline = city.hourlyTemps.length >= 2
    ? _createSparkline(city.hourlyTemps)
    : null;

  return DOMUtils.create('div', {
    style: {
      padding: '12px 14px',
      background: 'rgba(255, 255, 255, 0.04)',
      borderRadius: '8px',
      borderLeft: warnInfo ? `3px solid ${borderColor}` : '3px solid transparent',
    },
  }, [
    // City name
    DOMUtils.create('div', {
      textContent: city.name,
      style: { color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' },
    }),
    // Current temperature
    DOMUtils.create('div', {
      textContent: tempDisplay,
      style: {
        fontSize: '1.6rem',
        fontWeight: '600',
        color: city.available ? 'var(--text-primary)' : 'var(--text-secondary)',
        marginBottom: '2px',
        fontVariantNumeric: 'tabular-nums',
      },
    }),
    // Weather description
    DOMUtils.create('div', {
      textContent: city.available ? currentWeather.desc : 'Unavailable',
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '8px' },
    }),
    // SVG sparkline
    sparkline || null,
    // Warning badge (if applicable)
    warnInfo
      ? DOMUtils.create('div', {
          textContent: warnInfo.label,
          style: {
            marginTop: '6px',
            fontSize: '0.7rem',
            fontWeight: '700',
            padding: '2px 8px',
            borderRadius: '4px',
            display: 'inline-block',
            background: severityColor(warnInfo.severity),
            color: warnInfo.severity >= 3 ? '#fff' : '#1a1a2e',
          },
        })
      : null,
  ].filter(Boolean));
}

// --- SVG Sparkline -------------------------------------------------------

function _createSparkline(hourlyTemps, width = 120, height = 40) {
  const svg = DOMUtils.createSVG('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    height: String(height),
    style: 'display:block;',
  });

  const min = Math.min(...hourlyTemps);
  const max = Math.max(...hourlyTemps);
  const range = max - min || 1;

  const points = hourlyTemps.map((t, i) => {
    const x = (i / (hourlyTemps.length - 1)) * width;
    const y = height - ((t - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  svg.appendChild(DOMUtils.createSVG('polyline', {
    points,
    fill: 'none',
    stroke: toRgba(CHART_COLORS.realtime, 0.8),
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));

  return svg;
}

// --- Warning Helpers -----------------------------------------------------

function _getWarningInfo(maxCode) {
  if (maxCode >= 95) return { label: 'Thunderstorm', severity: (WMO_CODES[maxCode] || WMO_CODES[95]).severity };
  if (maxCode >= 75) return { label: 'Heavy snow', severity: (WMO_CODES[maxCode] || WMO_CODES[75]).severity };
  if (maxCode >= 65) return { label: 'Heavy rain', severity: (WMO_CODES[maxCode] || WMO_CODES[65]).severity };
  return null;
}

function _collectWarnings(cityResults) {
  const warnings = [];
  for (const city of cityResults) {
    if (!city.available || city.hourlyWeather.length === 0) continue;
    const maxCode = Math.max(...city.hourlyWeather);
    const warnInfo = _getWarningInfo(maxCode);
    if (warnInfo) {
      warnings.push({ city: city.name, ...warnInfo });
    }
  }
  return warnings;
}

// --- Extreme Weather Warnings (trend block) ------------------------------

function _renderWarnings(trendEl, cityResults) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.weather.warningTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const warnings = _collectWarnings(cityResults);

  if (warnings.length === 0) {
    trendEl.appendChild(
      DOMUtils.create('div', {
        style: {
          padding: '16px',
          background: 'rgba(52, 199, 89, 0.08)',
          borderRadius: '8px',
          border: '1px solid rgba(52, 199, 89, 0.2)',
          color: 'rgba(52, 199, 89, 0.9)',
          fontSize: '0.9rem',
          textAlign: 'center',
        },
        textContent: 'No severe weather warnings',
      })
    );
    return;
  }

  const warningItems = warnings.map(w =>
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        marginBottom: '6px',
        borderLeft: `3px solid ${severityColor(w.severity)}`,
      },
    }, [
      DOMUtils.create('span', {
        textContent: w.city,
        style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem', flex: '1' },
      }),
      DOMUtils.create('span', {
        textContent: w.label,
        style: {
          fontSize: '0.7rem',
          fontWeight: '700',
          padding: '2px 8px',
          borderRadius: '4px',
          background: severityColor(w.severity),
          color: w.severity >= 3 ? '#fff' : '#1a1a2e',
        },
      }),
    ])
  );

  trendEl.appendChild(
    DOMUtils.create('div', { className: 'weather-warnings' }, warningItems)
  );
}

// --- Context Tiles -------------------------------------------------------

function _renderTiles(tilesEl, cityResults) {
  const valid = cityResults.filter(c => c.currentTemp !== null);

  let hottestName = '--';
  let hottestTemp = '--';
  let coldestName = '--';
  let coldestTemp = '--';
  let warningCount = 0;

  if (valid.length > 0) {
    let hottest = valid[0];
    let coldest = valid[0];
    for (const c of valid) {
      if (c.currentTemp > hottest.currentTemp) hottest = c;
      if (c.currentTemp < coldest.currentTemp) coldest = c;
    }
    hottestName = hottest.name;
    hottestTemp = `${hottest.currentTemp.toFixed(1)}\u00B0C`;
    coldestName = coldest.name;
    coldestTemp = `${coldest.currentTemp.toFixed(1)}\u00B0C`;
  }

  warningCount = _collectWarnings(cityResults).length;

  const tileData = [
    {
      label: i18n.t('detail.weather.tileHot'),
      value: hottestTemp,
      unit: hottestName,
    },
    {
      label: i18n.t('detail.weather.tileCold'),
      value: coldestTemp,
      unit: coldestName,
    },
    {
      label: i18n.t('detail.weather.tileWarnings'),
      value: String(warningCount),
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
        gridTemplateColumns: '1fr 1fr 1fr',
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
        textContent: i18n.t('detail.weather.title'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.weather.explanation'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.weather.comparison'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.weather.comparison'),
        style: { color: 'var(--text-secondary)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.weather.sourceOM'),
      url: 'https://open-meteo.com/',
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

// --- Chart Configs (none -- all SVG sparklines) --------------------------

export function getChartConfigs() {
  return [];
}

// --- Cleanup -------------------------------------------------------------

export function cleanup() {
  // No intervals -- weather is a one-shot fetch
  _chartData = null;
  console.log('[Weather] cleanup()');
}
