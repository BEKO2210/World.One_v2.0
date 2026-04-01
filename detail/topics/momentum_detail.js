/* ===================================================================
   World.One 2.0 -- Momentum Detail Topic Module (MOM-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: world-state.json subScores (aggregated from 4 categories)
   Visualizations: DOM-only mini-card grid with SVG sparklines,
                   stacked trend bar, category summary tiles.
                   Zero Chart.js instances.
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'momentum_detail',
  titleKey: 'detail.momentum_detail.title',
  category: 'momentum',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _indicators = null;
let _momentumData = null;

// --- Indicator-to-Topic Mapping ----------------------------------------
// Maps subScores indicator names (German) to topic detail page IDs.
// Indicators without an entry remain non-clickable (no broken links).

const INDICATOR_TOPIC_MAP = {
  'Globale Temperaturanomalie': 'temperature',
  'CO2-Konzentration': 'co2',
  'Waldfläche': 'forests',
  'Erneuerbare Energie': 'renewables',
  'Luftqualität (Global Avg AQI)': 'airquality',
  'Arktis-Eisfläche': 'biodiversity',
  'Lebenserwartung': 'health',
  'Kindersterblichkeit': 'health',
  'Aktive Konflikte': 'conflicts',
  'Elektrizitätszugang': 'population',
  'Trinkwasserzugang': 'population',
  'Menschen auf der Flucht': 'conflicts',
  'Politische Freiheit': 'freedom',
  'BIP-Wachstum': 'currencies',
  'Gini-Index': 'inequality',
  'Inflation': 'currencies',
  'Arbeitslosigkeit': 'poverty',
  'Extreme Armut': 'poverty',
  'Internet-Durchdringung': 'internet',
  'Alphabetisierung': 'science',
  'F&E Ausgaben (% BIP)': 'science',
  'Mobilfunkverträge': 'internet',
  'GitHub Repositories': 'science',
  'Wissenschaftliche Papers': 'science',
};

// --- Category Config ---------------------------------------------------

const CATEGORIES = {
  environment: { color: '#34c759', key: 'detail.momentum_detail.categoryEnv' },
  society:     { color: '#5ac8fa', key: 'detail.momentum_detail.categorySoc' },
  economy:     { color: '#ff9500', key: 'detail.momentum_detail.categoryEcon' },
  progress:    { color: '#af52de', key: 'detail.momentum_detail.categoryProg' },
};

// --- Sparkline Function ------------------------------------------------

function _createSparkline(trend, color, width = 80, height = 24) {
  const svg = DOMUtils.createSVG('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    height: String(height),
    style: 'display:block;flex-shrink:0;',
  });

  // Generate 10 representative points based on trend direction
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9; // 0 to 1
    const noise = (Math.sin(i * 2.7 + 1.3) * 0.12); // deterministic noise
    let base;
    if (trend === 'improving') {
      base = 0.7 - t * 0.5 + noise; // goes from high Y (bottom) to low Y (top)
    } else if (trend === 'declining') {
      base = 0.3 + t * 0.5 + noise; // goes from low Y (top) to high Y (bottom)
    } else {
      base = 0.5 + noise; // oscillates around center
    }
    // Clamp to 0.05 - 0.95 range
    base = Math.max(0.05, Math.min(0.95, base));
    const x = (i / 9) * width;
    const y = base * height;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  svg.appendChild(DOMUtils.createSVG('polyline', {
    points: pts.join(' '),
    fill: 'none',
    stroke: color,
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-opacity': '0.8',
  }));

  return svg;
}

// --- Assessment Function -----------------------------------------------

function _assessIndicator(score, trend) {
  if (score >= 70 && trend === 'improving') {
    return { label: i18n.t('detail.momentum_detail.cardImproving'), color: '#34c759' };
  }
  if (score >= 50 && trend !== 'declining') {
    return { label: i18n.t('detail.momentum_detail.cardStable'), color: '#ffcc00' };
  }
  return { label: i18n.t('detail.momentum_detail.cardDeclining'), color: '#ff3b30' };
}

// --- Base Path Helper --------------------------------------------------

function _basePath() {
  return window.location.pathname.includes('/detail') ? '../' : '';
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch world-state.json directly
  let wsData = null;
  try {
    const res = await fetch(_basePath() + 'data/processed/world-state.json');
    if (res.ok) wsData = await res.json();
  } catch (_err) { /* fallback below */ }

  // 2. Extract subScores
  const subScores = wsData?.subScores || {};

  // 2b. Extract top-level momentum.indicators for % change data.
  //     Names differ between subScores and momentum arrays, so we use two
  //     lookup strategies: (a) exact momentum name match, (b) a manual alias
  //     map for names that differ between the two arrays.
  const momentumIndicators = wsData?.momentum?.indicators || [];

  // Exact name -> change lookup
  const changeByExact = {};
  for (const mi of momentumIndicators) {
    changeByExact[mi.name] = mi.change;
  }

  // Alias: subScores name -> momentum name (where they differ)
  const MOMENTUM_ALIAS = {
    'Globale Temperaturanomalie': null,        // no momentum counterpart
    'Luftqualität (Global Avg AQI)': null,     // no momentum counterpart
    'Arktis-Eisfläche': null,                  // no momentum counterpart
    'Trinkwasserzugang': 'Trinkwasser',
    'Aktive Konflikte': null,                  // no momentum counterpart
    'Menschen auf der Flucht': null,           // no momentum counterpart
    'Politische Freiheit': null,               // no momentum counterpart
    'Gini-Index': null,                        // no momentum counterpart
    'Extreme Armut': null,                     // no momentum counterpart
    'Internet-Durchdringung': 'Internet-Zugang',
    'F&E Ausgaben (% BIP)': 'F&E Ausgaben',
    'Mobilfunkverträge': 'Mobilfunk',
    'GitHub Repositories': null,               // no momentum counterpart
    'Wissenschaftliche Papers': null,          // no momentum counterpart
  };

  function _lookupChange(indicatorName) {
    // Direct match first
    if (changeByExact[indicatorName] !== undefined) return changeByExact[indicatorName];
    // Alias match
    const alias = MOMENTUM_ALIAS[indicatorName];
    if (alias && changeByExact[alias] !== undefined) return changeByExact[alias];
    return null;
  }

  // 3. CRITICAL: Aggregate indicators from 4 named categories (NOT momentum.indicators which is empty)
  const allIndicators = [];
  for (const catKey of ['environment', 'society', 'economy', 'progress']) {
    const catData = subScores[catKey];
    if (catData && Array.isArray(catData.indicators)) {
      for (const ind of catData.indicators) {
        // Cross-reference % change from momentum.indicators
        const change = _lookupChange(ind.name);
        allIndicators.push({ ...ind, category: catKey, change });
      }
    }
  }

  // Store module state
  _indicators = allIndicators;
  _momentumData = subScores.momentum || { value: 0, positiveCount: 0, negativeCount: 0, totalIndicators: 0 };

  const momentumScore = _momentumData.value || 0;
  const positiveCount = _momentumData.positiveCount || allIndicators.filter(i => i.trend === 'improving').length;
  const negativeCount = _momentumData.negativeCount || allIndicators.filter(i => i.trend === 'declining').length;
  const totalCount = allIndicators.length;

  // 4. Hero block
  _renderHero(blocks.hero, momentumScore, positiveCount, negativeCount, totalCount);

  // 5. Chart block -- card grid
  _renderCardGrid(blocks.chart, allIndicators);

  // 6. Trend block -- summary bar
  _renderTrendBar(blocks.trend, allIndicators);

  // 7. Tiles block -- category summaries
  _renderTiles(blocks.tiles, subScores);

  // 8. Explanation block
  _renderExplanation(blocks.explanation);

  // 9. Comparison block
  _renderComparison(blocks.comparison);

  // 10. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, score, positiveCount, negativeCount, totalCount) {
  const badge = createTierBadge('live');
  const stableCount = totalCount - positiveCount - negativeCount;

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'momentum-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        score.toFixed(1),
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: '/100',
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
          textContent: i18n.t('detail.momentum_detail.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      // Summary counts
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        },
      }, [
        _createCountBadge('\u25B2', positiveCount, '#34c759', i18n.t('detail.momentum_detail.cardImproving')),
        _createCountBadge('\u25BA', stableCount, '#ffcc00', i18n.t('detail.momentum_detail.cardStable')),
        _createCountBadge('\u25BC', negativeCount, '#ff3b30', i18n.t('detail.momentum_detail.cardDeclining')),
      ]),
    ])
  );
}

function _createCountBadge(arrow, count, color, label) {
  return DOMUtils.create('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  }, [
    DOMUtils.create('span', {
      textContent: arrow,
      style: { color, fontSize: '0.9rem' },
    }),
    DOMUtils.create('span', {
      textContent: `${count} ${label}`,
      style: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
    }),
  ]);
}

// --- Card Grid (Chart Block) -------------------------------------------

function _renderCardGrid(chartEl, indicators) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: `${indicators.length} ` + i18n.t('detail.momentum_detail.title'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const cards = indicators.map(ind => _buildMiniCard(ind));

  chartEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '12px',
      },
    }, cards)
  );
}

function _buildMiniCard(indicator) {
  const catConfig = CATEGORIES[indicator.category] || { color: '#888', key: '' };
  const assessment = _assessIndicator(indicator.score || 0, indicator.trend || 'stable');

  // Topic link lookup
  const topicId = INDICATOR_TOPIC_MAP[indicator.name] || null;

  // Trend arrow
  let trendArrow, trendColor;
  if (indicator.trend === 'improving') {
    trendArrow = '\u25B2'; // up triangle
    trendColor = '#34c759';
  } else if (indicator.trend === 'declining') {
    trendArrow = '\u25BC'; // down triangle
    trendColor = '#ff3b30';
  } else {
    trendArrow = '\u25BA'; // right triangle (stable)
    trendColor = '#ffcc00';
  }

  // Score badge
  const scoreBadge = DOMUtils.create('span', {
    textContent: String(indicator.score || '--'),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '28px',
      height: '20px',
      padding: '0 6px',
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.08)',
      color: 'var(--text-secondary)',
      fontSize: '0.7rem',
      fontWeight: '600',
    },
  });

  // % change element (cross-referenced from momentum.indicators)
  const changeEl = indicator.change
    ? DOMUtils.create('span', {
        textContent: indicator.change,
        style: {
          fontSize: '0.7rem',
          fontWeight: '600',
          color: indicator.change.startsWith('-')
            ? (indicator.trend === 'improving' ? '#34c759' : '#ff3b30')
            : (indicator.trend === 'declining' ? '#ff3b30' : '#34c759'),
          marginLeft: '4px',
        },
      })
    : null;

  // SVG sparkline
  const sparkline = _createSparkline(indicator.trend || 'stable', catConfig.color);

  // Assessment badge
  const assessBadge = DOMUtils.create('span', {
    textContent: assessment.label,
    style: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.65rem',
      fontWeight: '700',
      background: assessment.color,
      color: assessment.color === '#ffcc00' ? '#1a1a2e' : '#fff',
    },
  });

  // Row 2 children: value, change (if available), score badge
  const row2Children = [
    DOMUtils.create('span', {
      textContent: String(indicator.value || '--'),
      style: { color: 'var(--text-secondary)', fontSize: '0.8rem', flex: '1' },
    }),
  ];
  if (changeEl) row2Children.push(changeEl);
  row2Children.push(scoreBadge);

  // Row 1 right side: link icon (if clickable) + trend arrow
  const row1Right = [];
  if (topicId) {
    row1Right.push(DOMUtils.create('span', {
      textContent: '\u2197', // north-east arrow
      style: {
        fontSize: '0.7rem',
        color: 'var(--text-secondary)',
        opacity: '0.5',
        marginLeft: '4px',
      },
    }));
  }
  row1Right.push(DOMUtils.create('span', {
    textContent: trendArrow,
    style: { color: trendColor, fontSize: '0.85rem', marginLeft: '8px' },
  }));

  const defaultBg = 'rgba(255, 255, 255, 0.04)';
  const hoverBg = 'rgba(255, 255, 255, 0.08)';

  const card = DOMUtils.create('div', {
    style: {
      padding: '12px',
      background: defaultBg,
      borderRadius: '8px',
      borderLeft: `3px solid ${catConfig.color}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      cursor: topicId ? 'pointer' : 'default',
      transition: 'background 0.15s ease',
    },
  }, [
    // Row 1: Name + link icon + trend arrow
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
    }, [
      DOMUtils.create('span', {
        textContent: indicator.name,
        style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.85rem', flex: '1' },
      }),
      ...row1Right,
    ]),
    // Row 2: Value + % change + score badge
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      },
    }, row2Children),
    // Row 3: Sparkline + assessment
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      },
    }, [
      sparkline,
      assessBadge,
    ]),
  ]);

  // Click-to-topic navigation for clickable cards
  if (topicId) {
    card.addEventListener('click', () => {
      window.location.href = _basePath() + 'detail/?topic=' + topicId;
    });
    card.addEventListener('mouseenter', () => {
      card.style.background = hoverBg;
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = defaultBg;
    });
  }

  return card;
}

// --- Trend Block (Summary Stacked Bar) ---------------------------------

function _renderTrendBar(trendEl, indicators) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.momentum_detail.title'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const improving = indicators.filter(i => i.trend === 'improving').length;
  const declining = indicators.filter(i => i.trend === 'declining').length;
  const stable = indicators.length - improving - declining;
  const total = indicators.length || 1;

  const segments = [
    { count: improving, color: '#34c759', label: i18n.t('detail.momentum_detail.cardImproving') },
    { count: stable,    color: '#ffcc00', label: i18n.t('detail.momentum_detail.cardStable') },
    { count: declining, color: '#ff3b30', label: i18n.t('detail.momentum_detail.cardDeclining') },
  ];

  // Stacked horizontal bar
  const barSegments = segments.map(s =>
    DOMUtils.create('div', {
      style: {
        width: `${(s.count / total * 100).toFixed(1)}%`,
        height: '100%',
        background: s.color,
        display: s.count > 0 ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: '700',
        color: s.color === '#ffcc00' ? '#1a1a2e' : '#fff',
        minWidth: s.count > 0 ? '32px' : '0',
      },
      textContent: String(s.count),
      title: `${s.label}: ${s.count}`,
    })
  );

  trendEl.appendChild(
    DOMUtils.create('div', {
      style: {
        width: '100%',
        height: '36px',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        marginBottom: 'var(--space-sm)',
      },
    }, barSegments)
  );

  // Legend below
  const legendItems = segments.map(s =>
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      },
    }, [
      DOMUtils.create('span', {
        style: {
          width: '12px',
          height: '12px',
          borderRadius: '3px',
          background: s.color,
          display: 'inline-block',
          flexShrink: '0',
        },
      }),
      DOMUtils.create('span', {
        textContent: `${s.label} (${s.count})`,
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem' },
      }),
    ])
  );

  trendEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--space-md)',
        flexWrap: 'wrap',
      },
    }, legendItems)
  );
}

// --- Tiles Block (Category Summaries) -----------------------------------

function _renderTiles(tilesEl, subScores) {
  const catKeys = ['environment', 'society', 'economy', 'progress'];
  const tileData = catKeys.map(key => {
    const cat = subScores[key] || {};
    const config = CATEGORIES[key];
    const indCount = (cat.indicators || []).length;
    return {
      label: i18n.t(config.key),
      value: cat.value !== undefined ? cat.value.toFixed(1) : '--',
      unit: `${indCount} ` + i18n.t('detail.momentum_detail.indicatorsUnit'),
      accent: config.color,
    };
  });

  const tiles = tileData.map(({ label, value, unit, accent }) =>
    DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        textAlign: 'center',
        borderTop: `3px solid ${accent}`,
      },
    }, [
      DOMUtils.create('div', {
        textContent: label,
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' },
      }),
      DOMUtils.create('div', {
        textContent: value,
        style: {
          color: accent,
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.momentum_detail.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.momentum_detail.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    { label: i18n.t('detail.momentum_detail.sourceWorldOne'), url: '#' },
    { label: 'World Bank Open Data', url: 'https://data.worldbank.org/' },
    { label: 'NOAA / NASA', url: 'https://www.noaa.gov/' },
    { label: 'UNHCR', url: 'https://www.unhcr.org/' },
    { label: 'ACLED', url: 'https://acleddata.com/' },
    { label: 'Freedom House', url: 'https://freedomhouse.org/' },
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
          color: toRgba(CHART_COLORS.momentum, 0.9),
          textDecoration: 'none',
          borderBottom: '1px solid ' + toRgba(CHART_COLORS.momentum, 0.3),
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

// --- Chart Configs (none -- all DOM/SVG) --------------------------------

export function getChartConfigs() {
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _indicators = null;
  _momentumData = null;
  console.log('[Momentum Detail] cleanup()');
}
