/* ===================================================================
   World.One 2.0 -- Extinction Rate Topic Module (BIO-01)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: IPBES 2019, Barnosky et al. 2011 (Big Five mass extinctions),
         Ceballos et al. 2015 (current rate), IUCN Red List (taxonomic)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'extinction',
  titleKey: 'detail.extinction.title',
  category: 'biodiversity',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _cacheData = null;

// --- Big Five Mass Extinctions (Barnosky et al. 2011, IPBES 2019) -----

const BIG_FIVE = [
  { name: 'Ordovician-Silurian', mya: 445, loss: 85, cause: 'Glaciation, sea level drop' },
  { name: 'Late Devonian', mya: 375, loss: 75, cause: 'Ocean anoxia, cooling' },
  { name: 'Permian-Triassic', mya: 252, loss: 96, cause: 'Volcanism, global warming' },
  { name: 'Triassic-Jurassic', mya: 201, loss: 80, cause: 'Volcanism, CO2 rise' },
  { name: 'Cretaceous-Paleogene', mya: 66, loss: 76, cause: 'Asteroid impact' },
];

// --- Extinction Rates (IPBES Global Assessment 2019) ------------------
// Background rate: 0.1-1.0 E/MSY (extinctions per million species-years)
// Current rate: 100-1000x background
// Known species: ~2.1 million described
// Estimated total: ~8.7 million (Mora et al. 2011)

const RATE_BACKGROUND_LOW = 0.1;
const RATE_BACKGROUND_HIGH = 1.0;
const RATE_MULTIPLIER_LOW = 100;
const RATE_MULTIPLIER_HIGH = 1000;

// --- Extinction by Taxonomic Group since 1500 CE (IUCN Red List) ------

const EXTINCTION_BY_GROUP = [
  { group: 'Mammals', groupDE: 'Säugetiere', extinct: 85, percentage: 1.5, icon: '' },
  { group: 'Birds', groupDE: 'Vögel', extinct: 159, percentage: 1.4, icon: '' },
  { group: 'Reptiles', groupDE: 'Reptilien', extinct: 35, percentage: 0.3, icon: '' },
  { group: 'Amphibians', groupDE: 'Amphibien', extinct: 35, percentage: 0.4, icon: '' },
  { group: 'Fish', groupDE: 'Fische', extinct: 80, percentage: 0.2, icon: '' },
  { group: 'Insects', groupDE: 'Insekten', extinct: 60, percentage: 0.01, icon: '' },
  { group: 'Plants', groupDE: 'Pflanzen', extinct: 571, percentage: 0.2, icon: '' },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached biodiversity data (shared cache for all bio topics)
  const { data, tier, age } = await fetchTopicData('biodiversity');
  _cacheData = data;

  let totalThreatened = 130285; // Fallback matches biodiversity.json live value
  if (data && data.threatened_counts) {
    totalThreatened = data.threatened_counts.total || totalThreatened;
  }

  // 2. Hero block -- 1000x rate multiplier
  _renderHero(blocks.hero, totalThreatened, tier, age);

  // 3. Chart block -- Big Five mass extinctions timeline
  await _renderBigFiveChart(blocks.chart);

  // 4. Trend block -- Rate comparison visualization
  _renderRateComparison(blocks.trend);

  // 5. Tiles block -- Extinction by taxonomic group
  _renderTaxonomicTiles(blocks.tiles);

  // 6. Explanation block -- Sixth Mass Extinction
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Then vs Now timeline
  _renderTimeline(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, totalThreatened, tier, age) {
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'extinction-hero' }, [
      DOMUtils.create('div', {
        className: 'extinction-hero__value',
        style: {
          fontSize: '4rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: 'var(--danger, #d32f2f)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        '1.000\u00D7',
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
          textContent: i18n.t('detail.extinction.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.extinction.heroExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0' },
      }),
      DOMUtils.create('div', {
        style: {
          marginTop: 'var(--space-sm)',
          padding: 'var(--space-xs) var(--space-sm)',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          display: 'inline-block',
        },
      }, [
        DOMUtils.create('span', {
          textContent: totalThreatened.toLocaleString() + ' ',
          style: { color: 'var(--text-primary)', fontWeight: '600' },
        }),
        DOMUtils.create('span', {
          textContent: i18n.t('detail.extinction.speciesThreatened'),
          style: { color: 'var(--text-secondary)', fontSize: '0.85rem' },
        }),
      ]),
    ])
  );
}

// --- Chart Block (Big Five Mass Extinctions) ----------------------------

async function _renderBigFiveChart(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.extinction.massTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.extinction.bigFiveDesc'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:380px;',
      }, [
        DOMUtils.create('canvas', { id: 'extinction-bigfive-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  // Big Five + current Holocene bar
  const allEvents = [
    ...BIG_FIVE.map(e => ({
      label: `${e.name} (${e.mya} Mya)`,
      loss: e.loss,
      cause: e.cause,
    })),
    {
      label: i18n.t('detail.extinction.currentHolocene'),
      loss: 5,
      cause: i18n.t('detail.extinction.currentHoloceneCause'),
    },
  ];

  // Colors: gradient from orange to deep red, with current in distinct pattern
  const barColors = [
    '#e65100', '#d84315', '#bf360c', '#b71c1c', '#880e4f',
    'rgba(211, 47, 47, 0.6)',
  ];

  const borderColors = [
    '#e65100', '#d84315', '#bf360c', '#b71c1c', '#880e4f',
    '#d32f2f',
  ];

  const borderDash = allEvents.map((_, i) => (i === 5 ? [6, 4] : []));

  createChart('extinction-bigfive-chart', {
    type: 'bar',
    data: {
      labels: allEvents.map(e => e.label),
      datasets: [{
        label: i18n.t('detail.extinction.speciesLost'),
        data: allEvents.map(e => e.loss),
        backgroundColor: barColors,
        borderColor: borderColors,
        borderWidth: allEvents.map((_, i) => (i === 5 ? 3 : 1)),
        borderDash: undefined,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: i18n.t('detail.extinction.speciesLost'),
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { size: 11 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => {
              const evt = allEvents[item.dataIndex];
              return [`${evt.loss}% ${i18n.t('detail.extinction.lost')}`, evt.cause];
            },
          },
        },
      },
    },
  });
}

// --- Trend Block (Rate Comparison) -------------------------------------

function _renderRateComparison(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.extinction.rateComparisonTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  trendEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.extinction.rateComparisonDesc'),
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' },
    })
  );

  // Background rate bar
  const bgBar = _createRateBar(
    i18n.t('detail.extinction.backgroundRate'),
    `${RATE_BACKGROUND_LOW} - ${RATE_BACKGROUND_HIGH} E/MSY`,
    1,
    'var(--text-secondary, #8a8a8e)',
    'rgba(255,255,255,0.08)'
  );

  // Current rate bar -- visually 100-1000x wider
  const currentBar = _createRateBar(
    i18n.t('detail.extinction.currentRate'),
    `${RATE_MULTIPLIER_LOW} - ${RATE_MULTIPLIER_HIGH} E/MSY`,
    80,
    '#fff',
    'var(--danger, #d32f2f)'
  );

  trendEl.appendChild(bgBar);
  trendEl.appendChild(
    DOMUtils.create('div', {
      style: { height: 'var(--space-sm)' },
    })
  );
  trendEl.appendChild(currentBar);

  // Multiplier annotation
  trendEl.appendChild(
    DOMUtils.create('div', {
      style: {
        textAlign: 'center',
        marginTop: 'var(--space-md)',
        padding: 'var(--space-sm)',
        background: 'rgba(211, 47, 47, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(211, 47, 47, 0.3)',
      },
    }, [
      DOMUtils.create('span', {
        textContent: '100 - 1.000\u00D7 ',
        style: { color: 'var(--danger, #d32f2f)', fontWeight: '700', fontSize: '1.5rem' },
      }),
      DOMUtils.create('span', {
        textContent: i18n.t('detail.extinction.fasterThanNatural'),
        style: { color: 'var(--text-secondary)', fontSize: '1rem' },
      }),
    ])
  );
}

function _createRateBar(label, valueText, widthPercent, textColor, bgColor) {
  return DOMUtils.create('div', {
    style: { marginBottom: 'var(--space-xs)' },
  }, [
    DOMUtils.create('div', {
      textContent: label,
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' },
    }),
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
      },
    }, [
      DOMUtils.create('div', {
        style: {
          width: `${widthPercent}%`,
          minWidth: '4px',
          height: '28px',
          background: bgColor,
          borderRadius: '4px',
          transition: 'width 0.6s ease',
        },
      }),
      DOMUtils.create('span', {
        textContent: valueText,
        style: { color: textColor, fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap' },
      }),
    ]),
  ]);
}

// --- Tiles Block (Taxonomic Group Extinction) ---------------------------

function _renderTaxonomicTiles(tilesEl) {
  const maxExtinct = Math.max(...EXTINCTION_BY_GROUP.map(g => g.extinct));

  const cards = EXTINCTION_BY_GROUP.map(g => {
    const intensity = Math.min(g.percentage / 1.5, 1);
    const cardColor = `rgba(211, 47, 47, ${0.05 + intensity * 0.15})`;
    const barWidth = Math.max((g.extinct / maxExtinct) * 100, 5);

    return DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: cardColor,
        borderRadius: '8px',
        borderLeft: `3px solid rgba(211, 47, 47, ${0.3 + intensity * 0.7})`,
      },
    }, [
      DOMUtils.create('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' },
      }, [
        DOMUtils.create('span', {
          textContent: `${g.icon} ${i18n.t('detail.extinction.group.' + g.group.toLowerCase())}`,
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
        }),
        DOMUtils.create('span', {
          textContent: `${g.percentage}%`,
          style: { color: 'var(--danger, #d32f2f)', fontWeight: '600', fontSize: '0.85rem' },
        }),
      ]),
      DOMUtils.create('div', {
        style: {
          height: '6px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '0.25rem',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${barWidth}%`,
            height: '100%',
            background: `rgba(211, 47, 47, ${0.4 + intensity * 0.6})`,
            borderRadius: '3px',
            transition: 'width 0.6s ease',
          },
        }),
      ]),
      DOMUtils.create('div', {
        textContent: `${g.extinct} ${i18n.t('detail.extinction.speciesExtinctSince1500')}`,
        style: { color: 'var(--text-secondary)', fontSize: '0.75rem' },
      }),
    ]);
  });

  tilesEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, cards)
  );
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.extinction.currentTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.extinction.currentExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
      }),
      // Drivers list
      DOMUtils.create('div', {
        style: { marginTop: 'var(--space-sm)' },
      }, _renderDrivers()),
    ])
  );
}

function _renderDrivers() {
  const drivers = [
    { icon: '', key: 'detail.extinction.driver.habitatLoss', pct: 30 },
    { icon: '', key: 'detail.extinction.driver.overexploitation', pct: 20 },
    { icon: '', key: 'detail.extinction.driver.climateChange', pct: 20 },
    { icon: '', key: 'detail.extinction.driver.pollution', pct: 15 },
    { icon: '', key: 'detail.extinction.driver.invasiveSpecies', pct: 15 },
  ];

  return drivers.map(d =>
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        padding: '0.4rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      },
    }, [
      DOMUtils.create('span', {
        textContent: d.icon,
        style: { fontSize: '1.1rem', width: '24px', textAlign: 'center' },
      }),
      DOMUtils.create('span', {
        textContent: i18n.t(d.key),
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem', flex: '1' },
      }),
      DOMUtils.create('span', {
        textContent: `~${d.pct}%`,
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: '0.7' },
      }),
    ])
  );
}

// --- Comparison Block (Then vs Now Timeline) ----------------------------

function _renderTimeline(compEl) {
  compEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.extinction.thenVsNow'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const timePoints = [
    {
      label: i18n.t('detail.extinction.timeline.bigFiveLabel'),
      duration: i18n.t('detail.extinction.timeline.bigFiveDuration'),
      color: '#e65100',
      width: 100,
    },
    {
      label: i18n.t('detail.extinction.timeline.currentCrisisLabel'),
      duration: i18n.t('detail.extinction.timeline.currentCrisisDuration'),
      color: 'var(--danger, #d32f2f)',
      width: 2,
    },
    {
      label: i18n.t('detail.extinction.timeline.accelerationLabel'),
      duration: i18n.t('detail.extinction.timeline.accelerationDuration'),
      color: 'var(--danger, #d32f2f)',
      width: 0.5,
    },
  ];

  timePoints.forEach(tp => {
    compEl.appendChild(
      DOMUtils.create('div', {
        style: {
          padding: 'var(--space-sm)',
          marginBottom: 'var(--space-xs)',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          borderLeft: `4px solid ${tp.color}`,
        },
      }, [
        DOMUtils.create('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' },
        }, [
          DOMUtils.create('span', {
            textContent: tp.label,
            style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
          }),
        ]),
        // Proportional duration bar
        DOMUtils.create('div', {
          style: {
            height: '8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '0.35rem',
          },
        }, [
          DOMUtils.create('div', {
            style: {
              width: `${tp.width}%`,
              minWidth: '3px',
              height: '100%',
              background: tp.color,
              borderRadius: '4px',
              transition: 'width 0.6s ease',
            },
          }),
        ]),
        DOMUtils.create('div', {
          textContent: tp.duration,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem' },
        }),
      ])
    );
  });

  // Context note
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.extinction.timeline.contextNote'),
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
      label: 'IPBES Global Assessment Report 2019',
      url: 'https://ipbes.net/global-assessment',
    },
    {
      label: 'Barnosky et al. (2011) -- Has the Earth\'s sixth mass extinction already arrived?',
      url: 'https://doi.org/10.1038/nature09678',
    },
    {
      label: 'IUCN Red List of Threatened Species',
      url: 'https://www.iucnredlist.org/',
    },
    {
      label: 'Ceballos et al. (2015) -- Accelerated modern human-induced species losses',
      url: 'https://doi.org/10.1126/sciadv.1400253',
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
        textContent: i18n.t('detail.extinction.sources'),
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
  // Big Five chart rendered directly in render() for language sensitivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _cacheData = null;
  console.log('[Extinction] cleanup()');
}
