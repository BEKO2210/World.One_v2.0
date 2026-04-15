/* ===================================================================
   World.One 2.0 -- Endangered Species Topic Module (BIO-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: IUCN Red List categories (cache + hardcoded), GBIF threatened
         species counts from biodiversity.json cache, bilingual species
         examples per IUCN category
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'endangered',
  titleKey: 'detail.endangered.title',
  category: 'biodiversity',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _cacheData = null;

// --- IUCN Red List Categories ------------------------------------------
// CR/EN/VU counts filled dynamically from biodiversity.json cache

const IUCN_CATEGORIES = [
  { code: 'EX', color: '#000000', count: 905 },
  { code: 'EW', color: '#3d0c11', count: 83 },
  { code: 'CR', color: '#cc3333', count: 0 },
  { code: 'EN', color: '#cc6633', count: 0 },
  { code: 'VU', color: '#cc9900', count: 0 },
  { code: 'NT', color: '#99cc33', count: 8500 },
  { code: 'LC', color: '#33cc33', count: 67000 },
];

// --- Species Examples (keys for i18n lookup) ---------------------------

const SPECIES_EXAMPLE_KEYS = {
  CR: [
    'detail.endangered.species.CR.0',
    'detail.endangered.species.CR.1',
    'detail.endangered.species.CR.2',
    'detail.endangered.species.CR.3',
    'detail.endangered.species.CR.4',
  ],
  EN: [
    'detail.endangered.species.EN.0',
    'detail.endangered.species.EN.1',
    'detail.endangered.species.EN.2',
    'detail.endangered.species.EN.3',
    'detail.endangered.species.EN.4',
  ],
  VU: [
    'detail.endangered.species.VU.0',
    'detail.endangered.species.VU.1',
    'detail.endangered.species.VU.2',
    'detail.endangered.species.VU.3',
    'detail.endangered.species.VU.4',
  ],
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached biodiversity data (shared cache for all bio topics)
  const { data, tier, age } = await fetchTopicData('biodiversity');
  _cacheData = data;

  // Extract threatened counts from cache, with static fallbacks.
  // Fallbacks matchen Main-Page + biodiversity.js (GBIF 2026-04).
  let cr = 27454;
  let en = 49014;
  let vu = 53817;
  let total = 130285;

  if (data && data.threatened_counts) {
    cr = data.threatened_counts.critically_endangered || cr;
    en = data.threatened_counts.endangered || en;
    vu = data.threatened_counts.vulnerable || vu;
    total = data.threatened_counts.total || total;
  }

  // Fill dynamic IUCN category counts from cache
  const categories = IUCN_CATEGORIES.map(cat => {
    if (cat.code === 'CR') return { ...cat, count: cr };
    if (cat.code === 'EN') return { ...cat, count: en };
    if (cat.code === 'VU') return { ...cat, count: vu };
    return { ...cat };
  });

  // 2. Hero block -- total threatened species
  _renderHero(blocks.hero, total, tier, age);

  // 3. Chart block -- IUCN category doughnut
  await _renderDoughnut(blocks.chart, categories, total);

  // 4. Trend block -- Category breakdown bars
  _renderCategoryBars(blocks.trend, cr, en, vu, total);

  // 5. Tiles block -- Species examples per category
  _renderSpeciesExamples(blocks.tiles, cr, en, vu);

  // 6. Explanation block -- IUCN Red List assessment
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Assessed vs Unknown
  _renderAssessedComparison(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, total, tier, age) {
  const badge = createTierBadge(tier, { age });
  const formatted = total.toLocaleString();

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'endangered-hero' }, [
      DOMUtils.create('div', {
        className: 'endangered-hero__value',
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--warning, #f57c00)',
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
          textContent: i18n.t('detail.endangered.speciesUnit'),
        }),
      ]),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.endangered.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.endangered.heroExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0' },
      }),
    ])
  );
}

// --- Chart Block (IUCN Category Doughnut) ------------------------------

async function _renderDoughnut(chartEl, categories, total) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.endangered.categoriesTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.endangered.categoriesDesc'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:380px;',
      }, [
        DOMUtils.create('canvas', { id: 'endangered-doughnut-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  const labels = categories.map(c => i18n.t(`detail.endangered.iucn.${c.code}`));
  const counts = categories.map(c => c.count);
  const colors = categories.map(c => c.color);

  createChart('endangered-doughnut-chart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: colors,
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const count = ctx.raw;
              const grandTotal = counts.reduce((a, b) => a + b, 0);
              const pct = ((count / grandTotal) * 100).toFixed(1);
              return ` ${ctx.label}: ${count.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  // Center text overlay showing total threatened
  chartEl.querySelector('div[style*="height:380px"]').appendChild(
    DOMUtils.create('div', {
      style: {
        position: 'absolute',
        top: '42%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
      },
    }, [
      DOMUtils.create('div', {
        textContent: total.toLocaleString(),
        style: { fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' },
      }),
      DOMUtils.create('div', {
        textContent: i18n.t('detail.endangered.threatened'),
        style: { fontSize: '0.75rem', color: 'var(--text-secondary)' },
      }),
    ])
  );
}

// --- Trend Block (Category Breakdown Bars) ------------------------------

function _renderCategoryBars(trendEl, cr, en, vu, total) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.endangered.categoriesDetailTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const threatened = [
    { code: 'CR', name: i18n.t('detail.endangered.iucn.CR'), count: cr, color: '#cc3333' },
    { code: 'EN', name: i18n.t('detail.endangered.iucn.EN'), count: en, color: '#cc6633' },
    { code: 'VU', name: i18n.t('detail.endangered.iucn.VU'), count: vu, color: '#cc9900' },
  ];

  threatened.forEach(cat => {
    const pct = ((cat.count / total) * 100).toFixed(1);
    const barWidth = Math.max((cat.count / total) * 100, 3);

    trendEl.appendChild(
      DOMUtils.create('div', {
        style: {
          padding: 'var(--space-sm)',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' },
        }, [
          DOMUtils.create('div', {
            style: { display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' },
          }, [
            DOMUtils.create('div', {
              textContent: cat.code,
              style: {
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: cat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: '700',
                color: '#fff',
                flexShrink: '0',
              },
            }),
            DOMUtils.create('span', {
              textContent: cat.name,
              style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
            }),
          ]),
          DOMUtils.create('span', {
            textContent: cat.count.toLocaleString(),
            style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.1rem' },
          }),
        ]),
        // Proportional bar
        DOMUtils.create('div', {
          style: {
            height: '8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '0.25rem',
          },
        }, [
          DOMUtils.create('div', {
            style: {
              width: `${barWidth}%`,
              height: '100%',
              background: cat.color,
              borderRadius: '4px',
              transition: 'width 0.6s ease',
            },
          }),
        ]),
        DOMUtils.create('div', {
          textContent: `${pct}% ${i18n.t('detail.endangered.ofTotalThreatened')}`,
          style: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
        }),
      ])
    );
  });
}

// --- Tiles Block (Species Examples) ------------------------------------

function _renderSpeciesExamples(tilesEl, cr, en, vu) {
  tilesEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.endangered.speciesTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const sections = [
    { code: 'CR', name: i18n.t('detail.endangered.iucn.CR'), count: cr, color: '#cc3333' },
    { code: 'EN', name: i18n.t('detail.endangered.iucn.EN'), count: en, color: '#cc6633' },
    { code: 'VU', name: i18n.t('detail.endangered.iucn.VU'), count: vu, color: '#cc9900' },
  ];

  sections.forEach(sec => {
    const examples = (SPECIES_EXAMPLE_KEYS[sec.code] || []).map(key => i18n.t(key));

    const speciesItems = examples.map(species =>
      DOMUtils.create('div', {
        style: {
          padding: '0.35rem var(--space-sm)',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '6px',
          marginBottom: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: '\u2022',
          style: { color: sec.color, fontSize: '1.2rem' },
        }),
        DOMUtils.create('span', {
          textContent: species,
          style: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
        }),
      ])
    );

    tilesEl.appendChild(
      DOMUtils.create('div', {
        style: {
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          borderLeft: `4px solid ${sec.color}`,
        },
      }, [
        // Header
        DOMUtils.create('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            marginBottom: 'var(--space-xs)',
          },
        }, [
          DOMUtils.create('div', {
            textContent: sec.code,
            style: {
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: sec.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: '700',
              color: '#fff',
              flexShrink: '0',
            },
          }),
          DOMUtils.create('span', {
            textContent: sec.name,
            style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
          }),
          DOMUtils.create('span', {
            textContent: sec.count.toLocaleString(),
            style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: 'auto' },
          }),
        ]),
        // Species list
        ...speciesItems,
      ])
    );
  });
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  const paragraphs = [
    i18n.t('detail.endangered.explanationP1'),
    i18n.t('detail.endangered.explanationP2'),
    i18n.t('detail.endangered.explanationP3'),
  ];

  explEl.appendChild(
    DOMUtils.create('div', {}, paragraphs.map(text =>
      DOMUtils.create('p', {
        textContent: text,
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', marginBottom: 'var(--space-sm)' },
      })
    ))
  );
}

// --- Comparison Block (Assessed vs Unknown) ----------------------------

function _renderAssessedComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.endangered.assessedVsUnknown'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const layers = [
    {
      label: i18n.t('detail.endangered.assessedByIUCN'),
      count: 160000,
      formatted: i18n.t('detail.endangered.assessedByIUCNFormatted'),
      color: '#33cc33',
      widthPct: 100,
    },
    {
      label: i18n.t('detail.endangered.knownSpecies'),
      count: 2100000,
      formatted: i18n.t('detail.endangered.knownSpeciesFormatted'),
      color: '#cc9900',
      widthPct: 100,
    },
    {
      label: i18n.t('detail.endangered.estimatedTotal'),
      count: 8700000,
      formatted: i18n.t('detail.endangered.estimatedTotalFormatted'),
      color: '#cc3333',
      widthPct: 100,
    },
  ];

  // Proportional nested rectangles
  const maxCount = layers[layers.length - 1].count;

  const bars = layers.map((layer, idx) => {
    const proportion = (layer.count / maxCount) * 100;

    return DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        marginBottom: 'var(--space-xs)',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '8px',
        borderLeft: `4px solid ${layer.color}`,
      },
    }, [
      DOMUtils.create('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' },
      }, [
        DOMUtils.create('span', {
          textContent: layer.label,
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
        }),
        DOMUtils.create('span', {
          textContent: layer.formatted,
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '1rem' },
        }),
      ]),
      // Proportional bar
      DOMUtils.create('div', {
        style: {
          height: '12px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '6px',
          overflow: 'hidden',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${proportion}%`,
            height: '100%',
            background: layer.color,
            borderRadius: '6px',
            opacity: '0.7',
            transition: 'width 0.6s ease',
          },
        }),
      ]),
    ]);
  });

  bars.forEach(bar => compEl.appendChild(bar));

  // Context note
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.endangered.assessedNote'),
      style: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        lineHeight: '1.6',
        marginTop: 'var(--space-sm)',
        fontStyle: 'italic',
      },
    })
  );
}

// --- Sources Block ------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.endangered.sourceIUCN'),
      url: 'https://www.iucnredlist.org/',
    },
    {
      label: i18n.t('detail.endangered.sourceGBIF'),
      url: 'https://www.gbif.org/',
    },
    {
      label: i18n.t('detail.endangered.sourceWWF'),
      url: 'https://livingplanet.panda.org/',
    },
    {
      label: i18n.t('detail.endangered.sourceIPBES'),
      url: 'https://ipbes.net/global-assessment',
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
        textContent: i18n.t('detail.endangered.sources'),
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
  // Doughnut rendered directly in render() for language sensitivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _cacheData = null;
  console.log('[Endangered] cleanup()');
}
