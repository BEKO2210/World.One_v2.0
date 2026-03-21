/* ===================================================================
   World.One 1.0 -- Space Topic Module (PROG-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: ISS position (wheretheiss.at, live 10s refresh),
         Spaceflight News (cache), Crew (hardcoded), Satellites (hardcoded)
   Visualizations: SVG world map with ISS dot + orbit trail, crew list,
                   news feed, satellite count bars
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'space',
  titleKey: 'detail.space.title',
  category: 'progress',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _trail = [];
let _chartData = null;
const MAX_TRAIL = 30; // ~5 minutes of positions at 10s intervals

// --- Simplified continent outlines for SVG map -------------------------
// Copied from earthquakes.js (same base map)

const CONTINENT_PATHS = [
  // North America
  'M50,80 L130,55 L160,65 L175,110 L145,140 L130,180 L105,175 L85,145 L50,130 Z',
  // South America
  'M130,195 L155,180 L170,195 L175,235 L165,290 L145,320 L120,305 L115,255 L120,220 Z',
  // Europe
  'M410,65 L460,55 L480,70 L470,90 L490,100 L465,115 L430,105 L410,95 Z',
  // Africa
  'M420,130 L470,120 L500,145 L505,190 L490,240 L470,280 L440,290 L420,260 L410,210 L415,165 Z',
  // Asia
  'M490,55 L600,35 L700,50 L730,80 L710,115 L680,130 L640,135 L600,145 L540,140 L500,130 L485,105 L490,80 Z',
  // Australia
  'M680,260 L730,250 L760,265 L765,290 L740,310 L700,310 L680,290 Z',
  // Antarctica
  'M100,420 L300,415 L500,420 L700,415 L800,425 L700,445 L300,445 L100,440 Z',
];

// --- ISS Crew (Expedition 74, early 2026 -- hardcoded, changes ~6 months) --

const ISS_CREW = [
  { name: 'Butch Wilmore', nationality: 'US', flag: '\u{1F1FA}\u{1F1F8}', role: 'Commander', agency: 'NASA' },
  { name: 'Suni Williams', nationality: 'US', flag: '\u{1F1FA}\u{1F1F8}', role: 'Flight Engineer', agency: 'NASA' },
  { name: 'Alexei Ovchinin', nationality: 'RU', flag: '\u{1F1F7}\u{1F1FA}', role: 'Flight Engineer', agency: 'Roscosmos' },
  { name: 'Ivan Vagner', nationality: 'RU', flag: '\u{1F1F7}\u{1F1FA}', role: 'Flight Engineer', agency: 'Roscosmos' },
  { name: 'Don Pettit', nationality: 'US', flag: '\u{1F1FA}\u{1F1F8}', role: 'Flight Engineer', agency: 'NASA' },
  { name: 'Jonny Kim', nationality: 'US', flag: '\u{1F1FA}\u{1F1F8}', role: 'Flight Engineer', agency: 'NASA' },
  { name: 'Takuya Onishi', nationality: 'JP', flag: '\u{1F1EF}\u{1F1F5}', role: 'Flight Engineer', agency: 'JAXA' },
];

// --- Satellite breakdown (UCS Satellite Database 2025) -----------------

const SATELLITE_DATA = [
  { operator: 'SpaceX / Starlink', count: 6000, color: toRgba(CHART_COLORS.progress, 0.9) },
  { operator: 'OneWeb', count: 600, color: 'rgba(90, 200, 250, 0.8)' },
  { operator: 'Planet Labs', count: 200, color: 'rgba(255, 215, 0, 0.8)' },
  { operator: 'Others', count: 6200, color: 'rgba(255, 255, 255, 0.3)' },
];
const TOTAL_SATELLITES = 13000;

// --- SVG map element references ----------------------------------------

let _trailEl = null;
let _dotEl = null;
let _posTextEl = null;

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // --- 1. Build ISS SVG Map (block 0 -- primary chart, rendered directly) ---
  const { svg, trail, dot, posText } = _buildISSMap();
  _trailEl = trail;
  _dotEl = dot;
  _posTextEl = posText;

  // Hero block: ISS altitude + live badge
  _renderHero(blocks.hero);

  // Chart block: ISS SVG map
  blocks.chart.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.space.issTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: {
          position: 'relative',
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
        },
      }, [svg, posText]),
    ])
  );

  // --- 2. Start ISS position polling ---
  const update = async () => {
    try {
      const res = await fetchWithTimeout(
        'https://api.wheretheiss.at/v1/satellites/25544', 8000
      );
      if (res.ok) {
        const data = await res.json();
        _updateISSPosition(data.latitude, data.longitude);
      }
    } catch (err) {
      console.warn('[Space] ISS fetch failed:', err.message);
    }
  };
  update(); // Initial fetch
  _intervals.push(setInterval(update, 10000)); // 10s refresh

  // --- 3. Crew list (block 1 -- trend area) ---
  _renderCrew(blocks.trend);

  // --- 4. Tiles block ---
  _renderTiles(blocks.tiles);

  // --- 5. Spaceflight news feed (block 3 -- explanation area) ---
  await _renderNews(blocks.explanation);

  // --- 6. Satellite count bars (block 4 -- comparison area) ---
  _renderSatellites(blocks.comparison);

  // --- 7. Sources block ---
  _renderSources(blocks.sources);
}

// --- Hero Block ---------------------------------------------------------

function _renderHero(heroEl) {
  const badge = createTierBadge('live', { age: 0 });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'space-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        '~408',
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.space.heroUnit'),
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
          textContent: i18n.t('detail.space.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- ISS SVG Map --------------------------------------------------------

function _buildISSMap() {
  const svg = DOMUtils.createSVG('svg', {
    viewBox: '0 0 900 450',
    width: '100%',
    height: 'auto',
    style: 'display:block; background: rgba(255,255,255,0.02); border-radius: 8px;',
  });

  // Continent outlines
  for (const pathData of CONTINENT_PATHS) {
    svg.appendChild(DOMUtils.createSVG('path', {
      d: pathData,
      fill: 'rgba(255,255,255,0.05)',
      stroke: 'rgba(255,255,255,0.15)',
      'stroke-width': '0.5',
    }));
  }

  // Grid lines (latitude)
  for (let lat = -60; lat <= 60; lat += 30) {
    const { y } = MathUtils.geoToSVG(lat, 0, 900, 450);
    svg.appendChild(DOMUtils.createSVG('line', {
      x1: '0', y1: String(y), x2: '900', y2: String(y),
      stroke: 'rgba(255,255,255,0.04)',
      'stroke-width': '0.5',
    }));
  }
  // Grid lines (longitude)
  for (let lng = -150; lng <= 150; lng += 30) {
    const { x } = MathUtils.geoToSVG(0, lng, 900, 450);
    svg.appendChild(DOMUtils.createSVG('line', {
      x1: String(x), y1: '0', x2: String(x), y2: '450',
      stroke: 'rgba(255,255,255,0.04)',
      'stroke-width': '0.5',
    }));
  }

  // Orbit trail polyline (updated every 10s)
  const trail = DOMUtils.createSVG('polyline', {
    points: '',
    fill: 'none',
    stroke: 'rgba(0, 255, 204, 0.4)',
    'stroke-width': '1.5',
    'stroke-dasharray': '4,2',
  });
  svg.appendChild(trail);

  // ISS dot
  const dot = DOMUtils.createSVG('circle', {
    cx: '450', cy: '225', r: '6',
    fill: 'rgba(0, 255, 204, 0.9)',
    stroke: 'rgba(0, 255, 204, 0.3)',
    'stroke-width': '3',
  });
  svg.appendChild(dot);

  // Position text display below the map
  const posText = DOMUtils.create('div', {
    style: {
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: '0.8rem',
      marginTop: 'var(--space-xs)',
      fontVariantNumeric: 'tabular-nums',
    },
    textContent: 'ISS: --',
  });

  return { svg, trail, dot, posText };
}

// --- ISS Position Update ------------------------------------------------

function _updateISSPosition(lat, lng) {
  const { x, y } = MathUtils.geoToSVG(lat, lng, 900, 450);

  // Date line detection: if consecutive points jump > 400px, clear trail
  if (_trail.length > 0) {
    const last = _trail[_trail.length - 1];
    if (Math.abs(x - last.x) > 400) {
      _trail = [];
    }
  }

  _trail.push({ x, y });
  if (_trail.length > MAX_TRAIL) _trail.shift();

  // Update trail polyline
  if (_trailEl) {
    const trailPoints = _trail.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    _trailEl.setAttribute('points', trailPoints);
  }

  // Update ISS dot position
  if (_dotEl) {
    _dotEl.setAttribute('cx', String(x.toFixed(1)));
    _dotEl.setAttribute('cy', String(y.toFixed(1)));
  }

  // Update position text
  if (_posTextEl) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    _posTextEl.textContent = `ISS: ${Math.abs(lat).toFixed(2)}\u00B0${latDir}, ${Math.abs(lng).toFixed(2)}\u00B0${lngDir}`;
  }
}

// --- Crew List (trend block) --------------------------------------------

function _renderCrew(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.space.crewTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const crewItems = ISS_CREW.map(member =>
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        marginBottom: '6px',
      },
    }, [
      DOMUtils.create('span', {
        textContent: member.flag,
        style: { fontSize: '1.3rem' },
      }),
      DOMUtils.create('div', {
        style: { flex: '1' },
      }, [
        DOMUtils.create('div', {
          textContent: member.name,
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' },
        }),
        DOMUtils.create('div', {
          textContent: `${member.role} \u00B7 ${member.agency}`,
          style: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
        }),
      ]),
      member.role === 'Commander'
        ? DOMUtils.create('span', {
            textContent: 'CDR',
            style: {
              fontSize: '0.65rem',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '4px',
              background: toRgba(CHART_COLORS.progress, 0.2),
              color: toRgba(CHART_COLORS.progress),
              letterSpacing: '0.05em',
            },
          })
        : null,
    ].filter(Boolean))
  );

  trendEl.appendChild(
    DOMUtils.create('div', { className: 'space-crew-list' }, crewItems)
  );
}

// --- Context Tiles -------------------------------------------------------

function _renderTiles(tilesEl) {
  const tileData = [
    {
      label: i18n.t('detail.space.tileAltitude'),
      value: '~408',
      unit: 'km',
    },
    {
      label: i18n.t('detail.space.tileSpeed'),
      value: '27,600',
      unit: 'km/h',
    },
    {
      label: i18n.t('detail.space.tileCrew'),
      value: String(ISS_CREW.length),
      unit: '',
    },
    {
      label: i18n.t('detail.space.tileOrbits'),
      value: '~16',
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
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Spaceflight News Feed (explanation block) ---------------------------

async function _renderNews(explEl) {
  explEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.space.newsTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  let articles = [];
  try {
    const { data } = await fetchTopicData('space');
    if (data && data.articles) {
      articles = data.articles.slice(0, 6);
    }
  } catch (err) {
    console.warn('[Space] News fetch failed:', err.message);
  }

  if (articles.length === 0) {
    explEl.appendChild(
      DOMUtils.create('p', {
        textContent: 'No news available.',
        style: { color: 'var(--text-secondary)' },
      })
    );
    return;
  }

  const newsCards = articles.map(article => {
    const pubDate = article.published_at
      ? new Date(article.published_at).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
        })
      : '';

    const summary = article.summary
      ? (article.summary.length > 100 ? article.summary.slice(0, 100) + '...' : article.summary)
      : '';

    return DOMUtils.create('div', {
      style: {
        padding: '12px 14px',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        borderLeft: `3px solid ${toRgba(CHART_COLORS.progress, 0.5)}`,
      },
    }, [
      DOMUtils.create('a', {
        href: article.url,
        target: '_blank',
        rel: 'noopener',
        textContent: article.title,
        style: {
          color: 'var(--text-primary)',
          fontWeight: '600',
          fontSize: '0.9rem',
          textDecoration: 'none',
          display: 'block',
          marginBottom: '4px',
          lineHeight: '1.4',
        },
      }),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          gap: '8px',
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          marginBottom: '4px',
        },
      }, [
        DOMUtils.create('span', { textContent: article.news_site || '' }),
        pubDate ? DOMUtils.create('span', { textContent: pubDate }) : null,
      ].filter(Boolean)),
      summary
        ? DOMUtils.create('p', {
            textContent: summary,
            style: { color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0', lineHeight: '1.4' },
          })
        : null,
    ].filter(Boolean));
  });

  explEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, newsCards)
  );
}

// --- Satellite Count Bars (comparison block) -----------------------------

function _renderSatellites(compEl) {
  compEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.space.satTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
    })
  );

  compEl.appendChild(
    DOMUtils.create('div', {
      textContent: `~${MathUtils.formatNumber(TOTAL_SATELLITES)}`,
      style: {
        fontSize: '1.3rem',
        fontWeight: '600',
        color: toRgba(CHART_COLORS.progress, 0.9),
        marginBottom: 'var(--space-sm)',
      },
    })
  );

  const maxCount = Math.max(...SATELLITE_DATA.map(d => d.count));

  const bars = SATELLITE_DATA.map(({ operator, count, color }) => {
    const pct = (count / maxCount) * 100;
    return DOMUtils.create('div', {
      style: { marginBottom: '10px' },
    }, [
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        },
      }, [
        DOMUtils.create('span', {
          textContent: operator,
          style: { color: 'var(--text-primary)', fontSize: '0.85rem' },
        }),
        DOMUtils.create('span', {
          textContent: `~${MathUtils.formatNumber(count)}`,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' },
        }),
      ]),
      DOMUtils.create('div', {
        style: {
          height: '8px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '4px',
          overflow: 'hidden',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.6s ease',
          },
        }),
      ]),
    ]);
  });

  compEl.appendChild(
    DOMUtils.create('div', { className: 'satellite-bars' }, bars)
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.space.sourceISS'),
      url: 'https://wheretheiss.at/',
    },
    {
      label: i18n.t('detail.space.sourceNews'),
      url: 'https://api.spaceflightnewsapi.net/',
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
          borderBottom: `1px solid ${toRgba(CHART_COLORS.progress, 0.3)}`,
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

// --- Chart Configs (none -- all SVG/DOM-based) ---------------------------

export function getChartConfigs() {
  return [];
}

// --- Cleanup -------------------------------------------------------------

export function cleanup() {
  // CRITICAL: Stop ISS polling on navigation
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _trail = [];
  _chartData = null;
  _trailEl = null;
  _dotEl = null;
  _posTextEl = null;
  console.log('[Space] cleanup()');
}
