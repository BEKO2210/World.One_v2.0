/* ===================================================================
   World.One 2.0 -- Ocean Plastic Topic Module (OCEAN-03)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: GESAMP, UNEP 2023, Jambeck et al. 2015 (all hardcoded)
   Visualizations: Animated Daily Counter (DOM), 5 Garbage Patches
                   SVG Map (SVG), Decomposition Time Bars (DOM)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { createMarkerMap } from '../utils/marker-map.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'ocean_plastic',
  titleKey: 'detail.ocean_plastic.title',
  category: 'ocean',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _cacheData = null;

// --- Plastic Statistics (GESAMP, UNEP 2023) ----------------------------

const PLASTIC_STATS = {
  total_mt: 170,           // million tonnes in ocean
  annual_input_mt: 11,     // million tonnes per year
  daily_input_kg: 23_000_000, // kg per day
};

// --- Five Major Garbage Patches ----------------------------------------
// cx/cy are SVG coordinates in a 1000x500 viewBox

const GARBAGE_PATCHES = [
  { name: 'North Pacific Gyre',    cx: 340, cy: 170, size: 1600000, color: '#ff3b30' },
  { name: 'South Pacific Gyre',    cx: 280, cy: 310, size: 2600000, color: '#ff6b6b' },
  { name: 'North Atlantic Gyre',   cx: 550, cy: 180, size: 1100000, color: '#ff9500' },
  { name: 'South Atlantic Gyre',   cx: 530, cy: 330, size: 700000,  color: '#ffcc00' },
  { name: 'Indian Ocean Gyre',     cx: 700, cy: 300, size: 900000,  color: '#ff6348' },
];

// --- Decomposition Times (NOAA Marine Debris Program) ------------------

const DECOMPOSITION_TIMES = [
  { item: 'Plastic bag',     years: 20,  color: '#fbc02d' },
  { item: 'Styrofoam cup',   years: 50,  color: '#ff9800' },
  { item: 'Aluminum can',    years: 200, color: '#ff6d00' },
  { item: 'Plastic bottle',  years: 450, color: '#f44336' },
  { item: 'Fishing line',    years: 600, color: '#b71c1c' },
];

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // Attempt fetch for potential future cache support
  const { data, tier, age } = await fetchTopicData('ocean');
  _cacheData = data;

  // 1. Hero block
  _renderHero(blocks.hero, tier, age);

  // 2. Chart block -- animated daily counter
  _renderCounter(blocks.chart);

  // 3. Trend block -- garbage patches SVG map
  await _renderGarbagePatches(blocks.trend);

  // 4. Tiles block -- decomposition time bars
  _renderDecomposition(blocks.tiles);

  // 5. Explanation block
  _renderExplanation(blocks.explanation);

  // 6. Comparison block -- scale comparison stats
  _renderComparison(blocks.comparison);

  // 7. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, tier, age) {
  const badge = createTierBadge('static', { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'ocean-plastic-hero' }, [
      DOMUtils.create('div', {
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: '#ff9500',
          marginBottom: 'var(--space-xs)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: '~170',
        }),
        DOMUtils.create('span', {
          textContent: ' Mio t',
          style: { fontSize: '1.5rem', fontWeight: '400' },
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
          textContent: i18n.t('detail.ocean_plastic.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.ocean_plastic.heroExplain'),
        style: { color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 var(--space-xs)' },
      }),
      DOMUtils.create('p', {
        textContent: `+${PLASTIC_STATS.annual_input_mt} Mio t / year (UNEP 2023)`,
        style: { color: '#ff9500', fontSize: '0.85rem', fontWeight: '600', margin: '0' },
      }),
    ])
  );
}

// --- Chart Block (Animated Daily Counter) --------------------------------

function _renderCounter(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_plastic.counterTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const counterEl = DOMUtils.create('div', {
    style: {
      fontSize: '3rem',
      fontWeight: '700',
      color: '#ff9500',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: '1.2',
      textAlign: 'center',
      padding: 'var(--space-lg) 0',
    },
    textContent: '0 kg',
  });

  const labelEl = DOMUtils.create('div', {
    textContent: 'heute / today',
    style: {
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: '1rem',
      marginBottom: 'var(--space-xs)',
    },
  });

  const descEl = DOMUtils.create('p', {
    textContent: `${PLASTIC_STATS.daily_input_kg.toLocaleString()} kg of plastic enter the ocean every day.`,
    style: {
      textAlign: 'center',
      color: 'var(--text-tertiary)',
      fontSize: '0.8rem',
      margin: '0',
    },
  });

  const wrapper = DOMUtils.create('div', {
    style: {
      background: 'var(--card-bg, rgba(255,255,255,0.05))',
      borderRadius: '16px',
      padding: 'var(--space-md)',
    },
  }, [counterEl, labelEl, descEl]);

  chartEl.appendChild(wrapper);

  // Start ticking counter -- pattern from population.js
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dailyRate = PLASTIC_STATS.daily_input_kg;

  const update = () => {
    const elapsed = (Date.now() - startOfDay.getTime()) / 86_400_000;
    counterEl.textContent = Math.floor(dailyRate * elapsed).toLocaleString() + ' kg';
  };
  update();

  const intervalId = setInterval(update, 1000);
  _intervals.push(intervalId);
}

// --- Trend Block (Garbage Patches SVG Map) -------------------------------

async function _renderGarbagePatches(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_plastic.patchesTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const map = await createMarkerMap({ background: 'rgba(10,30,60,0.4)' });

  if (!map) {
    trendEl.appendChild(
      DOMUtils.create('p', {
        textContent: 'Map unavailable',
        style: { color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' },
      })
    );
    return;
  }

  const { wrapper, overlay, svgWidth, svgHeight } = map;

  // Add pulsing animation via defs
  const defs = DOMUtils.createSVG('defs', {});
  const style = DOMUtils.createSVG('style', {});
  style.textContent = `
    @keyframes pulse-patch {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.9; }
    }
    .patch-circle { animation: pulse-patch 3s ease-in-out infinite; }
  `;
  defs.appendChild(style);
  overlay.appendChild(defs);

  // Scale factors: original cx/cy in 1000x500 space -> new svgWidth x svgHeight
  const scaleX = svgWidth / 1000;
  const scaleY = svgHeight / 500;
  const radiusScale = Math.min(scaleX, scaleY);

  // Draw garbage patches as pulsing circles on the overlay
  GARBAGE_PATCHES.forEach((patch, idx) => {
    const cx = patch.cx * scaleX;
    const cy = patch.cy * scaleY;

    // Log scale radius: log(size) mapped to 15-45px range, then scaled
    const logMin = Math.log(700000);
    const logMax = Math.log(2600000);
    const logVal = Math.log(patch.size);
    const radius = (15 + ((logVal - logMin) / (logMax - logMin)) * 30) * radiusScale;

    // Outer glow
    const glow = DOMUtils.createSVG('circle', {
      cx: String(cx), cy: String(cy), r: String(radius + 8 * radiusScale),
      fill: 'none',
      stroke: patch.color,
      'stroke-width': String(2 * radiusScale),
      opacity: '0.3',
      class: 'patch-circle',
      style: `animation-delay:${idx * 0.6}s; pointer-events:auto;`,
    });
    overlay.appendChild(glow);

    // Main circle
    const circle = DOMUtils.createSVG('circle', {
      cx: String(cx), cy: String(cy), r: String(radius),
      fill: patch.color,
      opacity: '0.5',
      class: 'patch-circle',
      style: `animation-delay:${idx * 0.6}s; pointer-events:auto;`,
    });
    overlay.appendChild(circle);

    // Label text
    const text = DOMUtils.createSVG('text', {
      x: String(cx), y: String(cy + radius + 16 * radiusScale),
      'text-anchor': 'middle',
      fill: 'rgba(255,255,255,0.8)',
      'font-size': String(11 * radiusScale),
      'font-family': 'system-ui, sans-serif',
    });
    text.textContent = patch.name;
    overlay.appendChild(text);

    // Size label
    const sizeText = DOMUtils.createSVG('text', {
      x: String(cx), y: String(cy + radius + 28 * radiusScale),
      'text-anchor': 'middle',
      fill: 'rgba(255,255,255,0.5)',
      'font-size': String(9 * radiusScale),
      'font-family': 'system-ui, sans-serif',
    });
    sizeText.textContent = `~${(patch.size / 1_000_000).toFixed(1)}M km\u00B2`;
    overlay.appendChild(sizeText);
  });

  trendEl.appendChild(wrapper);
}

// --- Tiles Block (Decomposition Time Bars) -------------------------------

function _renderDecomposition(tilesEl) {
  tilesEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.ocean_plastic.decompTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const maxYears = 600;

  const bars = DECOMPOSITION_TIMES.map(item => {
    // Log scale width: log(years) / log(maxYears) * 100
    const widthPercent = (Math.log(item.years) / Math.log(maxYears)) * 100;

    return DOMUtils.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px',
        gap: 'var(--space-sm)',
      },
    }, [
      DOMUtils.create('div', {
        textContent: item.item,
        style: {
          width: '120px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          flexShrink: '0',
          textAlign: 'right',
        },
      }),
      DOMUtils.create('div', {
        style: {
          flex: '1',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
        },
      }, [
        DOMUtils.create('div', {
          style: {
            width: `${widthPercent}%`,
            minWidth: '30px',
            height: '100%',
            background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
            borderRadius: '4px',
            transition: 'width 1s ease-out',
          },
        }),
      ]),
      DOMUtils.create('div', {
        textContent: `${item.years} years`,
        style: {
          width: '80px',
          fontSize: '0.85rem',
          fontWeight: '600',
          color: item.color,
          flexShrink: '0',
        },
      }),
    ]);
  });

  const container = DOMUtils.create('div', {
    style: {
      background: 'var(--card-bg, rgba(255,255,255,0.05))',
      borderRadius: '12px',
      padding: 'var(--space-md)',
    },
  }, bars);

  tilesEl.appendChild(container);
}

// --- Explanation Block ---------------------------------------------------

function _renderExplanation(expEl) {
  const paragraphs = [
    'About 80% of ocean plastic originates from land-based sources, transported primarily through rivers. The remaining 20% comes from maritime activities including fishing, shipping, and offshore platforms.',
    'Large plastic items break down into microplastics (< 5mm) through UV radiation and wave action, but never fully biodegrade. These microplastics enter the marine food chain from plankton to whales.',
    'By 2050, the ocean could contain more plastic than fish by weight if current trends continue. Reducing single-use plastics and improving waste management in coastal regions are the most effective interventions.',
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

// --- Comparison Block (Scale Comparison Stats) ---------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('h2', {
      textContent: 'The Scale of the Problem',
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const perMinute = Math.round(PLASTIC_STATS.daily_input_kg / 1440);
  const perSecond = Math.round(PLASTIC_STATS.daily_input_kg / 86400);

  const stats = [
    {
      label: 'Every Second',
      value: `~${perSecond.toLocaleString()} kg`,
      desc: 'enter the ocean',
      color: '#fbc02d',
    },
    {
      label: 'Every Minute',
      value: `~${perMinute.toLocaleString()} kg`,
      desc: 'equivalent to a garbage truck',
      color: '#ff9500',
    },
    {
      label: 'Every Year',
      value: `${PLASTIC_STATS.annual_input_mt} Mio t`,
      desc: 'added to the oceans',
      color: '#ff6d00',
    },
    {
      label: 'Total Accumulated',
      value: `~${PLASTIC_STATS.total_mt} Mio t`,
      desc: 'currently in the ocean',
      color: '#f44336',
    },
  ];

  const grid = DOMUtils.create('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 'var(--space-sm)',
    },
  });

  stats.forEach(s => {
    grid.appendChild(
      DOMUtils.create('div', {
        style: {
          background: 'var(--card-bg, rgba(255,255,255,0.05))',
          borderRadius: '12px',
          padding: 'var(--space-md)',
          textAlign: 'center',
        },
      }, [
        DOMUtils.create('div', {
          textContent: s.label,
          style: { color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-xs)' },
        }),
        DOMUtils.create('div', {
          textContent: s.value,
          style: { fontSize: '1.8rem', fontWeight: '700', color: s.color, lineHeight: '1.2' },
        }),
        DOMUtils.create('div', {
          textContent: s.desc,
          style: { color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '4px' },
        }),
      ])
    );
  });

  compEl.appendChild(grid);
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    { label: 'GESAMP (Joint Group of Experts on the Scientific Aspects of Marine Environmental Protection)', url: 'http://www.gesamp.org/' },
    { label: 'UNEP 2023 Report', url: 'https://www.unep.org/resources/pollution-solution-global-assessment-marine-litter-and-plastic-pollution' },
    { label: 'Jambeck et al. 2015 (Science)', url: 'https://doi.org/10.1126/science.1260352' },
    { label: 'NOAA Marine Debris Program', url: 'https://marinedebris.noaa.gov/' },
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
          color: 'rgba(0, 180, 216, 0.9)',
          textDecoration: 'none',
          borderBottom: '1px solid rgba(0, 180, 216, 0.3)',
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
  // No Chart.js used -- all DOM/SVG visualizations
  return [];
}

// --- Cleanup -------------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _cacheData = null;
  console.log('[OceanPlastic] cleanup()');
}
