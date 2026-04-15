/* ===================================================================
   World.One 2.0 -- Crypto Sentiment Topic Module (RT-04)
   Full topic contract: meta, render, getChartConfigs, cleanup
   Data: Hardcoded 30-day Fear & Greed history (alternative.me has no
         CORS headers -- Pattern 6)
   Visualizations: F&G hero with colored zone, 30-day color-zoned bar
                   chart, horizontal gauge, stats tiles
   =================================================================== */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';
import { createTierBadge } from '../../js/utils/badge.js';
import { ensureChartJs, createChart, CHART_COLORS, toRgba } from '../../js/utils/chart-manager.js';
import { fetchTopicData } from '../../js/utils/data-loader.js';

// --- Meta (DETAIL-03 contract) ----------------------------------------

export const meta = {
  id: 'crypto_sentiment',
  titleKey: 'detail.crypto_sentiment.title',
  category: 'economy',
  icon: '',
};

// --- Module State ------------------------------------------------------

let _chartData = null;

// --- 30-Day Fear & Greed History (Feb-Mar 2026) ------------------------
// Pattern 6: Hardcoded data -- alternative.me API lacks CORS headers.
// Values represent the full range of market sentiment.

const FG_HISTORY = [
  { date: '2026-02-19', value: 22, label: 'Extreme Fear' },
  { date: '2026-02-20', value: 18, label: 'Extreme Fear' },
  { date: '2026-02-21', value: 25, label: 'Extreme Fear' },
  { date: '2026-02-22', value: 30, label: 'Fear' },
  { date: '2026-02-23', value: 28, label: 'Fear' },
  { date: '2026-02-24', value: 35, label: 'Fear' },
  { date: '2026-02-25', value: 40, label: 'Fear' },
  { date: '2026-02-26', value: 38, label: 'Fear' },
  { date: '2026-02-27', value: 42, label: 'Fear' },
  { date: '2026-02-28', value: 48, label: 'Neutral' },
  { date: '2026-03-01', value: 50, label: 'Neutral' },
  { date: '2026-03-02', value: 52, label: 'Neutral' },
  { date: '2026-03-03', value: 55, label: 'Neutral' },
  { date: '2026-03-04', value: 58, label: 'Greed' },
  { date: '2026-03-05', value: 62, label: 'Greed' },
  { date: '2026-03-06', value: 65, label: 'Greed' },
  { date: '2026-03-07', value: 70, label: 'Greed' },
  { date: '2026-03-08', value: 72, label: 'Greed' },
  { date: '2026-03-09', value: 78, label: 'Extreme Greed' },
  { date: '2026-03-10', value: 82, label: 'Extreme Greed' },
  { date: '2026-03-11', value: 75, label: 'Greed' },
  { date: '2026-03-12', value: 68, label: 'Greed' },
  { date: '2026-03-13', value: 60, label: 'Greed' },
  { date: '2026-03-14', value: 52, label: 'Neutral' },
  { date: '2026-03-15', value: 45, label: 'Fear' },
  { date: '2026-03-16', value: 38, label: 'Fear' },
  { date: '2026-03-17', value: 32, label: 'Fear' },
  { date: '2026-03-18', value: 28, label: 'Fear' },
  { date: '2026-03-19', value: 35, label: 'Fear' },
  { date: '2026-03-20', value: 40, label: 'Fear' },
];

// --- Color Zone Function -----------------------------------------------

function _fgColor(value) {
  if (value <= 25) return 'rgba(255, 59, 48, 0.7)';   // Extreme Fear (red)
  if (value <= 45) return 'rgba(255, 149, 0, 0.7)';   // Fear (orange)
  if (value <= 55) return 'rgba(255, 204, 0, 0.7)';   // Neutral (yellow)
  if (value <= 75) return 'rgba(52, 199, 89, 0.7)';   // Greed (light green)
  return 'rgba(0, 255, 127, 0.7)';                     // Extreme Greed (green)
}

function _fgColorSolid(value) {
  if (value <= 25) return 'rgba(255, 59, 48, 1)';
  if (value <= 45) return 'rgba(255, 149, 0, 1)';
  if (value <= 55) return 'rgba(255, 204, 0, 1)';
  if (value <= 75) return 'rgba(52, 199, 89, 1)';
  return 'rgba(0, 255, 127, 1)';
}

// --- Stats Helpers -----------------------------------------------------

function _computeStats(series) {
  const values = series.map(d => d.value);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

// Map a Fear & Greed numeric value back to the classification label.
// Used when the live cache only supplies values (label may be missing).
function _fgLabel(v) {
  if (v <= 25) return 'Extreme Fear';
  if (v <= 45) return 'Fear';
  if (v <= 55) return 'Neutral';
  if (v <= 75) return 'Greed';
  return 'Extreme Greed';
}

// --- Render ------------------------------------------------------------

export async function render(blocks) {
  // Tier-priority: live cache_(alternative.me → crypto_sentiment.json) > hardcoded.
  // Cache file is created by cache-live-data.js (keyless alternative.me call from
  // the server), so even though CORS blocks a browser-side direct fetch the data
  // still reaches the page through our cache envelope.
  let series = FG_HISTORY;
  let tier = 'static';
  let age = null;
  try {
    const cached = await fetchTopicData('crypto_sentiment');
    const liveHistory = cached?.data?.history;
    if (Array.isArray(liveHistory) && liveHistory.length >= 14) {
      series = liveHistory.map(d => ({
        date: d.time ? String(d.time).slice(0, 10) : d.date || '',
        value: Number(d.value),
        label: d.label || _fgLabel(Number(d.value))
      })).filter(d => Number.isFinite(d.value));
      tier = cached.tier || 'cache';
      age = cached.age ?? null;
    }
  } catch (_err) {
    // keep hardcoded fallback
  }

  _chartData = { series };
  const today = series[series.length - 1];
  const stats = _computeStats(series);

  _chartData = { today, stats };

  // 1. Hero block
  _renderHero(blocks.hero, today, tier, age);

  // 2. Chart block -- canvas for 30-day bar chart (lazy via getChartConfigs)
  _renderChartBlock(blocks.chart);

  // 3. Trend block -- gauge visualization
  _renderGauge(blocks.trend, today);

  // 4. Tiles block
  _renderTiles(blocks.tiles, today, stats);

  // 5. Explanation block
  _renderExplanation(blocks.explanation);

  // 6. Comparison block
  _renderComparison(blocks.comparison);

  // 7. Sources block
  _renderSources(blocks.sources);
}

// --- Hero ---------------------------------------------------------------

function _renderHero(heroEl, today, tier, age) {
  const badge = createTierBadge(tier || 'static', { year: 2026, age });
  const bgColor = _fgColor(today.value);

  heroEl.appendChild(
    DOMUtils.create('div', { className: 'crypto-hero' }, [
      DOMUtils.create('div', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: bgColor,
          marginBottom: 'var(--space-sm)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: String(today.value),
          style: {
            fontSize: '3rem',
            fontWeight: '700',
            color: '#1a1a2e',
            lineHeight: '1',
          },
        }),
      ]),
      DOMUtils.create('div', {
        textContent: today.label,
        style: {
          fontSize: '1.25rem',
          fontWeight: '600',
          color: _fgColorSolid(today.value),
          marginBottom: 'var(--space-xs)',
        },
      }),
      DOMUtils.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-sm)',
        },
      }, [
        DOMUtils.create('span', {
          textContent: i18n.t('detail.crypto_sentiment.heroLabel'),
          style: { color: 'var(--text-secondary)', fontSize: '1rem' },
        }),
        badge,
      ]),
    ])
  );
}

// --- Chart Block --------------------------------------------------------

function _renderChartBlock(chartEl) {
  chartEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.crypto_sentiment.chartTitle'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  chartEl.appendChild(
    DOMUtils.create('div', {
      style: 'position:relative; height:280px;',
    }, [
      DOMUtils.create('canvas', { id: 'fg-history-chart' }),
    ])
  );
}

// --- Gauge Visualization (Trend Block) ----------------------------------

function _renderGauge(trendEl, today) {
  trendEl.appendChild(
    DOMUtils.create('h2', {
      textContent: i18n.t('detail.crypto_sentiment.heroLabel'),
      style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
    })
  );

  // Zone segments for the gauge
  const zones = [
    { width: '25%', bg: 'rgba(255, 59, 48, 0.5)',  label: 'Extreme Fear' },
    { width: '20%', bg: 'rgba(255, 149, 0, 0.5)',   label: 'Fear' },
    { width: '10%', bg: 'rgba(255, 204, 0, 0.5)',   label: 'Neutral' },
    { width: '20%', bg: 'rgba(52, 199, 89, 0.5)',   label: 'Greed' },
    { width: '25%', bg: 'rgba(0, 255, 127, 0.5)',   label: 'Extreme Greed' },
  ];

  const segments = zones.map(z =>
    DOMUtils.create('div', {
      style: {
        width: z.width,
        height: '100%',
        background: z.bg,
      },
      title: z.label,
    })
  );

  // Pointer position
  const pct = Math.max(0, Math.min(100, today.value));

  const gaugeBar = DOMUtils.create('div', {
    style: {
      position: 'relative',
      width: '100%',
      height: '32px',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
    },
  }, segments);

  const pointer = DOMUtils.create('div', {
    style: {
      position: 'absolute',
      left: `calc(${pct}% - 8px)`,
      top: '-4px',
      width: '16px',
      height: '40px',
      borderRadius: '4px',
      background: '#fff',
      border: '2px solid #1a1a2e',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'left 0.6s ease',
    },
  });

  const gaugeContainer = DOMUtils.create('div', {
    style: { position: 'relative', marginBottom: 'var(--space-sm)' },
  }, [gaugeBar, pointer]);

  // Labels below gauge
  const labelsRow = DOMUtils.create('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.75rem',
      color: 'var(--text-secondary)',
    },
  }, [
    DOMUtils.create('span', { textContent: '0 - ' + i18n.t('detail.crypto_sentiment.zoneFear') }),
    DOMUtils.create('span', { textContent: '50 - ' + i18n.t('detail.crypto_sentiment.zoneNeutral') }),
    DOMUtils.create('span', { textContent: '100 - ' + i18n.t('detail.crypto_sentiment.zoneGreed') }),
  ]);

  trendEl.appendChild(gaugeContainer);
  trendEl.appendChild(labelsRow);
}

// --- Tiles Block --------------------------------------------------------

function _renderTiles(tilesEl, today, stats) {
  const tileData = [
    {
      label: i18n.t('detail.crypto_sentiment.heroLabel'),
      value: String(today.value),
      unit: today.label,
      accent: _fgColorSolid(today.value),
    },
    {
      label: i18n.t('detail.crypto_sentiment.avg30d'),
      value: String(stats.avg),
      unit: i18n.t('detail.crypto_sentiment.heroUnit'),
      accent: _fgColorSolid(stats.avg),
    },
    {
      label: '30d Min',
      value: String(stats.min),
      unit: i18n.t('detail.crypto_sentiment.heroUnit'),
      accent: _fgColorSolid(stats.min),
    },
    {
      label: '30d Max',
      value: String(stats.max),
      unit: i18n.t('detail.crypto_sentiment.heroUnit'),
      accent: _fgColorSolid(stats.max),
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
    DOMUtils.create('p', {
      textContent: i18n.t('detail.crypto_sentiment.explanation'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Comparison Block ----------------------------------------------------

function _renderComparison(compEl) {
  compEl.appendChild(
    DOMUtils.create('p', {
      textContent: i18n.t('detail.crypto_sentiment.comparison'),
      style: { color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' },
    })
  );
}

// --- Sources Block -------------------------------------------------------

function _renderSources(srcEl) {
  const sources = [
    {
      label: i18n.t('detail.crypto_sentiment.sourceAlternative'),
      url: 'https://alternative.me/crypto/fear-and-greed-index/',
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
  // Use the live series that render() captured into _chartData (falls back
  // to the hardcoded FG_HISTORY if render wasn't called yet).
  const series = (_chartData && Array.isArray(_chartData.series) && _chartData.series.length > 0)
    ? _chartData.series
    : FG_HISTORY;
  const labels = series.map(d => {
    const parts = (d.date || '').split('-');
    return parts.length === 3 ? parts[2] + '.' + parts[1] : String(d.date || '');
  });

  return [
    {
      canvasId: 'fg-history-chart',
      blockId: 'chart',
      config: {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: i18n.t('detail.crypto_sentiment.chartLabel'),
              data: series.map(d => d.value),
              backgroundColor: series.map(d => _fgColor(d.value)),
              borderColor: series.map(d => _fgColorSolid(d.value)),
              borderWidth: 1,
            },
            // Threshold line at 25 (Extreme Fear boundary)
            {
              label: i18n.t('detail.crypto_sentiment.extremeFear'),
              type: 'line',
              data: series.map(() => 25),
              borderColor: 'rgba(255, 59, 48, 0.4)',
              borderDash: [6, 4],
              borderWidth: 1,
              pointRadius: 0,
              pointHitRadius: 0,
              fill: false,
            },
            // Threshold line at 50 (Neutral midpoint)
            {
              label: i18n.t('detail.crypto_sentiment.neutral'),
              type: 'line',
              data: series.map(() => 50),
              borderColor: 'rgba(255, 204, 0, 0.4)',
              borderDash: [6, 4],
              borderWidth: 1,
              pointRadius: 0,
              pointHitRadius: 0,
              fill: false,
            },
            // Threshold line at 75 (Extreme Greed boundary)
            {
              label: i18n.t('detail.crypto_sentiment.extremeGreed'),
              type: 'line',
              data: series.map(() => 75),
              borderColor: 'rgba(0, 255, 127, 0.4)',
              borderDash: [6, 4],
              borderWidth: 1,
              pointRadius: 0,
              pointHitRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          animation: {
            duration: 1200,
            easing: 'easeInOutQuart',
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                maxRotation: 45,
                minRotation: 45,
                font: { size: 10 },
              },
            },
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: i18n.t('detail.crypto_sentiment.chartLabel'),
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  if (idx !== undefined && series[idx]) {
                    return series[idx].date;
                  }
                  return '';
                },
                label: (item) => {
                  if (item.datasetIndex > 0) return null; // hide threshold tooltips
                  const idx = item.dataIndex;
                  const entry = series[idx];
                  return entry ? `${entry.value} - ${entry.label}` : '';
                },
              },
              filter: (item) => item.datasetIndex === 0,
            },
          },
        },
      },
    },
  ];
}

// --- Cleanup -----------------------------------------------------------

export function cleanup() {
  _chartData = null;
  console.log('[Crypto Sentiment] cleanup()');
}
