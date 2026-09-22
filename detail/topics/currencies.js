/* ===================================================================
   World.One 2.0 -- Currencies Topic Module (ECON-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: currencies.json — Open ER API (aktuelle Kurse), EZB-Referenz-
         kurse 12 Monate (Frankfurter), höchste Inflationsraten (World Bank)
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
import { fmtNumber } from '../../js/utils/fmt.js';
import { createEmptyState } from '../../js/utils/empty-state.js';

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

// --- Key Exchange Rate Pairs (Marktkonvention) --------------------------
// rates sind USD-basiert (1 USD = x Fremdwährung). EUR und GBP werden
// üblich als Fremdwährung/USD notiert (Kehrwert), JPY/CNY als USD/x.

const HERO_PAIRS = [
  { label: 'EUR/USD', rateKey: 'EUR', invert: true },
  { label: 'GBP/USD', rateKey: 'GBP', invert: true },
  { label: 'USD/JPY', rateKey: 'JPY', invert: false },
  { label: 'USD/CNY', rateKey: 'CNY', invert: false },
];

const quote = (pair, rates) => {
  const r = rates?.[pair.rateKey];
  if (!Number.isFinite(r) || r <= 0) return null;
  return pair.invert ? 1 / r : r;
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached currencies data
  const { data, tier, age } = await fetchTopicData('currencies');

  const rates = data?.rates || {};

  // Store chart data for getChartConfigs
  _chartData = { rates, tier, age };

  // 2. Hero block
  _renderHero(blocks.hero, rates, tier, age);

  // 3. Chart block -- Currency converter
  _renderConverter(blocks.chart, rates);

  // 4. Trend block -- 12-month line charts (EUR/USD, USD/CNY)
  await _renderTrendCharts(blocks.trend, data?.history || []);

  // 5. Tiles block
  _renderTiles(blocks.tiles, rates, data?.history || [], data?.high_inflation || []);

  // 6. Explanation block -- Hyperinflation highlight
  _renderHyperinflation(blocks.explanation, data?.high_inflation || []);

  // 7. Comparison block
  _renderComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, rates, tier, age) {
  const badge = createTierBadge(tier, { age });

  // EUR/USD (US-$ je Euro) als große Zahl
  const eurUsd = quote(HERO_PAIRS[0], rates);
  const formatted = eurUsd != null ? fmtNumber(eurUsd, { decimals: 4 }) : '–';

  const pairsContainer = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 'var(--space-sm)',
      marginTop: 'var(--space-sm)',
    },
  });

  for (const pair of HERO_PAIRS) {
    const rate = quote(pair, rates);
    if (rate == null) continue;
    pairsContainer.appendChild(
      DOMUtils.create('div', {
        style: {
          padding: 'var(--space-xs)',
          background: 'var(--surface-2)',
          borderRadius: '6px',
          textAlign: 'center',
        },
      }, [
        DOMUtils.create('div', {
          textContent: pair.label,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' },
        }),
        DOMUtils.create('div', {
          textContent: fmtNumber(rate, { decimals: rate < 10 ? 4 : 2 }),
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
      background: 'var(--surface-2)',
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
      background: 'var(--surface-2)',
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
      background: 'var(--surface-2)',
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
      style: { background: 'var(--surface-3)', color: 'var(--text-1)' },
    });
    if (key === defaultVal) opt.selected = true;
    select.appendChild(opt);
  }

  return select;
}

// --- Trend Block (12-Month Line Charts) ---------------------------------

async function _renderTrendCharts(trendEl, history) {
  if (!history.length) {
    trendEl.appendChild(createEmptyState({ title: i18n.t('detail.currencies.chartEURUSD') }));
    return;
  }
  const labels = history.map(h => new Date(h.date + 'T00:00:00Z')
    .toLocaleDateString(i18n.lang === 'en' ? 'en-GB' : 'de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }));
  const eurUsd = history.map(h => (h.EUR > 0 ? Math.round(1 / h.EUR * 10000) / 10000 : null));
  const usdCny = history.map(h => h.CNY ?? null);

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
      labels,
      datasets: [{
        label: 'EUR/USD',
        data: eurUsd,
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
    options: _lineChartOptions('EUR/USD'),
  });

  createChart('currencies-usdcny-canvas', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'USD/CNY',
        data: usdCny,
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
    options: _lineChartOptions('USD/CNY'),
  });
}

// y-Achse passt sich den Daten an (vorher feste Grenzen, aktueller Kurs lag außerhalb)
function _lineChartOptions(yLabel) {
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
        grace: '5%',
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
          label: (item) => `${yLabel}: ${fmtNumber(item.parsed.y, { decimals: 4 })}`,
        },
      },
    },
  };
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, rates, history, highInflation) {
  const count = Object.keys(rates).length;

  // Größte Bewegung gegenüber dem US-Dollar im 12-Monats-Verlauf
  const first = history[0];
  const last = history[history.length - 1];
  let move = null;
  if (first && last) {
    for (const code of ['EUR', 'GBP', 'JPY', 'CNY']) {
      if (!(first[code] > 0 && last[code] > 0)) continue;
      // Wert der Währung in USD: steigt, wenn weniger Einheiten je USD nötig sind
      const pct = (first[code] / last[code] - 1) * 100;
      if (!move || Math.abs(pct) > Math.abs(move.pct)) move = { code, pct };
    }
  }
  const top = highInflation[0];
  const fmtPct = (v) => `${v > 0 ? '+' : ''}${v.toLocaleString(i18n.lang === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: 1 })} %`;

  const tileData = [
    {
      label: i18n.t('detail.currencies.tileMove'),
      value: move ? move.code : '–',
      unit: move ? `${fmtPct(move.pct)} ${i18n.t('detail.currencies.vsUsd12m')}` : '',
      accent: toRgba(CHART_COLORS.economy),
    },
    {
      label: i18n.t('detail.currencies.tileVolatile'),
      value: top ? top.code : '–',
      unit: top ? `${fmtPct(top.inflation)} (${top.year})` : '',
      accent: 'var(--status-critical)',
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
        background: 'var(--surface-2)',
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

// --- Explanation Block (Hyperinflation Highlight) -------------------------

function _renderHyperinflation(explEl, list) {
  if (!list.length) return;
  explEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.currencies.hyperTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const cards = list.map(({ country, code, inflation: pct, year }) => {
    const severity = pct >= 100 ? 'extreme' : 'high';
    const inflation = `${pct.toLocaleString(i18n.lang === 'en' ? 'en-GB' : 'de-DE')} % (${year})`;
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
            color: 'var(--text-1)',
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
