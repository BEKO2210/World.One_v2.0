/* ===================================================================
   World.One 1.0 -- Internet Topic Module (PROG-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Hardcoded internet penetration (World Bank IT.NET.USER.ZS 2024),
         Calculated real-time counters (Statista, Internet Live Stats),
         SVG choropleth for digital divide
   Visualizations: Internet users hero, real-time counters (emails,
                   Google searches, YouTube uploads), digital divide map
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'internet',
  titleKey: 'detail.internet.title',
  category: 'progress',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _choroplethCleanup = null;
let _chartData = null;

// --- Internet Penetration by Country (World Bank 2024 estimates) -------
// ISO-2 code -> percentage

const PENETRATION_DATA = {
  // Top tier (>90%)
  DK: 98, IS: 99, AE: 99, KR: 98, GB: 96, SE: 96, NL: 95,
  DE: 93, JP: 93, US: 92, CA: 93, AU: 92,
  // High (70-90%)
  FR: 88, ES: 87, IT: 84, BR: 81, RU: 88, TR: 83, AR: 87, SA: 82,
  // Medium (40-70%)
  CN: 73, MX: 72, ZA: 72, CO: 69, EG: 55, ID: 62, PH: 53,
  IN: 52, NG: 55, KE: 42, VN: 70,
  // Low (<40%)
  BD: 38, PK: 33, ET: 17, CD: 23, TZ: 25, MM: 44, MZ: 18,
  MG: 15, TD: 14, NE: 11,
};

// --- Real-Time Counter Rates (per day) --------------------------------

const COUNTER_RATES = [
  {
    key: 'emails',
    labelKey: 'detail.internet.counterEmails',
    dailyRate: 332_000_000_000,
    emoji: '\u2709\ufe0f',
  },
  {
    key: 'google',
    labelKey: 'detail.internet.counterGoogle',
    dailyRate: 8_500_000_000,
    emoji: '\ud83d\udd0d',
  },
  {
    key: 'youtube',
    labelKey: 'detail.internet.counterYoutube',
    dailyRate: 720_000,
    emoji: '\u25b6\ufe0f',
    unit: 'hours',
  },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // Fetch for static fallback tier info only
  let tier = 'static';
  let age = null;
  try {
    const result = await fetchTopicData('internet');
    if (result) {
      tier = result.tier || 'static';
      age = result.age || null;
    }
  } catch (_err) {
    // Static data -- no cache file expected, use defaults
  }

  _chartData = {};

  // 1. Hero block
  _renderHero(blocks.hero, tier, age);

  // 2. Chart block -- Real-time counters (directly rendered with setInterval)
  _renderCounters(blocks.chart);

  // 3. Trend block -- (unused, minimal placeholder)
  _renderTrendPlaceholder(blocks.trend);

  // 4. Tiles block -- Digital divide choropleth
  await _renderChoropleth(blocks.tiles);

  // 5. Explanation block -- Context tiles + explanation text
  _renderExplanationWithTiles(blocks.explanation);

  // 6. Comparison block
  _renderComparison(blocks.comparison);

  // 7. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, tier, age) {
  const badge = createTierBadge(tier, { age });
  const penetration = '67%';
  const totalUsers = '5.4B';

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'internet-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [penetration]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.internet.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginTop: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: `~${totalUsers}`,
          style: {
            color: toRgba(CHART_COLORS.progress),
            fontSize: '1.25rem',
            fontWeight: '600',
          },
        }),
        DOMUtils.create('span', {
          textContent: i18n.t('detail.internet.heroUnit'),
          style: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
        }),
      ]),
    ])
  );
}

// --- Real-Time Counters (Chart block, directly rendered) -----------------

function _renderCounters(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.internet.countersTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startEpoch = startOfDay.getTime();

  const counterCards = COUNTER_RATES.map(({ key, labelKey, dailyRate, emoji, unit }) => {
    const perSecond = dailyRate / 86400;

    const valueEl = DOMUtils.create('div', {
      className: `internet-counter-${key}`,
      style: {
        fontSize: '1.8rem',
        fontWeight: '700',
        color: toRgba(CHART_COLORS.progress),
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'monospace, sans-serif',
        lineHeight: '1.2',
      },
      textContent: '0',
    });

    function update() {
      const elapsed = (Date.now() - startEpoch) / 1000;
      const value = Math.round(elapsed * perSecond);
      valueEl.textContent = MathUtils.formatCompact(value) + (unit ? ` ${unit}` : '');
    }
    update();
    _intervals.push(setInterval(update, 1000));

    return DOMUtils.create('div', {
      style: {
        flex: '1',
        minWidth: '140px',
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'center',
      },
    }, [
      DOMUtils.create('div', {
        textContent: emoji,
        style: { fontSize: '1.5rem', marginBottom: '4px' },
      }),
      DOMUtils.create('div', {
        textContent: i18n.t(labelKey),
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '6px' },
      }),
      valueEl,
      DOMUtils.create('div', {
        textContent: `~${MathUtils.formatCompact(dailyRate)}/day`,
        style: { color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '4px', opacity: '0.7' },
      }),
    ]);
  });

  chartEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        gap: 'var(--space-sm)',
        flexWrap: 'wrap',
      },
    }, counterCards)
  );
}

// --- Trend Placeholder (minimal -- no time-series data for internet) ----

function _renderTrendPlaceholder(trendEl) {
  // No time-series trend chart for internet; trend block left minimal
  // The timerangechange events are unused for this topic
}

// --- Digital Divide Choropleth (Tiles block) ----------------------------

async function _renderChoropleth(tilesEl) {
  // Color function: gradient from red (<20%) through yellow (50%) to green (>80%)
  function colorFn(value) {
    if (value >= 80) return `rgba(76, 175, 80, ${0.6 + (value - 80) * 0.02})`;
    if (value >= 50) return `rgba(255, 193, 7, ${0.5 + (value - 50) * 0.01})`;
    if (value >= 20) return `rgba(255, 152, 0, ${0.4 + (value - 20) * 0.01})`;
    return `rgba(244, 67, 54, ${0.4 + value * 0.02})`;
  }

  function tooltipFn(iso, value) {
    return `${iso}: ${value}% ${i18n.t('detail.internet.heroUnit')}`;
  }

  const legendItems = [
    { color: 'rgba(76, 175, 80, 0.85)', label: '>90% Connected' },
    { color: 'rgba(255, 193, 7, 0.7)', label: '70-90%' },
    { color: 'rgba(255, 152, 0, 0.6)', label: '40-70%' },
    { color: 'rgba(244, 67, 54, 0.6)', label: '<40%' },
  ];

  try {
    const result = await renderChoropleth(tilesEl, {
      dataMap: PENETRATION_DATA,
      colorFn,
      tooltipFn,
      legendItems,
      title: i18n.t('detail.internet.mapTitle'),
      defaultColor: 'rgba(255,255,255,0.04)',
    });

    if (result && result.cleanup) {
      _choroplethCleanup = result.cleanup;
    }
  } catch (_err) {
    // Graceful fallback if SVG fails
    tilesEl.appendChild(
      DOMUtils.create('p', {
        textContent: 'Map unavailable',
        style: { color: 'var(--text-secondary)', fontStyle: 'italic' },
      })
    );
  }
}

// --- Explanation Block (Context Tiles + Text) ----------------------------

function _renderExplanationWithTiles(explEl) {
  // Context tiles first
  const tileData = [
    {
      label: i18n.t('detail.internet.tileTotal'),
      value: '5.4B',
      unit: i18n.t('detail.internet.heroLabel'),
      accent: toRgba(CHART_COLORS.progress),
    },
    {
      label: i18n.t('detail.internet.tileMobile'),
      value: '~60%',
      unit: i18n.t('detail.internet.heroUnit'),
    },
    {
      label: i18n.t('detail.internet.tileGrowth'),
      value: '~3%',
      unit: '/yr',
      accent: '#4caf50',
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

  explEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-md)',
      },
    }, tiles)
  );

  // Explanation text
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.internet.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.internet.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.internet.sourceWB'),
      url: 'https://data.worldbank.org/indicator/IT.NET.USER.ZS',
    },
    {
      label: 'ITU (International Telecommunication Union)',
      url: 'https://www.itu.int/en/ITU-D/Statistics/Pages/stat/default.aspx',
    },
    {
      label: 'Statista -- Internet Statistics',
      url: 'https://www.statista.com/topics/1145/internet-usage-worldwide/',
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
          color: toRgba(CHART_COLORS.progress, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.progress, 0.3),
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
  // No lazy charts -- counters and choropleth rendered directly
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  // Clear all counter intervals
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];

  // Cleanup choropleth event listeners
  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  _chartData = null;
  console.log('[Internet] cleanup()');
}
