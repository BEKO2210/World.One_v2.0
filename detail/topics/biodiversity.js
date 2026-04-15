/* ===================================================================
   World.One 2.0 -- Biodiversity Topic Module (ENV-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: GBIF/IUCN threatened species counts (cache), WWF Living Planet
         Index 2024 (hardcoded), NATURE_SCORE choropleth (from maps.js)
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
  id: 'biodiversity',
  titleKey: 'detail.biodiversity.title',
  category: 'environment',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _chartData = null;
let _choroplethCleanup = null;

// --- Living Planet Index Data (WWF/ZSL LPI 2024 report) ----------------
// Relative index: 1.0 = 1970 baseline, 0.27 = 73% decline by 2020

const LPI_DATA = [
  { year: 1970, value: 1.00 },
  { year: 1975, value: 0.92 },
  { year: 1980, value: 0.83 },
  { year: 1985, value: 0.76 },
  { year: 1990, value: 0.68 },
  { year: 1995, value: 0.60 },
  { year: 2000, value: 0.52 },
  { year: 2005, value: 0.45 },
  { year: 2010, value: 0.38 },
  { year: 2015, value: 0.32 },
  { year: 2020, value: 0.27 },
];

// --- IUCN Red List Categories ------------------------------------------

const IUCN_CATEGORIES = [
  { code: 'CR', count: 27358, color: '#d32f2f', labelKey: 'detail.biodiversity.tileCR' },
  { code: 'EN', count: 48895, color: '#f57c00', labelKey: 'detail.biodiversity.tileEN' },
  { code: 'VU', count: 53500, color: '#fbc02d', labelKey: 'detail.biodiversity.tileVU' },
];

// Critically endangered example species (hardcoded reference data)
const CR_EXAMPLES = {
  de: 'Sumatra-Tiger, Java-Nashorn, Vaquita, Berggorilla, Saola, Amur-Leopard, Nördliches Breitmaulnashorn, Kalifornischer Schweinswal',
  en: 'Sumatran Tiger, Javan Rhino, Vaquita, Mountain Gorilla, Saola, Amur Leopard, Northern White Rhino, California Porpoise',
};

// --- Nature threat index by country (from maps.js NATURE_SCORE) --------
// Higher value = higher threat / lower protection

const NATURE_SCORE = {
  DE: 0.38, FR: 0.33, ES: 0.28, IT: 0.22, GB: 0.28, SE: 0.15, NO: 0.17,
  FI: 0.12, AT: 0.29, CH: 0.13, PL: 0.4, RO: 0.23, BG: 0.35, GR: 0.36,
  BR: 0.3, CO: 0.15, PE: 0.18, BO: 0.22, EC: 0.2, VE: 0.55, GY: 0.1,
  US: 0.12, CA: 0.13, MX: 0.15, AU: 0.18, NZ: 0.33,
  CN: 0.15, IN: 0.05, JP: 0.21, KR: 0.17, ID: 0.15,
  CD: 0.12, CF: 0.1, CG: 0.13, CM: 0.1, GA: 0.18,
  KE: 0.08, TZ: 0.38, UG: 0.16, ET: 0.15, ZA: 0.08,
  RU: 0.11, KZ: 0.09, MN: 0.21,
  BW: 0.38, NA: 0.38, ZM: 0.42, MZ: 0.26,
  MG: 0.1, NE: 0.07, TD: 0.1, NG: 0.14, SD: 0.05, ML: 0.04,
  AF: 0.04, PK: 0.1, BD: 0.05, MM: 0.08, TH: 0.19, VN: 0.08,
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Fetch cached biodiversity data
  const { data, tier, age } = await fetchTopicData('biodiversity');

  // Extract threatened counts from cache data.
  // Fallbacks spiegeln den letzten bekannten Live-GBIF-Stand (2026-04),
  // damit bei komplettem Offline-Zustand das Detail identisch zur
  // Main-Page (#bio-threatened-count) anzeigt.
  let totalThreatened = 130285;
  let criticallyEndangered = 27454;
  let endangered = 49014;
  let vulnerable = 53817;

  if (data && data.threatened_counts) {
    totalThreatened = data.threatened_counts.total || totalThreatened;
    criticallyEndangered = data.threatened_counts.critically_endangered || criticallyEndangered;
    endangered = data.threatened_counts.endangered || endangered;
    vulnerable = data.threatened_counts.vulnerable || vulnerable;
  }

  // 2. Hero block
  _renderHero(blocks.hero, totalThreatened, tier, age);

  // 3. Chart block -- Living Planet Index trend
  await _renderLPIChart(blocks.chart);

  // 4. Trend block -- IUCN category browser
  _renderIUCN(blocks.trend, criticallyEndangered, endangered, vulnerable);

  // 5. Tiles block
  _renderTiles(blocks.tiles, criticallyEndangered, endangered, vulnerable);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Choropleth map
  await _renderMap(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, totalThreatened, tier, age) {
  const formatted = totalThreatened.toLocaleString();
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'biodiversity-hero' }, [
      DOMUtils.create('div', {
        className: 'biodiversity-hero__value',
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
          textContent: i18n.t('detail.biodiversity.heroUnit'),
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
          textContent: i18n.t('detail.biodiversity.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block (Living Planet Index) ----------------------------------

async function _renderLPIChart(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.biodiversity.lpiTitle'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.biodiversity.lpiDesc'),
        style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' },
      }),
      DOMUtils.create('div', {
        style: 'position:relative; height:350px;',
      }, [
        DOMUtils.create('canvas', { id: 'biodiversity-lpi-chart' }),
      ]),
    ])
  );

  // Render line chart directly for time range interactivity
  await ensureChartJs();

  const labels = LPI_DATA.map(d => d.year.toString());
  const values = LPI_DATA.map(d => d.value);

  _chartData = { labels, values };

  createChart('biodiversity-lpi-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: i18n.t('detail.biodiversity.lpiLabel'),
        data: values,
        borderColor: toRgba(CHART_COLORS.environment),
        backgroundColor: toRgba(CHART_COLORS.environment, 0.15),
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHitRadius: 8,
        pointBackgroundColor: toRgba(CHART_COLORS.environment),
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
          beginAtZero: true,
          max: 1.1,
          title: {
            display: true,
            text: i18n.t('detail.biodiversity.lpiAxis'),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => i18n.t('detail.biodiversity.lpiTooltip', { value: item.parsed.y.toFixed(2), pct: ((1 - item.parsed.y) * 100).toFixed(0) }),
          },
        },
      },
    },
  });

  // Listen for timerangechange event on trend block
  if (chartEl.closest) {
    const trendBlock = chartEl.closest('[id]')?.parentElement?.querySelector('[id*="trend"]');
    if (trendBlock) {
      trendBlock.addEventListener('timerangechange', (e) => {
        // Time range filtering could be added here if needed
        console.log('[Biodiversity] timerangechange received:', e.detail?.range);
      });
    }
  }
}

// --- Trend Block (IUCN Category Browser) --------------------------------

function _renderIUCN(trendEl, cr, en, vu) {
  const total = cr + en + vu;
  const categories = [
    { ...IUCN_CATEGORIES[0], count: cr },
    { ...IUCN_CATEGORIES[1], count: en },
    { ...IUCN_CATEGORIES[2], count: vu },
  ];

  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.biodiversity.iucnTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Stacked horizontal bar showing proportions
  const barSegments = categories.map(cat =>
    DOMUtils.create('div', {
      style: {
        flex: `${cat.count / total}`,
        height: '24px',
        background: cat.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
        fontWeight: '600',
        color: cat.code === 'VU' ? '#1a1a2e' : '#fff',
      },
      textContent: cat.code,
    })
  );

  trendEl.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'flex',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: 'var(--space-sm)',
      },
    }, barSegments)
  );

  // Category cards
  categories.forEach(cat => {
    const card = DOMUtils.create('div', {
      style: {
        padding: 'var(--space-sm)',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '8px',
        marginBottom: 'var(--space-xs)',
        borderLeft: `4px solid ${cat.color}`,
      },
    }, [
      DOMUtils.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: '0.25rem' },
      }, [
        DOMUtils.create('div', {
          style: {
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: cat.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            fontWeight: '700',
            color: cat.code === 'VU' ? '#1a1a2e' : '#fff',
            flexShrink: '0',
          },
          textContent: cat.code,
        }),
        DOMUtils.create('span', {
          textContent: i18n.t(cat.labelKey),
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem' },
        }),
        DOMUtils.create('span', {
          textContent: cat.count.toLocaleString() + ' ' + i18n.t('detail.biodiversity.heroUnit'),
          style: { color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: 'auto' },
        }),
      ]),
    ]);

    // Add CR examples for critically endangered
    if (cat.code === 'CR') {
      const lang = i18n.lang || 'de';
      const examples = CR_EXAMPLES[lang] || CR_EXAMPLES.en;
      card.appendChild(
        DOMUtils.create('div', {
          textContent: examples,
          style: {
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            lineHeight: '1.5',
            marginTop: '0.25rem',
            fontStyle: 'italic',
          },
        })
      );
    }

    trendEl.appendChild(card);
  });
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, cr, en, vu) {
  const tileData = [
    {
      label: i18n.t('detail.biodiversity.tileCR'),
      value: cr.toLocaleString(),
      unit: i18n.t('detail.biodiversity.heroUnit'),
    },
    {
      label: i18n.t('detail.biodiversity.tileEN'),
      value: en.toLocaleString(),
      unit: i18n.t('detail.biodiversity.heroUnit'),
    },
    {
      label: i18n.t('detail.biodiversity.tileVU'),
      value: vu.toLocaleString(),
      unit: i18n.t('detail.biodiversity.heroUnit'),
    },
    {
      label: i18n.t('detail.biodiversity.tileLPI'),
      value: '-73%',
      unit: '1970-2020',
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(explEl) {
  explEl.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('p', {
        textContent: i18n.t('detail.biodiversity.explanation'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.biodiversity.comparison'),
        style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7', marginTop: 'var(--space-sm)' },
      }),
    ])
  );
}

// --- Comparison Block (Choropleth Map) -----------------------------------

async function _renderMap(compEl) {
  // Stepped color function matching maps.js pattern
  function colorFn(value) {
    if (value >= 0.35) return '#d32f2f';     // High threat (red)
    if (value >= 0.25) return '#f57c00';     // Medium-high (orange)
    if (value >= 0.15) return '#fbc02d';     // Medium (yellow)
    if (value >= 0.05) return '#66bb6a';     // Low-medium (light green)
    return '#1b5e20';                         // Low threat (dark green)
  }

  function tooltipFn(iso, val) {
    return `${iso}: Threat index ${(val * 100).toFixed(0)}%`;
  }

  const legendItems = [
    { color: '#d32f2f', label: i18n.t('detail.biodiversity.threatHigh') },
    { color: '#f57c00', label: i18n.t('detail.biodiversity.threatMediumHigh') },
    { color: '#fbc02d', label: i18n.t('detail.biodiversity.threatMedium') },
    { color: '#66bb6a', label: i18n.t('detail.biodiversity.threatLowMedium') },
    { color: '#1b5e20', label: i18n.t('detail.biodiversity.threatLow') },
  ];

  const result = await renderChoropleth(compEl, {
    dataMap: NATURE_SCORE,
    colorFn,
    tooltipFn,
    legendItems,
    title: i18n.t('detail.biodiversity.mapTitle'),
  });

  if (result && result.cleanup) {
    _choroplethCleanup = result.cleanup;
  }
}

// --- Sources Block ------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.biodiversity.sourceGBIF'),
      url: 'https://www.gbif.org/species/search?status=THREATENED',
    },
    {
      label: i18n.t('detail.biodiversity.sourceWWF'),
      url: 'https://www.livingplanetindex.org/',
    },
    {
      label: i18n.t('detail.biodiversity.sourceIUCN'),
      url: 'https://www.iucnredlist.org/',
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
  // LPI chart rendered directly in render() for time range interactivity
  return [];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];

  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  _chartData = null;
  console.log('[Biodiversity] cleanup()');
}
