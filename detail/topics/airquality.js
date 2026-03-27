/* ===================================================================
   World.One 2.0 -- Air Quality Topic Module (ENV-04)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Open-Meteo Air Quality API (live AQI), WHO/World Bank 2023
         (hardcoded city AQI rankings, AQI-vs-GDP scatter)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'airquality',
  titleKey: 'detail.airquality.title',
  category: 'environment',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null;

// --- City AQI Rankings (WHO/Open-Meteo 2024 data) ---------------------
// 10 cleanest + 10 most polluted cities worldwide

const CITY_AQI = {
  cleanest: [
    { city: 'Helsinki', aqi: 18 },
    { city: 'Reykjavik', aqi: 20 },
    { city: 'Stockholm', aqi: 22 },
    { city: 'Oslo', aqi: 23 },
    { city: 'Hobart', aqi: 24 },
    { city: 'Zurich', aqi: 25 },
    { city: 'Auckland', aqi: 26 },
    { city: 'Copenhagen', aqi: 26 },
    { city: 'Edinburgh', aqi: 27 },
    { city: 'Vancouver', aqi: 28 },
  ],
  polluted: [
    { city: 'Baghdad', aqi: 115 },
    { city: 'Ho Chi Minh', aqi: 120 },
    { city: 'Mumbai', aqi: 135 },
    { city: 'Cairo', aqi: 140 },
    { city: 'Jakarta', aqi: 145 },
    { city: 'Beijing', aqi: 160 },
    { city: 'Kolkata', aqi: 195 },
    { city: 'Lahore', aqi: 230 },
    { city: 'Dhaka', aqi: 248 },
    { city: 'Delhi', aqi: 285 },
  ],
};

// --- AQI vs GDP per Capita (World Bank 2023 + Open-Meteo) --------------

const AQI_GDP_DATA = [
  { iso: 'US', aqi: 45, gdp: 76330, label: 'USA' },
  { iso: 'DE', aqi: 38, gdp: 48718, label: 'Germany' },
  { iso: 'IN', aqi: 170, gdp: 2389, label: 'India' },
  { iso: 'CN', aqi: 110, gdp: 12720, label: 'China' },
  { iso: 'JP', aqi: 42, gdp: 33815, label: 'Japan' },
  { iso: 'BR', aqi: 55, gdp: 8917, label: 'Brazil' },
  { iso: 'NG', aqi: 130, gdp: 1621, label: 'Nigeria' },
  { iso: 'GB', aqi: 35, gdp: 46371, label: 'UK' },
  { iso: 'FR', aqi: 40, gdp: 42330, label: 'France' },
  { iso: 'BD', aqi: 200, gdp: 2688, label: 'Bangladesh' },
  { iso: 'PK', aqi: 180, gdp: 1505, label: 'Pakistan' },
  { iso: 'ID', aqi: 95, gdp: 4788, label: 'Indonesia' },
  { iso: 'EG', aqi: 120, gdp: 3699, label: 'Egypt' },
  { iso: 'ZA', aqi: 60, gdp: 6001, label: 'S. Africa' },
  { iso: 'AU', aqi: 30, gdp: 65099, label: 'Australia' },
  { iso: 'CA', aqi: 32, gdp: 52722, label: 'Canada' },
  { iso: 'KR', aqi: 65, gdp: 32423, label: 'S. Korea' },
  { iso: 'SE', aqi: 22, gdp: 55873, label: 'Sweden' },
  { iso: 'NO', aqi: 20, gdp: 82832, label: 'Norway' },
  { iso: 'PL', aqi: 55, gdp: 18000, label: 'Poland' },
  { iso: 'MX', aqi: 75, gdp: 10948, label: 'Mexico' },
  { iso: 'SA', aqi: 95, gdp: 27044, label: 'Saudi Arabia' },
  { iso: 'TR', aqi: 70, gdp: 10674, label: 'Turkiye' },
  { iso: 'TH', aqi: 80, gdp: 7066, label: 'Thailand' },
  { iso: 'ET', aqi: 85, gdp: 1027, label: 'Ethiopia' },
];

// --- WHO Pollutant Thresholds ------------------------------------------

const POLLUTANTS = [
  {
    name: 'PM2.5',
    threshold: '15 \u00b5g/m\u00b3',
    whoLimit: '15 \u00b5g/m\u00b3 annual',
    effects: 'Respiratory & cardiovascular disease, lung cancer',
    sources: 'Combustion, industry, vehicle exhaust',
    color: '#d32f2f',
  },
  {
    name: 'PM10',
    threshold: '45 \u00b5g/m\u00b3',
    whoLimit: '45 \u00b5g/m\u00b3 annual',
    effects: 'Lung inflammation, aggravated asthma',
    sources: 'Dust, construction, traffic, wildfires',
    color: '#f57c00',
  },
  {
    name: 'NO\u2082',
    threshold: '25 \u00b5g/m\u00b3',
    whoLimit: '25 \u00b5g/m\u00b3 annual',
    effects: 'Airway inflammation, reduced lung function',
    sources: 'Vehicles, power plants, industrial processes',
    color: '#7b1fa2',
  },
];

// --- AQI Color Mapping -------------------------------------------------

function _aqiColor(aqi) {
  if (aqi <= 50) return '#4caf50';       // Good (green)
  if (aqi <= 100) return '#ffc107';      // Moderate (yellow)
  if (aqi <= 150) return '#ff9800';      // Unhealthy for sensitive (orange)
  return '#f44336';                       // Unhealthy (red)
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Data fetch: Try live AQI from Open-Meteo, fallback to cache/static
  let currentAqi = null;
  let tier = 'stale';
  let age = null;

  try {
    const liveRes = await fetchWithTimeout(
      'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=52.52&longitude=13.41&current=european_aqi',
      5000
    );
    if (liveRes.ok) {
      const liveJson = await liveRes.json();
      if (liveJson.current && liveJson.current.european_aqi != null) {
        currentAqi = Math.round(liveJson.current.european_aqi);
        tier = 'live';
        age = 0;
      }
    }
  } catch (_err) {
    // Non-blocking: fall through to cache/static
  }

  // Fallback to cached topic data
  if (currentAqi === null) {
    try {
      const cached = await fetchTopicData('airquality');
      if (cached.data && cached.data.value != null) {
        currentAqi = Math.round(cached.data.value);
      }
      tier = cached.tier || 'stale';
      age = cached.age;
    } catch (_err) {
      // Ignore
    }
  }

  // Final static fallback
  if (currentAqi === null) {
    currentAqi = 42;
    tier = 'static';
  }

  // 2. Hero block
  _renderHero(blocks.hero, currentAqi, tier, age);

  // 3. Chart block -- City AQI Rankings (horizontal bar)
  await _renderCitiesChart(blocks.chart);

  // 4. Trend block -- AQI vs GDP scatter
  await _renderScatterChart(blocks.trend);

  // 5. Tiles block -- WHO guidelines
  _renderTiles(blocks.tiles);

  // 6. Explanation block -- Pollutant explainer cards
  _renderExplanation(blocks.explanation);

  // 7. Comparison block
  _renderComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, currentAqi, tier, age) {
  const badge = createTierBadge(tier, { age });
  const color = _aqiColor(currentAqi);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'airquality-hero' }, [
      DOMUtils.create('div', {
        className: 'airquality-hero__value',
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        },
      }, [
        String(currentAqi),
        DOMUtils.create('span', {
          style: {
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
            flexShrink: '0',
            boxShadow: `0 0 8px ${color}`,
          },
        }),
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.airquality.heroUnit'),
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
          textContent: i18n.t('detail.airquality.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (City AQI Rankings) ------------------------------------

async function _renderCitiesChart(chartEl) {
  // Combine cleanest (ascending) and polluted (ascending) for display
  const allCities = [
    ...CITY_AQI.cleanest,
    ...CITY_AQI.polluted,
  ];

  const labels = allCities.map(c => c.city);
  const values = allCities.map(c => c.aqi);
  const colors = allCities.map(c =>
    CITY_AQI.cleanest.includes(c) ? '#4caf50' : '#f44336'
  );

  _chartData = { allCities, labels, values };

  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.airquality.citiesTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:450px;',
      }, [
        DOMUtils.create('canvas', { id: 'airquality-cities-chart' }),
      ]),
    ])
  );

  // Render horizontal bar chart directly
  await ensureChartJs();

  createChart('airquality-cities-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: i18n.t('detail.airquality.aqiUnit'),
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: i18n.t('detail.airquality.aqiUnit'),
          },
        },
        y: {
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `AQI: ${item.parsed.x}`,
          },
        },
      },
    },
  });
}

// --- Trend Block (AQI vs GDP Scatter) -----------------------------------

async function _renderScatterChart(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.airquality.scatterTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'airquality-scatter-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  // Prepare scatter data with per-point colors
  const scatterData = AQI_GDP_DATA.map(d => ({
    x: d.gdp,
    y: d.aqi,
  }));

  const pointColors = AQI_GDP_DATA.map(d => _aqiColor(d.aqi));

  createChart('airquality-scatter-chart', {
    type: 'scatter',
    data: {
      datasets: [{
        label: i18n.t('detail.airquality.aqiVsGdpLabel'),
        data: scatterData,
        backgroundColor: pointColors,
        borderColor: pointColors.map(c => c),
        borderWidth: 1,
        pointRadius: 6,
        pointHitRadius: 10,
      }],
    },
    options: {
      scales: {
        x: {
          type: 'logarithmic',
          title: {
            display: true,
            text: i18n.t('detail.airquality.gdpAxis'),
          },
          ticks: {
            callback: function (val) {
              if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
              return val;
            },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: i18n.t('detail.airquality.aqiAxisDesc'),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (item) => {
              const idx = item.dataIndex;
              const d = AQI_GDP_DATA[idx];
              return `${d.label}: AQI ${d.aqi}, GDP $${d.gdp.toLocaleString()}`;
            },
          },
        },
      },
    },
  });
}

// --- Tiles Block (WHO Guidelines) ----------------------------------------

function _renderTiles(tilesEl) {
  const tileData = [
    {
      label: i18n.t('detail.airquality.tilePM25'),
      value: '15 \u00b5g/m\u00b3',
      unit: 'WHO 2021',
    },
    {
      label: i18n.t('detail.airquality.tilePM10'),
      value: '45 \u00b5g/m\u00b3',
      unit: 'WHO 2021',
    },
    {
      label: i18n.t('detail.airquality.tileNO2'),
      value: '25 \u00b5g/m\u00b3',
      unit: 'WHO 2021',
    },
    {
      label: i18n.t('detail.airquality.tileDeaths'),
      value: '4.2M',
      unit: '/year',
      accent: '#d32f2f',
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

// --- Explanation Block (Pollutant Explainer Cards) -------------------------

function _renderExplanation(explEl) {
  // Heading
  explEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.airquality.explainerTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Pollutant cards
  const cards = POLLUTANTS.map(p =>
    DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        borderLeft: `4px solid ${p.color}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      },
    }, [
      // Header row: pollutant name + threshold
      DOMUtils.create('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      }, [
        DOMUtils.create('span', {
          textContent: p.name,
          style: { color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' },
        }),
        DOMUtils.create('span', {
          textContent: p.whoLimit,
          style: {
            color: p.color,
            fontSize: '0.8rem',
            fontWeight: '600',
            background: `${p.color}22`,
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
          },
        }),
      ]),
      // Health effects
      DOMUtils.create('div', {
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' },
      }, [
        DOMUtils.create('strong', { textContent: i18n.t('detail.airquality.healthLabel'), style: { color: 'var(--text-primary)' } }),
        p.effects,
      ]),
      // Sources
      DOMUtils.create('div', {
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' },
      }, [
        DOMUtils.create('strong', { textContent: i18n.t('detail.airquality.sourcesLabel'), style: { color: 'var(--text-primary)' } }),
        p.sources,
      ]),
    ])
  );

  explEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-sm)',
      },
    }, cards)
  );

  // Explanation paragraph
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.airquality.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.airquality.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.airquality.sourceOpenMeteo'),
      url: 'https://open-meteo.com/en/docs/air-quality-api',
    },
    {
      label: i18n.t('detail.airquality.sourceWHO'),
      url: 'https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health',
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

// --- Chart Configs (lazy-loaded by detail-app.js) ----------------------

export function getChartConfigs() {
  // Both charts rendered directly in render() for interactivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _chartData = null;
  console.log('[AirQuality] cleanup()');
}
