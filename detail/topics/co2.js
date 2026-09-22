/* ===================================================================
   World.One 2.0 -- CO2 Topic Module (ENV-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: NOAA Mauna Loa (Keeling Curve), World Bank (per-capita),
         Global Carbon Project (total emissions)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { fmtNumber } from '../../js/utils/fmt.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'co2',
  titleKey: 'detail.co2.title',
  category: 'environment',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null;

// --- Top 10 emitters per capita (World Bank EN.ATM.CO2E.PC, 2020) ------

const TOP_EMITTERS = [
  { country: 'Qatar', value: 32.8 },
  { country: 'Bahrain', value: 25.7 },
  { country: 'Kuwait', value: 21.6 },
  { country: 'UAE', value: 20.7 },
  { country: 'Brunei', value: 18.4 },
  { country: 'Saudi Arabia', value: 15.3 },
  { country: 'Australia', value: 15.0 },
  { country: 'USA', value: 13.0 },
  { country: 'Canada', value: 12.4 },
  { country: 'South Korea', value: 11.6 },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached CO2 history data
  const { data, tier, age } = await fetchTopicData('co2-history');

  // Extract monthly series from cache data
  const monthly = (data && data.monthly) ? data.monthly : [];

  // 2. Aktueller Wert = letzter Monatsmittelwert Mauna Loa (NOAA).
  // Früher: Open-Meteo-Modellwert (CAMS, bodennah) — ~10 ppm über der
  // Messreihe und nicht mit der Keeling-Kurve vergleichbar.
  const last = monthly.length > 0 ? monthly[monthly.length - 1] : null;
  const currentPpm = last ? last.value : 427.5;
  const asOf = last ? `${last.year}-${String(last.month).padStart(2, '0')}` : null;

  // Store monthly data for getChartConfigs()
  _chartData = { monthly };

  // Anstieg: Mittel der letzten 12 Monate gegen die 12 davor
  const mean = (arr) => arr.reduce((sum, m) => sum + m.value, 0) / arr.length;
  const annualIncrease = monthly.length >= 24
    ? Math.round((mean(monthly.slice(-12)) - mean(monthly.slice(-24, -12))) * 100) / 100
    : 2.4;

  // Static fallback values
  const totalEmissions = 37.4;
  const preIndustrial = 280;
  const increaseSincePreIndustrial = currentPpm - preIndustrial;
  const increasePercent = fmtNumber(((increaseSincePreIndustrial / preIndustrial) * 100), { decimals: 1 });

  // --- 3. Hero Block ---
  _renderHero(blocks.hero, currentPpm, tier, age, asOf);

  // --- 4. Chart Block (Keeling Curve canvas) ---
  _renderChartBlock(blocks.chart);

  // --- 5. Trend Block (Emissions per capita canvas) ---
  _renderTrendBlock(blocks.trend);

  // --- 6. Tiles Block ---
  _renderTiles(blocks.tiles, currentPpm, annualIncrease, totalEmissions, preIndustrial, increaseSincePreIndustrial, increasePercent);

  // --- 7. Explanation Block ---
  _renderExplanation(blocks.explanation);

  // --- 8. Comparison Block ---
  _renderComparison(blocks.comparison, currentPpm);

  // --- 9. Sources Block ---
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, currentPpm, tier, age, asOf) {
  const ppmFormatted = fmtNumber(currentPpm, { decimals: 1 });

  const badge = createTierBadge(tier, { age, dataAsOf: asOf, cadence: 'monthly', source: 'NOAA Mauna Loa' });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'co2-hero' }, [
      DOMUtils.create('div', {
        className: 'co2-hero__value',
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        ppmFormatted,
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.co2.heroUnit'),
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
          textContent: i18n.t('detail.co2.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (Keeling Curve) ----------------------------------------

function _renderChartBlock(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.co2.keelingTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'co2-keeling-canvas' }),
      ]),
    ])
  );
}

// --- Trend Block (Emissions per capita bar chart) -----------------------

function _renderTrendBlock(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.co2.emissionsTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.co2.countryBarLabel'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'co2-emissions-canvas' }),
      ]),
    ])
  );
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, currentPpm, annualIncrease, totalEmissions, preIndustrial, increaseSincePreIndustrial, increasePercent) {
  const tileData = [
    {
      label: i18n.t('detail.co2.tileAnnualIncrease'),
      value: `+${annualIncrease}`,
      unit: i18n.t('detail.co2.ppm') + '/yr',
    },
    {
      label: i18n.t('detail.co2.tileTotalEmissions'),
      value: totalEmissions.toString(),
      unit: i18n.t('detail.co2.gt'),
    },
    {
      label: i18n.t('detail.co2.tilePreIndustrial'),
      value: `~${preIndustrial}`,
      unit: i18n.t('detail.co2.ppm'),
    },
    {
      label: i18n.t('detail.co2.tileSincePreIndustrial'),
      value: `+${fmtNumber(increaseSincePreIndustrial, { decimals: 1 })}`,
      unit: `${i18n.t('detail.co2.ppm')} (+${increasePercent}%)`,
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Explanation Block (Greenhouse Effect) -------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.co2.greenhouseTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.co2.explanation'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.co2.explanation2'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', lineHeight: '1.6' },
      }),
      // Greenhouse effect infographic (DOM-based)
      _buildGreenhouseInfographic(),
    ])
  );
}

/**
 * Build a simple DOM-based infographic illustrating the greenhouse effect.
 * Uses flexbox with colored blocks for sun, atmosphere, and earth layers.
 */
function _buildGreenhouseInfographic() {
  const sunLayer = DOMUtils.create('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-sm)',
      background: 'rgba(255, 215, 0, 0.15)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 215, 0, 0.3)',
      minHeight: '50px',
    },
  }, [
    DOMUtils.create('span', {
      style: { fontSize: '1.5rem', marginRight: '0.5rem' },
      textContent: '\u2600\uFE0F',
    }),
    DOMUtils.create('span', {
      textContent: i18n.t('detail.co2.solarRadiation'),
      style: { color: 'rgba(255, 215, 0, 0.9)', fontSize: '0.85rem', fontWeight: '600' },
    }),
  ]);

  const arrowDown = DOMUtils.create('div', {
    style: {
      textAlign: 'center',
      fontSize: '1.2rem',
      color: 'rgba(255, 215, 0, 0.6)',
      padding: '0.25rem 0',
    },
    textContent: '\u2193 \u2193 \u2193',
  });

  const atmosphereLayer = DOMUtils.create('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-sm)',
      background: 'rgba(0, 180, 216, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(0, 180, 216, 0.3)',
      minHeight: '50px',
    },
  }, [
    DOMUtils.create('span', {
      textContent: i18n.t('detail.co2.greenhouseGases'),
      style: { color: 'rgba(0, 180, 216, 0.9)', fontSize: '0.85rem', fontWeight: '600' },
    }),
    DOMUtils.create('span', {
      style: { color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '0.5rem' },
      textContent: i18n.t('detail.co2.gasesTrapped'),
    }),
  ]);

  const arrowBoth = DOMUtils.create('div', {
    style: {
      textAlign: 'center',
      fontSize: '1.2rem',
      color: 'rgba(255, 107, 107, 0.6)',
      padding: '0.25rem 0',
    },
    textContent: `\u2193 ${i18n.t('detail.co2.irRadiation')} \u2191`,
  });

  const earthLayer = DOMUtils.create('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-sm)',
      background: 'rgba(0, 255, 100, 0.08)',
      borderRadius: '8px',
      border: '1px solid rgba(0, 255, 100, 0.25)',
      minHeight: '50px',
    },
  }, [
    DOMUtils.create('span', {
      style: { fontSize: '1.5rem', marginRight: '0.5rem' },
      textContent: '\uD83C\uDF0D',
    }),
    DOMUtils.create('span', {
      textContent: i18n.t('detail.co2.earthAbsorbs'),
      style: { color: 'rgba(0, 255, 100, 0.9)', fontSize: '0.85rem', fontWeight: '600' },
    }),
  ]);

  return DOMUtils.create('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      padding: 'var(--space-sm)',
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
    },
  }, [sunLayer, arrowDown, atmosphereLayer, arrowBoth, earthLayer]);
}

// --- Comparison Block ---------------------------------------------------

function _renderComparison(compEl, currentPpm) {
  const compText = i18n.t('detail.co2.comparison', { current: fmtNumber(currentPpm, { decimals: 1 }) });

  compEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.comparison') || i18n.t('detail.co2.title'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      // Visual comparison bar
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-sm)',
        },
      }, [
        _buildCompBar('280 ppm', 280 / currentPpm * 100, 'rgba(0, 180, 216, 0.3)'),
        DOMUtils.create('span', {
          textContent: '\u2192',
          style: { color: 'var(--text-secondary)', fontSize: '1.2rem' },
        }),
        _buildCompBar(`${fmtNumber(currentPpm, { decimals: 1 })} ppm`, 100, 'rgba(255, 107, 107, 0.3)'),
      ]),
      DOMUtils.create('p', {
        textContent: compText,
        style: { color: 'var(--text-secondary)', lineHeight: '1.6' },
      }),
    ])
  );
}

function _buildCompBar(label, widthPct, bgColor) {
  return DOMUtils.create('div', {
    style: {
      flex: '1',
      background: bgColor,
      borderRadius: '6px',
      padding: '0.5rem 0.75rem',
      textAlign: 'center',
      position: 'relative',
      minWidth: `${Math.max(widthPct * 0.5, 30)}%`,
    },
  }, [
    DOMUtils.create('span', {
      textContent: label,
      style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' },
    }),
  ]);
}

// --- Sources Block ------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.co2.sourceNOAA'),
      url: 'https://gml.noaa.gov/ccgg/trends/',
    },
    {
      label: i18n.t('detail.co2.sourceWorldBank'),
      url: 'https://data.worldbank.org/indicator/EN.ATM.CO2E.PC',
    },
    {
      label: i18n.t('detail.co2.sourceGCP'),
      url: 'https://www.globalcarbonproject.org/',
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
  const configs = [];

  // 1. Keeling Curve (line chart)
  if (_chartData && _chartData.monthly && _chartData.monthly.length > 0) {
    const labels = _chartData.monthly.map(
      d => `${d.year}-${String(d.month).padStart(2, '0')}`
    );
    const values = _chartData.monthly.map(d => d.value);

    configs.push({
      canvasId: 'co2-keeling-canvas',
      blockId: 'detail-chart',
      config: {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: i18n.t('detail.co2.heroLabel'),
            data: values,
            borderColor: toRgba(CHART_COLORS.environment),
            backgroundColor: toRgba(CHART_COLORS.environment, 0.1),
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHitRadius: 4,
            borderWidth: 2,
          }],
        },
        options: {
          scales: {
            x: {
              ticks: {
                maxTicksAuto: 8,
                callback: function (val, idx) {
                  // Show only every Nth label to avoid crowding
                  const label = this.getLabelForValue(val);
                  if (typeof label === 'string' && label.endsWith('-01')) {
                    const year = parseInt(label, 10);
                    if (year % 10 === 0) return year;
                  }
                  return null;
                },
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: i18n.t('detail.co2.ppm'),
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => items[0]?.label || '',
                label: (item) => `${fmtNumber(item.parsed.y, { decimals: 1 })} ${i18n.t('detail.co2.ppm')}`,
              },
            },
          },
        },
      },
    });
  }

  // 2. Emissions per capita bar chart (horizontal)
  configs.push({
    canvasId: 'co2-emissions-canvas',
    blockId: 'detail-trend',
    config: {
      type: 'bar',
      data: {
        labels: TOP_EMITTERS.map(d => d.country),
        datasets: [{
          label: i18n.t('detail.co2.perCapita'),
          data: TOP_EMITTERS.map(d => d.value),
          backgroundColor: toRgba(CHART_COLORS.environment, 0.7),
          borderColor: toRgba(CHART_COLORS.environment),
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
              text: i18n.t('detail.co2.perCapita'),
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
              label: (item) => `${item.parsed.x} ${i18n.t('detail.co2.perCapita')}`,
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
  console.log('[CO2] cleanup()');
}
