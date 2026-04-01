/* ===================================================================
   World.One 2.0 -- Ocean pH Topic Module (OCEAN-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: NOAA PMEL (hardcoded pH trend 1850-2025), IPCC AR6
   Visualizations: pH Trend Line (Chart.js), pH Scale (DOM),
                   Acidification Impact Cards (DOM)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'ocean_ph',
  titleKey: 'detail.ocean_ph.title',
  category: 'ocean',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _cacheData = null;

// --- pH Trend Data (NOAA PMEL, 1850-2025) ------------------------------
// Source: Doney et al. 2009, NOAA PMEL CO2 Program, IPCC AR6
// Pre-industrial ~8.25, current ~8.08

const PH_TREND = [
  { year: 1850, ph: 8.25 },
  { year: 1860, ph: 8.25 },
  { year: 1870, ph: 8.24 },
  { year: 1880, ph: 8.24 },
  { year: 1890, ph: 8.23 },
  { year: 1900, ph: 8.22 },
  { year: 1910, ph: 8.22 },
  { year: 1920, ph: 8.21 },
  { year: 1930, ph: 8.21 },
  { year: 1940, ph: 8.20 },
  { year: 1945, ph: 8.20 },
  { year: 1950, ph: 8.18 },
  { year: 1955, ph: 8.18 },
  { year: 1960, ph: 8.17 },
  { year: 1965, ph: 8.17 },
  { year: 1970, ph: 8.16 },
  { year: 1972, ph: 8.16 },
  { year: 1975, ph: 8.15 },
  { year: 1978, ph: 8.15 },
  { year: 1980, ph: 8.14 },
  { year: 1982, ph: 8.14 },
  { year: 1985, ph: 8.13 },
  { year: 1988, ph: 8.13 },
  { year: 1990, ph: 8.12 },
  { year: 1992, ph: 8.12 },
  { year: 1995, ph: 8.11 },
  { year: 1998, ph: 8.11 },
  { year: 2000, ph: 8.10 },
  { year: 2003, ph: 8.10 },
  { year: 2005, ph: 8.09 },
  { year: 2008, ph: 8.09 },
  { year: 2010, ph: 8.09 },
  { year: 2015, ph: 8.08 },
  { year: 2020, ph: 8.08 },
  { year: 2025, ph: 8.08 },
];

// --- pH Scale Items (for visual reference) ------------------------------

function _getPhScaleItems() {
  return [
    { ph: 0,    label: i18n.t('detail.ocean_ph.phBatteryAcid'),         color: '#d50000' },
    { ph: 1,    label: i18n.t('detail.ocean_ph.phStomachAcid'),         color: '#e53935' },
    { ph: 3,    label: i18n.t('detail.ocean_ph.phVinegar'),             color: '#ff6d00' },
    { ph: 5.5,  label: i18n.t('detail.ocean_ph.phRain'),               color: '#ffab00' },
    { ph: 7,    label: i18n.t('detail.ocean_ph.phPureWater'),           color: '#00c853' },
    { ph: 8.08, label: i18n.t('detail.ocean_ph.phCurrentOcean'),        color: '#2979ff' },
    { ph: 8.25, label: i18n.t('detail.ocean_ph.phPreIndustrialOcean'),  color: '#0d47a1' },
    { ph: 10,   label: i18n.t('detail.ocean_ph.phSoap'),               color: '#6200ea' },
    { ph: 14,   label: i18n.t('detail.ocean_ph.phDrainCleaner'),       color: '#aa00ff' },
  ];
}

// --- Acidification Impacts on Marine Life --------------------------------

const ACIDIFICATION_IMPACTS = [
  {
    organism: 'Coral',
    icon: '\uD83E\uDEB8',
    threshold: 7.8,
    desc_de: 'Kalkschalen lösen sich unter pH 7.8 auf. Korallenriffe drohen zu verschwinden.',
    desc_en: 'Calcium carbonate shells dissolve below pH 7.8. Coral reefs face dissolution.',
  },
  {
    organism: 'Oysters',
    icon: '\uD83E\uDDAA',
    threshold: 7.95,
    desc_de: 'Larven können ab pH 7.95 keine Schalen mehr bilden. Austernfarmen sind bedroht.',
    desc_en: 'Larvae fail to form shells below pH 7.95. Oyster farms are threatened.',
  },
  {
    organism: 'Pteropods',
    icon: '\uD83D\uDC1A',
    threshold: 8.08,
    desc_de: 'Schalen werden bereits beim aktuellen pH dünner. Basis der arktischen Nahrungskette.',
    desc_en: 'Shells are thinning at current pH levels. Base of the Arctic food chain.',
  },
  {
    organism: 'Clownfish',
    icon: '\uD83D\uDC20',
    threshold: 7.8,
    desc_de: 'Verhaltensänderungen: Räuber werden nicht mehr erkannt. Orientierung gestört.',
    desc_en: 'Behavioral changes: predators no longer recognized. Navigation disrupted.',
  },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // Attempt data fetch for potential future cache support
  const { data, tier, age } = await fetchTopicData('ocean');
  _cacheData = data;

  // 1. Hero block
  _renderHero(blocks.hero, tier, age);

  // 2. Chart block -- pH trend
  await _renderPHChart(blocks.chart);

  // 3. Trend block -- pH scale visualization
  _renderPHScale(blocks.trend);

  // 4. Tiles block -- acidification impact cards
  _renderImpactCards(blocks.tiles);

  // 5. Explanation block
  _renderExplanation(blocks.explanation);

  // 6. Comparison block -- then vs now
  _renderComparison(blocks.comparison);

  // 7. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, tier, age) {
  const currentPH = 8.08;
  const preIndustrialPH = 8.25;
  const change = currentPH - preIndustrialPH; // -0.17
  const badge = createTierBadge('static', { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'ocean-ph-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: '#5ac8fa',
          marginBottom: 'var(--space-xs)',
        },
        textContent: currentPH.toFixed(2),
      }),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: `${change.toFixed(2)} ${i18n.t('detail.ocean_ph.vsPreIndustrial')}`,
          style: { color: '#ff9500', fontSize: '1rem', fontWeight: '600' },
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
          textContent: i18n.t('detail.ocean_ph.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.ocean_ph.heroExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.ocean_ph.acidityExplain'),
        style: { color: 'var(--text-tertiary)', fontSize: '0.8rem', margin: '0' },
      }),
    ])
  );
}

// --- Chart Block (pH Trend 1850-2025) -----------------------------------

async function _renderPHChart(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.ocean_ph.trendTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.ocean_ph.acidExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'ocean-ph-trend-chart' }),
      ]),
    ])
  );

  await ensureChartJs();

  const labels = PH_TREND.map(d => d.year.toString());
  const values = PH_TREND.map(d => d.ph);

  createChart('ocean-ph-trend-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: i18n.t('detail.ocean_ph.phLabel'),
        data: values,
        borderColor: '#5ac8fa',
        backgroundColor: 'rgba(90, 200, 250, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHitRadius: 8,
        pointBackgroundColor: '#5ac8fa',
        borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10, maxRotation: 45 },
        },
        y: {
          min: 8.04,
          max: 8.28,
          title: {
            display: true,
            text: 'pH',
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `pH: ${item.parsed.y.toFixed(2)}`,
          },
        },
        annotation: {
          annotations: {
            preIndustrial: {
              type: 'line',
              yMin: 8.25,
              yMax: 8.25,
              borderColor: 'rgba(255,255,255,0.4)',
              borderWidth: 1,
              borderDash: [6, 4],
              label: {
                display: true,
                content: i18n.t('detail.ocean_ph.chartPreIndustrial'),
                position: 'start',
                color: 'rgba(255,255,255,0.6)',
                font: { size: 10 },
              },
            },
          },
        },
      },
    },
  });
}

// --- Trend Block (pH Scale Visualization) --------------------------------

function _renderPHScale(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_ph.scaleTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Horizontal pH scale bar
  const scaleContainer = DOMUtils.create('div', {
    style: {
      position: 'relative',
      height: '60px',
      borderRadius: '8px',
      background: 'linear-gradient(to right, #d50000 0%, #ff6d00 21%, #ffab00 39%, #00c853 50%, #2979ff 57%, #6200ea 71%, #aa00ff 100%)',
      marginBottom: 'var(--space-lg)',
    },
  });

  // pH number labels along the bottom
  [0, 2, 4, 6, 7, 8, 10, 12, 14].forEach(ph => {
    const pct = (ph / 14) * 100;
    scaleContainer.appendChild(
      DOMUtils.create('div', {
        textContent: ph.toString(),
        style: {
          position: 'absolute',
          left: `${pct}%`,
          bottom: '-20px',
          transform: 'translateX(-50%)',
          fontSize: '0.7rem',
          color: 'var(--text-tertiary)',
        },
      })
    );
  });

  trendEl.appendChild(scaleContainer);

  // Markers for key items
  const oceanItems = _getPhScaleItems().filter(item =>
    item.ph === 8.08 || item.ph === 8.25 || item.ph === 7
  );

  const markersContainer = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 'var(--space-sm)',
      marginTop: 'var(--space-md)',
    },
  });

  _getPhScaleItems().forEach(item => {
    const isOcean = item.ph === 8.08 || item.ph === 8.25;
    markersContainer.appendChild(
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          padding: '8px 12px',
          borderRadius: '8px',
          background: isOcean ? 'var(--card-bg, rgba(255,255,255,0.08))' : 'transparent',
          border: isOcean ? `1px solid ${item.color}` : '1px solid transparent',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: item.color,
            flexShrink: '0',
          },
        }),
        DOMUtils.create('div', {}, [
          DOMUtils.create('div', {
            textContent: `pH ${item.ph}`,
            style: { fontSize: '0.85rem', fontWeight: '600', color: item.color },
          }),
          DOMUtils.create('div', {
            textContent: item.label,
            style: { fontSize: '0.75rem', color: 'var(--text-secondary)' },
          }),
        ]),
      ])
    );
  });

  trendEl.appendChild(markersContainer);
}

// --- Tiles Block (Acidification Impact Cards) ----------------------------

function _renderImpactCards(tilesEl) {
  tilesEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_ph.acidTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const lang = i18n.currentLang === 'de' ? 'de' : 'en';

  const grid = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 'var(--space-sm)',
    },
  });

  ACIDIFICATION_IMPACTS.forEach(impact => {
    const atRisk = impact.threshold >= 8.08;
    const borderColor = atRisk ? '#ff9500' : '#ff3b30';
    const desc = lang === 'de' ? impact.desc_de : impact.desc_en;

    grid.appendChild(
      DOMUtils.create('div', {
        style: {
          background: 'var(--card-bg, rgba(255,255,255,0.05))',
          borderRadius: '12px',
          padding: 'var(--space-md)',
          borderLeft: `4px solid ${borderColor}`,
        },
      }, [
        DOMUtils.create('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            marginBottom: 'var(--space-xs)',
          },
        }, [
          DOMUtils.create('span', {
            textContent: impact.icon,
            style: { fontSize: '1.5rem' },
          }),
          DOMUtils.create('span', {
            textContent: impact.organism,
            style: { fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' },
          }),
        ]),
        DOMUtils.create('div', {
          textContent: `${i18n.t('detail.ocean_ph.criticalPh')}: ${impact.threshold}`,
          style: {
            fontSize: '0.85rem',
            fontWeight: '600',
            color: borderColor,
            marginBottom: 'var(--space-xs)',
          },
        }),
        DOMUtils.create('p', {
          textContent: desc,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5', margin: '0' },
        }),
      ])
    );
  });

  tilesEl.appendChild(grid);
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(expEl) {
  const paragraphs = [
    i18n.t('detail.ocean_ph.explainP1'),
    i18n.t('detail.ocean_ph.explainP2'),
    i18n.t('detail.ocean_ph.explainP3'),
  ];

  expEl.appendChild(
    DOMUtils.create('div', {}, paragraphs.map(text =>
      DOMUtils.create('p', {
        textContent: text,
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: 'var(--space-xs)' },
      })
    ))
  );
}

// --- Comparison Block (Then vs Now) --------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_ph.thenVsNow'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const comparisons = [
    {
      label: i18n.t('detail.ocean_ph.compPreIndustrialLabel'),
      ph: '8.25',
      acidity: i18n.t('detail.ocean_ph.compBaseline'),
      color: '#0d47a1',
      desc: i18n.t('detail.ocean_ph.compPreIndustrialDesc'),
    },
    {
      label: i18n.t('detail.ocean_ph.compCurrentLabel'),
      ph: '8.08',
      acidity: i18n.t('detail.ocean_ph.compCurrentAcidity'),
      color: '#ff9500',
      desc: i18n.t('detail.ocean_ph.compCurrentDesc'),
    },
    {
      label: i18n.t('detail.ocean_ph.compProjectedLabel'),
      ph: '7.75',
      acidity: i18n.t('detail.ocean_ph.compProjectedAcidity'),
      color: '#ff3b30',
      desc: i18n.t('detail.ocean_ph.compProjectedDesc'),
    },
  ];

  const grid = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 'var(--space-sm)',
    },
  });

  comparisons.forEach(c => {
    grid.appendChild(
      DOMUtils.create('div', {
        style: {
          background: 'var(--card-bg, rgba(255,255,255,0.05))',
          borderRadius: '12px',
          padding: 'var(--space-md)',
          borderTop: `3px solid ${c.color}`,
          textAlign: 'center',
        },
      }, [
        DOMUtils.create('div', {
          textContent: c.label,
          style: { fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-xs)' },
        }),
        DOMUtils.create('div', {
          textContent: `pH ${c.ph}`,
          style: { fontSize: '2rem', fontWeight: '700', color: c.color, marginBottom: '4px' },
        }),
        DOMUtils.create('div', {
          textContent: c.acidity,
          style: { fontSize: '0.85rem', fontWeight: '600', color: c.color, marginBottom: 'var(--space-xs)' },
        }),
        DOMUtils.create('p', {
          textContent: c.desc,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5', margin: '0' },
        }),
      ])
    );
  });

  compEl.appendChild(grid);
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    { label: 'NOAA PMEL CO\u2082 Program', url: 'https://www.pmel.noaa.gov/co2/' },
    { label: 'IPCC AR6 WG1 Chapter 5', url: 'https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-5/' },
    { label: 'Doney et al. 2009 (Annual Review)', url: 'https://doi.org/10.1146/annurev.marine.010908.163834' },
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

// --- Chart Configs (lazy-loaded by detail-app.js) -----------------------

export function getChartConfigs() {
  // pH chart rendered directly in render() for time range support
  return [];
}

// --- Cleanup -------------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _cacheData = null;
  console.log('[OceanPH] cleanup()');
}
