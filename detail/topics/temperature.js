/* ===================================================================
   World.One 2.0 -- Temperature Topic Module (ENV-02)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: NASA GISTEMP v4, Berkeley Earth, IPCC AR6
   Visualizations: Warming Stripes (DOM), Regional Choropleth (SVG),
                   Tipping Points Timeline (DOM)
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { MathUtils } from '../../js/utils/math.js';
import { fetchTopicData, fetchWithTimeout } from '../../js/utils/data-loader.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { renderChoropleth } from '../utils/choropleth.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'temperature',
  titleKey: 'detail.temperature.title',
  category: 'environment',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _intervals = [];
let _chartData = null;
let _allAnomalies = null;
let _tooltipEl = null;
let _choroplethCleanup = null;

// --- NASA GISTEMP v4 Annual Mean Global Anomalies (1880-2024) ----------
// Source: NASA GISTEMP v4, base period 1951-1980
// Do NOT attempt browser-side NASA CSV fetch (Research Pattern 6)

const ANNUAL_ANOMALIES = [
  { year: 1880, value: -0.16 }, { year: 1881, value: -0.07 }, { year: 1882, value: -0.10 },
  { year: 1883, value: -0.16 }, { year: 1884, value: -0.27 }, { year: 1885, value: -0.33 },
  { year: 1886, value: -0.31 }, { year: 1887, value: -0.36 }, { year: 1888, value: -0.17 },
  { year: 1889, value: -0.10 }, { year: 1890, value: -0.35 }, { year: 1891, value: -0.22 },
  { year: 1892, value: -0.27 }, { year: 1893, value: -0.31 }, { year: 1894, value: -0.32 },
  { year: 1895, value: -0.22 }, { year: 1896, value: -0.09 }, { year: 1897, value: -0.12 },
  { year: 1898, value: -0.26 }, { year: 1899, value: -0.16 }, { year: 1900, value: -0.07 },
  { year: 1901, value: -0.15 }, { year: 1902, value: -0.26 }, { year: 1903, value: -0.37 },
  { year: 1904, value: -0.46 }, { year: 1905, value: -0.28 }, { year: 1906, value: -0.21 },
  { year: 1907, value: -0.39 }, { year: 1908, value: -0.43 }, { year: 1909, value: -0.44 },
  { year: 1910, value: -0.41 }, { year: 1911, value: -0.43 }, { year: 1912, value: -0.34 },
  { year: 1913, value: -0.33 }, { year: 1914, value: -0.14 }, { year: 1915, value: -0.07 },
  { year: 1916, value: -0.29 }, { year: 1917, value: -0.31 }, { year: 1918, value: -0.20 },
  { year: 1919, value: -0.20 }, { year: 1920, value: -0.21 }, { year: 1921, value: -0.14 },
  { year: 1922, value: -0.22 }, { year: 1923, value: -0.21 }, { year: 1924, value: -0.24 },
  { year: 1925, value: -0.14 }, { year: 1926, value: -0.06 }, { year: 1927, value: -0.14 },
  { year: 1928, value: -0.17 }, { year: 1929, value: -0.29 }, { year: 1930, value: -0.09 },
  { year: 1931, value: -0.07 }, { year: 1932, value: -0.11 }, { year: 1933, value: -0.24 },
  { year: 1934, value: -0.10 }, { year: 1935, value: -0.14 }, { year: 1936, value: -0.11 },
  { year: 1937, value: -0.01 }, { year: 1938, value: -0.02 }, { year: 1939, value: -0.01 },
  { year: 1940, value: 0.10 }, { year: 1941, value: 0.15 }, { year: 1942, value: 0.09 },
  { year: 1943, value: 0.09 }, { year: 1944, value: 0.20 }, { year: 1945, value: 0.09 },
  { year: 1946, value: -0.07 }, { year: 1947, value: -0.03 }, { year: 1948, value: -0.04 },
  { year: 1949, value: -0.08 }, { year: 1950, value: -0.16 }, { year: 1951, value: -0.01 },
  { year: 1952, value: 0.02 }, { year: 1953, value: 0.08 }, { year: 1954, value: -0.12 },
  { year: 1955, value: -0.14 }, { year: 1956, value: -0.19 }, { year: 1957, value: 0.05 },
  { year: 1958, value: 0.06 }, { year: 1959, value: 0.03 }, { year: 1960, value: 0.02 },
  { year: 1961, value: 0.06 }, { year: 1962, value: 0.03 }, { year: 1963, value: 0.07 },
  { year: 1964, value: -0.20 }, { year: 1965, value: -0.11 }, { year: 1966, value: -0.03 },
  { year: 1967, value: -0.02 }, { year: 1968, value: -0.07 }, { year: 1969, value: 0.06 },
  { year: 1970, value: 0.04 }, { year: 1971, value: -0.09 }, { year: 1972, value: 0.02 },
  { year: 1973, value: 0.16 }, { year: 1974, value: -0.07 }, { year: 1975, value: -0.01 },
  { year: 1976, value: -0.10 }, { year: 1977, value: 0.18 }, { year: 1978, value: 0.07 },
  { year: 1979, value: 0.17 }, { year: 1980, value: 0.26 }, { year: 1981, value: 0.32 },
  { year: 1982, value: 0.14 }, { year: 1983, value: 0.31 }, { year: 1984, value: 0.16 },
  { year: 1985, value: 0.12 }, { year: 1986, value: 0.18 }, { year: 1987, value: 0.33 },
  { year: 1988, value: 0.39 }, { year: 1989, value: 0.27 }, { year: 1990, value: 0.45 },
  { year: 1991, value: 0.41 }, { year: 1992, value: 0.22 }, { year: 1993, value: 0.24 },
  { year: 1994, value: 0.31 }, { year: 1995, value: 0.45 }, { year: 1996, value: 0.35 },
  { year: 1997, value: 0.46 }, { year: 1998, value: 0.61 }, { year: 1999, value: 0.40 },
  { year: 2000, value: 0.40 }, { year: 2001, value: 0.54 }, { year: 2002, value: 0.63 },
  { year: 2003, value: 0.62 }, { year: 2004, value: 0.54 }, { year: 2005, value: 0.68 },
  { year: 2006, value: 0.64 }, { year: 2007, value: 0.66 }, { year: 2008, value: 0.54 },
  { year: 2009, value: 0.64 }, { year: 2010, value: 0.72 }, { year: 2011, value: 0.61 },
  { year: 2012, value: 0.65 }, { year: 2013, value: 0.68 }, { year: 2014, value: 0.75 },
  { year: 2015, value: 0.90 }, { year: 2016, value: 1.01 }, { year: 2017, value: 0.92 },
  { year: 2018, value: 0.85 }, { year: 2019, value: 0.98 }, { year: 2020, value: 1.02 },
  { year: 2021, value: 0.85 }, { year: 2022, value: 0.89 }, { year: 2023, value: 1.17 },
  { year: 2024, value: 1.45 },
];

// --- Notable Event Annotations for Warming Stripes --------------------

const STRIPE_EVENTS = {
  1998: 'Strongest El Nino of 20th century',
  2015: 'Paris Agreement signed',
  2016: 'Warmest year at the time',
  2020: 'COVID-19 pandemic, tied warmest',
  2023: 'Record-breaking warmth',
  2024: 'New global record',
};

// --- Climate Tipping Points (IPCC AR6 / Earth Commission) --------------

const TIPPING_POINTS = [
  { threshold: '1.0\u00B0C', name: 'Coral Reef Die-Off', status: 'crossed', detail: 'Tropical coral reefs face mass bleaching at >1.0\u00B0C' },
  { threshold: '1.5\u00B0C', name: 'West Antarctic Ice Sheet', status: 'imminent', detail: 'Irreversible collapse may begin above 1.5\u00B0C' },
  { threshold: '1.5\u00B0C', name: 'Greenland Ice Sheet', status: 'imminent', detail: 'Sustained warming above 1.5\u00B0C triggers long-term melt' },
  { threshold: '1.5\u00B0C', name: 'Boreal Forest Dieback', status: 'imminent', detail: 'Northern forests shift from carbon sink to source' },
  { threshold: '2.0\u00B0C', name: 'Amazon Rainforest Dieback', status: 'risk', detail: 'Combination of warming and deforestation threatens collapse' },
  { threshold: '2.0\u00B0C', name: 'Permafrost Collapse', status: 'risk', detail: 'Thawing releases trapped methane and CO2' },
  { threshold: '3.0\u00B0C', name: 'Atlantic Circulation (AMOC)', status: 'risk', detail: 'Slowdown disrupts European climate and monsoons' },
  { threshold: '4.0\u00B0C', name: 'East Antarctic Ice Sheet', status: 'distant', detail: 'Largest ice mass, potential 50m+ sea level rise' },
  { threshold: '5.0\u00B0C', name: 'Arctic Winter Sea Ice', status: 'distant', detail: 'Complete loss of winter ice cover' },
];

// --- Regional Warming Data (ISO-2 to anomaly, 2024) --------------------
// Source: NASA GISTEMP regional analysis, Berkeley Earth country-level
// Base period: 1951-1980, values in degrees C

const REGIONAL_WARMING = {
  // Arctic / Northern high latitudes (warming 2-4x global average)
  NO: 2.5, SE: 2.3, FI: 2.8, IS: 2.0, RU: 2.9, CA: 2.4, GL: 3.0,
  // Northern Europe
  GB: 1.3, IE: 1.2, DK: 1.8, DE: 1.7, PL: 1.8, NL: 1.5, BE: 1.5, FR: 1.6,
  AT: 2.0, CH: 2.1, CZ: 1.9, SK: 1.8, HU: 1.7, RO: 1.6, BG: 1.5, GR: 1.4,
  IT: 1.5, ES: 1.6, PT: 1.5, HR: 1.6, RS: 1.6,
  // North America
  US: 1.5, MX: 1.1,
  // Central/South Asia (strong warming)
  KZ: 2.2, UZ: 2.0, TM: 2.0, AF: 1.8, PK: 1.5, IN: 1.2, NP: 1.6, CN: 1.6,
  MN: 2.5, KR: 1.4, JP: 1.3,
  // Middle East (strong warming)
  SA: 1.8, IQ: 1.7, IR: 1.8, SY: 1.6, TR: 1.5, AE: 1.6, YE: 1.3,
  // Africa
  EG: 1.3, LY: 1.4, DZ: 1.3, MA: 1.1, SD: 1.2, ET: 1.0, KE: 0.9,
  NG: 1.0, ZA: 1.1, CD: 0.8, TZ: 0.9, MZ: 0.9,
  // South America
  BR: 1.0, AR: 1.1, CO: 0.8, PE: 0.9, CL: 0.9, VE: 0.8, BO: 0.9,
  // Southeast Asia / Oceania
  ID: 0.9, TH: 1.1, VN: 1.0, PH: 0.9, MM: 1.1, MY: 0.9, AU: 1.4, NZ: 1.0,
  // Eastern Europe / Baltics
  UA: 1.9, BY: 2.1, LT: 2.0, LV: 2.1, EE: 2.2,
};

// --- ISO-2 to country name mapping (for tooltips) ----------------------

const ISO_NAMES = {
  NO: 'Norway', SE: 'Sweden', FI: 'Finland', IS: 'Iceland', RU: 'Russia',
  CA: 'Canada', GL: 'Greenland', GB: 'United Kingdom', IE: 'Ireland',
  DK: 'Denmark', DE: 'Germany', PL: 'Poland', NL: 'Netherlands', BE: 'Belgium',
  FR: 'France', AT: 'Austria', CH: 'Switzerland', CZ: 'Czechia', SK: 'Slovakia',
  HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', GR: 'Greece', IT: 'Italy',
  ES: 'Spain', PT: 'Portugal', HR: 'Croatia', RS: 'Serbia', US: 'United States',
  MX: 'Mexico', KZ: 'Kazakhstan', UZ: 'Uzbekistan', TM: 'Turkmenistan',
  AF: 'Afghanistan', PK: 'Pakistan', IN: 'India', NP: 'Nepal', CN: 'China',
  MN: 'Mongolia', KR: 'South Korea', JP: 'Japan', SA: 'Saudi Arabia',
  IQ: 'Iraq', IR: 'Iran', SY: 'Syria', TR: 'Turkey', AE: 'UAE', YE: 'Yemen',
  EG: 'Egypt', LY: 'Libya', DZ: 'Algeria', MA: 'Morocco', SD: 'Sudan',
  ET: 'Ethiopia', KE: 'Kenya', NG: 'Nigeria', ZA: 'South Africa', CD: 'DR Congo',
  TZ: 'Tanzania', MZ: 'Mozambique', BR: 'Brazil', AR: 'Argentina', CO: 'Colombia',
  PE: 'Peru', CL: 'Chile', VE: 'Venezuela', BO: 'Bolivia', ID: 'Indonesia',
  TH: 'Thailand', VN: 'Vietnam', PH: 'Philippines', MM: 'Myanmar', MY: 'Malaysia',
  AU: 'Australia', NZ: 'New Zealand', UA: 'Ukraine', BY: 'Belarus', LT: 'Lithuania',
  LV: 'Latvia', EE: 'Estonia',
};

// --- Glass-morphism tooltip style (for warming stripes tooltip) ---------

const TOOLTIP_STYLE = {
  position: 'absolute',
  background: 'rgba(18,18,26,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  pointerEvents: 'none',
  zIndex: '1000',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s ease',
};

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // 1. Data fetching -- attempt cache, fallback to hardcoded.
  // Fallback 1.19 matches latest NASA GISTEMP annual anomaly (2025).
  let anomaly = 1.19;
  let tier = 'static';
  let age = null;

  try {
    const result = await fetchTopicData('temperature');
    if (result && result.data && result.data.anomaly) {
      anomaly = result.data.anomaly.value || 1.45;
      tier = result.tier;
      age = result.age;
    }
  } catch (_err) {
    // Use static fallback
  }

  _allAnomalies = ANNUAL_ANOMALIES;

  // 2. Hero block
  _renderHero(blocks.hero, anomaly, tier, age);

  // 3. Chart block -- Warming Stripes
  _renderWarmingStripes(blocks.chart);

  // 4. Trend block -- Tipping Points Timeline
  _renderTippingPoints(blocks.trend);

  // 5. Tiles block
  _renderTiles(blocks.tiles, anomaly);

  // 6. Explanation block
  _renderExplanation(blocks.explanation);

  // 7. Comparison block -- Regional Warming SVG Choropleth
  await _renderChoropleth(blocks.comparison);

  // 8. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, anomaly, tier, age) {
  const tempColor = MathUtils.tempToColor(anomaly);
  const badge = createTierBadge(tier, { age });

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'temp-hero' }, [
      DOMUtils.create('div', {
        className: 'temp-hero__value',
        style: {
          fontSize: '3.5rem',
          fontWeight: '700',
          lineHeight: '1.1',
          color: tempColor,
          marginBottom: 'var(--space-xs)',
        },
      }, [
        `+${anomaly}`,
        DOMUtils.create('span', {
          style: {
            fontSize: '1.5rem',
            fontWeight: '400',
            marginLeft: '0.5rem',
            color: 'var(--text-secondary)',
          },
          textContent: i18n.t('detail.temperature.heroUnit'),
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
          textContent: i18n.t('detail.temperature.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
      DOMUtils.create('div', {
        textContent: i18n.t('detail.temperature.baselinePeriod'),
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: '0.7' },
      }),
    ])
  );
}

// --- Warming Stripes (DOM-based, no Chart.js) ---------------------------

function _renderWarmingStripes(chartEl) {
  const n = ANNUAL_ANOMALIES.length;

  // Heading
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.temperature.stripesTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Instruction text
  chartEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.temperature.clickYear'),
      style: { color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 'var(--space-xs)' },
    })
  );

  // Stripes container
  const stripesContainer = DOMUtils.create('div', {
    className: 'warming-stripes',
    style: {
      display: 'flex',
      height: '200px',
      borderRadius: '8px',
      overflow: 'hidden',
      position: 'relative',
      cursor: 'crosshair',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
    },
  });

  // Create tooltip element
  _tooltipEl = DOMUtils.create('div', {
    className: 'stripes-tooltip',
    style: { ...TOOLTIP_STYLE, opacity: '0', top: '-60px', left: '0' },
  });
  stripesContainer.appendChild(_tooltipEl);

  // Create individual stripes
  for (let i = 0; i < n; i++) {
    const entry = ANNUAL_ANOMALIES[i];
    const color = MathUtils.tempToColor(entry.value);

    const stripe = DOMUtils.create('div', {
      'data-index': String(i),
      style: {
        flex: '1',
        height: '100%',
        background: color,
        transition: 'opacity 0.1s ease',
        minWidth: '1px',
      },
    });

    stripe.addEventListener('mouseenter', (e) => {
      _showStripeTooltip(e, entry, stripe, stripesContainer);
    });

    stripe.addEventListener('mouseleave', () => {
      if (_tooltipEl) _tooltipEl.style.opacity = '0';
    });

    stripe.addEventListener('click', (e) => {
      _showStripeTooltip(e, entry, stripe, stripesContainer);
    });

    stripesContainer.appendChild(stripe);
  }

  chartEl.appendChild(stripesContainer);

  // Year labels below stripes
  const labelRow = DOMUtils.create('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      fontSize: '0.7rem',
      color: 'var(--text-secondary)',
      opacity: '0.6',
    },
  }, [
    DOMUtils.create('span', { textContent: '1880' }),
    DOMUtils.create('span', { textContent: '1920' }),
    DOMUtils.create('span', { textContent: '1960' }),
    DOMUtils.create('span', { textContent: '2000' }),
    DOMUtils.create('span', { textContent: '2024' }),
  ]);
  chartEl.appendChild(labelRow);
}

function _showStripeTooltip(e, entry, stripe, container) {
  if (!_tooltipEl) return;

  const sign = entry.value >= 0 ? '+' : '';
  let text = `${entry.year}: ${sign}${entry.value}\u00B0C`;
  const event = STRIPE_EVENTS[entry.year];
  if (event) {
    text += ` \u2014 ${event}`;
  }
  _tooltipEl.textContent = text;
  _tooltipEl.style.opacity = '1';

  // Position above the stripe
  const containerRect = container.getBoundingClientRect();
  const stripeRect = stripe.getBoundingClientRect();
  const left = stripeRect.left - containerRect.left + stripeRect.width / 2;
  const tooltipWidth = _tooltipEl.offsetWidth || 150;

  _tooltipEl.style.left = Math.max(0, Math.min(left - tooltipWidth / 2, containerRect.width - tooltipWidth)) + 'px';
  _tooltipEl.style.top = '-50px';
}

// --- Tipping Points Timeline (DOM-based) --------------------------------

function _renderTippingPoints(trendEl) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.temperature.tippingTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  const statusColors = {
    crossed: '#ff3b30',
    imminent: '#ff9500',
    risk: '#ffcc00',
    distant: 'rgba(255,255,255,0.3)',
  };

  const statusLabels = {
    crossed: 'Crossed',
    imminent: 'Imminent',
    risk: 'At Risk',
    distant: 'Distant',
  };

  const timeline = DOMUtils.create('div', {
    className: 'tipping-timeline',
    style: {
      position: 'relative',
      paddingLeft: '24px',
    },
  });

  // Vertical gradient line
  const line = DOMUtils.create('div', {
    style: {
      position: 'absolute',
      left: '8px',
      top: '0',
      bottom: '0',
      width: '3px',
      background: 'linear-gradient(to bottom, #34c759, #ffcc00, #ff3b30)',
      borderRadius: '2px',
      opacity: '0.6',
    },
  });
  timeline.appendChild(line);

  // Tipping point cards
  for (const tp of TIPPING_POINTS) {
    const color = statusColors[tp.status];
    const dotStyle = {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: color,
      position: 'absolute',
      left: '-20px',
      top: '14px',
      border: '2px solid rgba(18,18,26,0.8)',
    };

    // Pulsing animation for imminent
    if (tp.status === 'imminent') {
      dotStyle.boxShadow = `0 0 0 0 ${color}`;
      dotStyle.animation = 'tipping-pulse 2s infinite';
    }

    const card = DOMUtils.create('div', {
      style: {
        position: 'relative',
        padding: 'var(--space-xs) var(--space-sm)',
        marginBottom: 'var(--space-xs)',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        border: `1px solid ${color}22`,
        borderLeft: `3px solid ${color}`,
      },
    }, [
      DOMUtils.create('div', { style: dotStyle }),
      DOMUtils.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
      }, [
        DOMUtils.create('span', {
          textContent: tp.threshold,
          style: {
            background: `${color}22`,
            color: color,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: '700',
          },
        }),
        DOMUtils.create('span', {
          textContent: tp.name,
          style: { color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' },
        }),
        DOMUtils.create('span', {
          textContent: statusLabels[tp.status],
          style: {
            color: color,
            fontSize: '0.7rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            marginLeft: 'auto',
          },
        }),
      ]),
      DOMUtils.create('p', {
        textContent: tp.detail,
        style: { color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0', lineHeight: '1.4' },
      }),
    ]);

    timeline.appendChild(card);
  }

  trendEl.appendChild(timeline);

  // Inject pulse animation
  _injectPulseAnimation();

  // Listen for timerangechange (no-op for tipping points)
  trendEl.addEventListener('timerangechange', () => {
    // Tipping points are not time-filterable
  });
}

function _injectPulseAnimation() {
  if (document.getElementById('tipping-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 'tipping-pulse-style';
  style.textContent = `
    @keyframes tipping-pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.5); }
      70% { box-shadow: 0 0 0 6px rgba(255, 149, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
    }
  `;
  document.head.appendChild(style);
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, anomaly) {
  const tileData = [
    {
      label: i18n.t('detail.temperature.tileWarmestYear'),
      value: '2024',
      unit: '',
    },
    {
      label: i18n.t('detail.temperature.tileArcticRate'),
      value: '~4x',
      unit: 'IPCC AR6',
    },
    {
      label: i18n.t('detail.temperature.tileSincePreIndustrial'),
      value: `+${anomaly}`,
      unit: '\u00B0C',
    },
    {
      label: i18n.t('detail.temperature.tileSealevelRise'),
      value: '~20cm',
      unit: 'since 1900',
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
      DOMUtils.create('h2', {
        textContent: i18n.t('detail.temperature.title'),
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.temperature.explanation'),
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', lineHeight: '1.6' },
      }),
      DOMUtils.create('p', {
        textContent: i18n.t('detail.temperature.comparison'),
        style: { color: 'var(--text-secondary)', lineHeight: '1.6' },
      }),
    ])
  );
}

// --- Regional Warming SVG Choropleth (comparison block) ------------------

async function _renderChoropleth(compEl) {
  const { wrapper, cleanup: mapCleanup } = await renderChoropleth(compEl, {
    dataMap: REGIONAL_WARMING,
    colorFn: (value) => MathUtils.tempToColor(value),
    tooltipFn: (iso, value) => {
      const name = ISO_NAMES[iso] || iso;
      const sign = value >= 0 ? '+' : '';
      return `${name}: ${sign}${value}\u00B0C`;
    },
    legendItems: [],  // We use custom gradient legend instead
    title: i18n.t('detail.temperature.choroplethTitle'),
  });

  if (mapCleanup) _choroplethCleanup = mapCleanup;

  // Custom gradient legend (temperature-specific)
  _renderColorLegend(compEl);

  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.temperature.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginTop: 'var(--space-xs)' },
    })
  );
}

function _renderColorLegend(container) {
  // Gradient bar from blue (-0.5) to red (+3.0)
  const steps = 20;
  const minVal = -0.5;
  const maxVal = 3.0;

  const gradientCells = [];
  for (let i = 0; i < steps; i++) {
    const val = minVal + (maxVal - minVal) * (i / (steps - 1));
    gradientCells.push(
      DOMUtils.create('div', {
        style: {
          flex: '1',
          height: '14px',
          background: MathUtils.tempToColor(val),
        },
      })
    );
  }

  const gradientBar = DOMUtils.create('div', {
    style: {
      display: 'flex',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    },
  }, gradientCells);

  const labels = DOMUtils.create('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.7rem',
      color: 'var(--text-secondary)',
      marginTop: '2px',
      opacity: '0.7',
    },
  }, [
    DOMUtils.create('span', { textContent: '-0.5\u00B0C' }),
    DOMUtils.create('span', { textContent: '0\u00B0C' }),
    DOMUtils.create('span', { textContent: '+1.5\u00B0C' }),
    DOMUtils.create('span', { textContent: '+3.0\u00B0C' }),
  ]);

  container.appendChild(
    DOMUtils.create('div', {
      style: { marginTop: 'var(--space-xs)', maxWidth: '400px' },
    }, [gradientBar, labels])
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.temperature.sourceNASA'),
      url: 'https://data.giss.nasa.gov/gistemp/',
    },
    {
      label: i18n.t('detail.temperature.sourceBerkeley'),
      url: 'https://berkeleyearth.org/',
    },
    {
      label: 'IPCC AR6',
      url: 'https://www.ipcc.ch/report/ar6/wg1/',
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

// --- Chart Configs (none -- all DOM-based) --------------------------------

export function getChartConfigs() {
  return [];
}

// --- Cleanup --------------------------------------------------------------

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
  _chartData = null;
  _allAnomalies = null;

  // Remove tooltip elements from DOM
  if (_tooltipEl && _tooltipEl.parentNode) {
    _tooltipEl.parentNode.removeChild(_tooltipEl);
  }
  _tooltipEl = null;

  if (_choroplethCleanup) {
    _choroplethCleanup();
    _choroplethCleanup = null;
  }

  // Remove injected style
  const pulseStyle = document.getElementById('tipping-pulse-style');
  if (pulseStyle) pulseStyle.remove();

  console.log('[Temperature] cleanup()');
}
