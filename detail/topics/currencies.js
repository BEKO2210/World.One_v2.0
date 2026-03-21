/* ===================================================================
   World.One 2.0 -- Currencies Topic Module (ECON-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Open Exchange Rates API (cached currencies.json),
         12-month hardcoded EUR/USD and USD/CNY trends,
         Hyperinflation countries with annual inflation rates
   Visualizations: Exchange rate hero with tier badge, client-side
                   currency converter, 12-month line charts,
                   hyperinflation highlight section
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'currencies',
  titleKey: 'detail.currencies.title',
  category: 'economy',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null;
let _converterCleanup = null;

// --- 12-Month Hardcoded Data (Apr 2025 - Mar 2026) --------------------

const MONTHLY_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const EUR_USD_12M = [0.91, 0.92, 0.93, 0.92, 0.91, 0.90, 0.91, 0.92, 0.93, 0.92, 0.91, 0.92];
const USD_CNY_12M = [7.21, 7.24, 7.20, 7.18, 7.22, 7.25, 7.23, 7.20, 7.24, 7.26, 7.22, 7.24];

// --- Hyperinflation Countries ------------------------------------------

const HYPERINFLATION = [
  { country: 'Venezuela', code: 'VES', inflation: '~230%', severity: 'extreme' },
  { country: 'Zimbabwe', code: 'ZWL', inflation: '~560%', severity: 'extreme' },
  { country: 'Argentina', code: 'ARS', inflation: '~140%', severity: 'high' },
  { country: 'Turkey', code: 'TRY', inflation: '~65%', severity: 'high' },
  { country: 'Lebanon', code: 'LBP', inflation: '~170%', severity: 'extreme' },
];

// --- Key Exchange Rate Pairs for Hero -----------------------------------

const HERO_PAIRS = [
  { label: 'EUR/USD', rateKey: 'EUR' },
  { label: 'GBP/USD', rateKey: 'GBP' },
  { label: 'JPY/USD', rateKey: 'JPY' },
  { label: 'CNY/USD', rateKey: 'CNY' },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached currencies data
  const { data, tier, age } = await fetchTopicData('currencies');

  const rates = data && data.rates ? data.rates : {
    EUR: 0.92, GBP: 0.79, JPY: 149.5, CNY: 7.24,
    INR: 83.5, BRL: 5.25, RUB: 83.6, KRW: 1350,
    CHF: 0.88, AUD: 1.53, CAD: 1.37, MXN: 17.2,
  };

  // Store chart data for getChartConfigs
  _chartData = { rates, tier, age };

  // 2. Hero block
  _renderHero(blocks.hero, rates, tier, age);

  // 3. Chart block -- Currency converter
  _renderConverter(blocks.chart, rates);

  // 4. Trend block -- 12-month line charts (EUR/USD, USD/CNY)
  await _renderTrendCharts(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles, rates);

  // 6. Explanation block -- Hyperinflation highlight
  _renderHyperinflation(blocks.explanation);

  // 7. Comparison block
  _renderComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, rates, tier, age) {
  const badge = createTierBadge(tier, { age });

  // Primary EUR/USD rate as the big number
  const eurRate = rates.EUR || 0.92;
  const formatted = MathUtils.formatNumber(eurRate);

  const pairsContainer = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-sm)',
      marginTop: 'var(--space-sm)',
    },
  });

  for (const pair of HERO_PAIRS) {
    const rate = rates[pair.rateKey];
    if (rate === undefined) continue;
    pairsContainer.appendChild(
      DOMUtils.create('div', {
        style: {
          padding: 'var(--space-xs)',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '6px',
          textAlign: 'center',
        },
      }, [
        DOMUtils.create('div', {
          textContent: pair.label,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' },
        }),
        DOMUtils.create('div', {
          textContent: MathUtils.formatNumber(rate),
          style: {
            color: toRgba(CHART_COLORS.economy),
            fontSize: '1.25rem',
            fontWeight: '600',
          },
        }),
      ])
    );
  }

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'currencies-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        formatted,
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: 'EUR/USD',
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
          textContent: i18n.t('detail.currencies.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      pairsContainer,
    ])
  );
}

// --- Chart Block (Currency Converter) -----------------------------------

function _renderConverter(chartEl, rates) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.currencies.converterTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Build currency options from rates keys + USD
  const currencyKeys = ['USD', ...Object.keys(rates).sort()];

  // Amount input
  const amountInput = DOMUtils.create('input', {
    type: 'number',
    value: '100',
    min: '0',
    step: 'any',
    style: {
      width: '100%',
      padding: '10px 12px',
      fontSize: '1.1rem',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '6px',
      color: 'var(--text-primary)',
      outline: 'none',
      marginBottom: 'var(--space-sm)',
    },
  });

  // From select
  const fromSelect = _createSelect(currencyKeys, 'EUR');
  // To select
  const toSelect = _createSelect(currencyKeys, 'JPY');

  // Result display
  const resultEl = DOMUtils.create('div', {
    style: {
      padding: 'var(--space-sm)',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '8px',
      textAlign: 'center',
      marginTop: 'var(--space-sm)',
    },
  }, [
    DOMUtils.create('div', {
      textContent: i18n.t('detail.currencies.converterResult'),
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' },
    }),
    DOMUtils.create('div', {
      className: 'converter-result-value',
      style: {
        color: toRgba(CHART_COLORS.economy),
        fontSize: '1.5rem',
        fontWeight: '600',
      },
    }),
  ]);

  // Conversion function
  function doConvert() {
    const amount = parseFloat(amountInput.value);
    const resultValueEl = resultEl.querySelector('.converter-result-value');
    if (isNaN(amount) || amount < 0) {
      resultValueEl.textContent = '--';
      return;
    }

    const fromCurrency = fromSelect.value;
    const toCurrency = toSelect.value;

    // All rates are USD-based. To convert: (amount / fromRate) * toRate
    // USD rate is 1
    const fromRate = fromCurrency === 'USD' ? 1 : (rates[fromCurrency] || 1);
    const toRate = toCurrency === 'USD' ? 1 : (rates[toCurrency] || 1);

    const result = (amount / fromRate) * toRate;
    resultValueEl.textContent = `${MathUtils.formatNumber(result)} ${toCurrency}`;
  }

  // Event listeners
  amountInput.addEventListener('input', doConvert);
  fromSelect.addEventListener('change', doConvert);
  toSelect.addEventListener('change', doConvert);

  // Store cleanup reference
  _converterCleanup = () => {
    amountInput.removeEventListener('input', doConvert);
    fromSelect.removeEventListener('change', doConvert);
    toSelect.removeEventListener('change', doConvert);
  };

  // Layout
  const selectRow = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      gap: 'var(--space-sm)',
      alignItems: 'center',
    },
  }, [
    DOMUtils.create('div', {}, [
      DOMUtils.create('div', {
        textContent: i18n.t('detail.currencies.converterFrom'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' },
      }),
      fromSelect,
    ]),
    DOMUtils.create('span', {
      textContent: '\u2192',
      style: { color: 'var(--text-secondary)', fontSize: '1.25rem', paddingTop: '18px' },
    }),
    DOMUtils.create('div', {}, [
      DOMUtils.create('div', {
        textContent: i18n.t('detail.currencies.converterTo'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' },
      }),
      toSelect,
    ]),
  ]);

  chartEl.appendChild(amountInput);
  chartEl.appendChild(selectRow);
  chartEl.appendChild(resultEl);

  // Initial conversion
  doConvert();
}

function _createSelect(options, defaultVal) {
  const select = DOMUtils.create('select', {
    style: {
      width: '100%',
      padding: '8px 10px',
      fontSize: '1rem',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '6px',
      color: 'var(--text-primary)',
      outline: 'none',
      cursor: 'pointer',
    },
  });

  for (const key of options) {
    const opt = DOMUtils.create('option', {
      value: key,
      textContent: key,
      style: { background: '#1a1a2e', color: '#fff' },
    });
    if (key === defaultVal) opt.selected = true;
    select.appendChild(opt);
  }

  return select;
}

// --- Trend Block (12-Month Line Charts) ---------------------------------

async function _renderTrendCharts(trendEl) {
  // EUR/USD chart
  trendEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.currencies.chartEURUSD'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:250px;',
      }, [
        DOMUtils.create('canvas', { id: 'currencies-eurusd-canvas' }),
      ]),
    ])
  );

  // USD/CNY chart
  trendEl.appendChild(
    DOMUtils.create('div', {
      style: { marginTop: 'var(--space-md)' },
    }, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.currencies.chartUSDCNY'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:250px;',
      }, [
        DOMUtils.create('canvas', { id: 'currencies-usdcny-canvas' }),
      ]),
    ])
  );

  // Render both charts
  await ensureChartJs();

  createChart('currencies-eurusd-canvas', {
    type: 'line',
    data: {
      labels: MONTHLY_LABELS,
      datasets: [{
        label: 'EUR/USD',
        data: EUR_USD_12M,
        borderColor: toRgba(CHART_COLORS.economy),
        backgroundColor: toRgba(CHART_COLORS.economy, 0.15),
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHitRadius: 8,
        pointBackgroundColor: toRgba(CHART_COLORS.economy),
        borderWidth: 2,
      }],
    },
    options: _lineChartOptions('EUR/USD', 0.88, 0.96),
  });

  createChart('currencies-usdcny-canvas', {
    type: 'line',
    data: {
      labels: MONTHLY_LABELS,
      datasets: [{
        label: 'USD/CNY',
        data: USD_CNY_12M,
        borderColor: toRgba(CHART_COLORS.economy),
        backgroundColor: toRgba(CHART_COLORS.economy, 0.15),
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHitRadius: 8,
        pointBackgroundColor: toRgba(CHART_COLORS.economy),
        borderWidth: 2,
      }],
    },
    options: _lineChartOptions('USD/CNY', 7.1, 7.35),
  });
}

function _lineChartOptions(yLabel, yMin, yMax) {
  return {
    animation: {
      duration: 1200,
      easing: 'easeInOutQuart',
    },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        min: yMin,
        max: yMax,
        title: {
          display: true,
          text: yLabel,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => `${yLabel}: ${item.parsed.y.toFixed(4)}`,
        },
      },
    },
  };
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, rates) {
  // Find strongest (lowest rate vs USD = most valuable) and count
  const rateEntries = Object.entries(rates);
  const count = rateEntries.length;

  const tileData = [
    {
      label: i18n.t('detail.currencies.tileStrong'),
      value: 'CHF',
      unit: `1 USD = ${MathUtils.formatNumber(rates.CHF || 0.88)} CHF`,
      accent: toRgba(CHART_COLORS.economy),
    },
    {
      label: i18n.t('detail.currencies.tileVolatile'),
      value: 'TRY / ARS',
      unit: i18n.t('detail.currencies.hyperTitle'),
      accent: '#d32f2f',
    },
    {
      label: i18n.t('detail.currencies.tileTracked'),
      value: String(count),
      unit: i18n.t('detail.currencies.heroUnit'),
      accent: toRgba(CHART_COLORS.economy),
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
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Explanation Block (Hyperinflation Highlight) -------------------------

function _renderHyperinflation(explEl) {
  explEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.currencies.hyperTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const cards = HYPERINFLATION.map(({ country, code, inflation, severity }) => {
    const badgeColor = severity === 'extreme'
      ? 'rgba(211, 47, 47, 0.85)'
      : 'rgba(245, 124, 0, 0.85)';
    const bgColor = severity === 'extreme'
      ? 'rgba(211, 47, 47, 0.08)'
      : 'rgba(245, 124, 0, 0.08)';

    return DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: bgColor,
        borderRadius: '8px',
        borderLeft: `3px solid ${badgeColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
    }, [
      DOMUtils.create('div', {}, [
        DOMUtils.create('div', {
          textContent: country,
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
        }),
        DOMUtils.create('div', {
          textContent: code,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem' },
        }),
      ]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        },
      }, [
        DOMUtils.create('span', {
          textContent: inflation,
          style: {
            color: badgeColor,
            fontWeight: '700',
            fontSize: '1.1rem',
          },
        }),
        DOMUtils.create('span', {
          textContent: severity === 'extreme' ? '\u26a0' : '\u25b2',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: badgeColor,
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: '700',
          },
        }),
      ]),
    ]);
  });

  const cardsContainer = DOMUtils.create('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)',
    },
  }, cards);

  explEl.appendChild(cardsContainer);

  // Explanation text below
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.currencies.explanation'),
      style: {
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        lineHeight: '1.7',
        marginTop: 'var(--space-md)',
      },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.currencies.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: 'Open Exchange Rates API',
      url: 'https://open.er-api.com/',
    },
    {
      label: 'ECB Exchange Rates',
      url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/',
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
          color: toRgba(CHART_COLORS.economy, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.economy, 0.3),
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
  // Charts rendered directly in render() for immediate display
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  if (_converterCleanup) {
    _converterCleanup();
    _converterCleanup = null;
  }
  _chartData = null;
  console.log('[Currencies] cleanup()');
}
