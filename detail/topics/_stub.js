/* ═══════════════════════════════════════════════════════════
   World.One 1.0 — Stub Topic Module
   Proof-of-concept implementing the full topic module contract.
   Used for end-to-end testing of the detail page shell.
   ═══════════════════════════════════════════════════════════ */

import { i18n } from '../../js/i18n.js';
import { DOMUtils } from '../../js/utils/dom.js';

// ─── Meta (DETAIL-03 contract) ───────────────────────────────

export const meta = {
  id: '_stub',
  titleKey: 'detail.stub.title',
  category: 'environment',
  icon: '',
};

// ─── Render ──────────────────────────────────────────────────

export async function render(blocks) {
  console.log('[StubTopic] render()');

  // Hero block
  blocks.hero.appendChild(
    DOMUtils.create('div', { className: 'stub-hero' }, [
      DOMUtils.create('h1', {
        textContent: 'Stub Topic',
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: 'This is a placeholder topic module for testing the detail page shell. All 7 blocks should be visible below.',
        style: { color: 'var(--text-secondary)' },
      }),
    ])
  );

  // Chart block
  blocks.chart.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: 'Primary Chart',
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: 'Chart placeholder -- real topics will render Chart.js canvases here.',
        style: { color: 'var(--text-secondary)' },
      }),
    ])
  );

  // Trend block
  blocks.trend.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: 'Historical Trend',
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: 'Trend chart placeholder. The time range selector above should be functional.',
        style: { color: 'var(--text-secondary)' },
      }),
    ])
  );

  // Tiles block -- 2x2 grid
  const tileData = [
    { label: 'Value A', value: '42' },
    { label: 'Value B', value: '73' },
    { label: 'Value C', value: '18' },
    { label: 'Value D', value: '95' },
  ];

  const tiles = tileData.map(({ label, value }) =>
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
    ])
  );

  blocks.tiles.appendChild(
    DOMUtils.create('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-sm)',
      },
    }, tiles)
  );

  // Explanation block
  blocks.explanation.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: 'Explanation',
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: 'A real topic module would provide detailed explanations of the data shown above, including methodology notes, historical context, and key takeaways for the reader.',
        style: { color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: 'Each topic module renders into the same 7-block layout, but with completely different content. This ensures a consistent user experience while allowing each topic to tell its own data story.',
        style: { color: 'var(--text-secondary)' },
      }),
    ])
  );

  // Comparison block
  blocks.comparison.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h2', {
        textContent: 'Comparison',
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('p', {
        textContent: 'Cross-topic comparison placeholder. Real topics will show how this indicator relates to others in the same category or across categories.',
        style: { color: 'var(--text-secondary)' },
      }),
    ])
  );

  // Sources block
  const sourceItems = ['NASA GISTEMP', 'NOAA GML', 'World Bank API'].map(src =>
    DOMUtils.create('li', {
      textContent: src,
      style: { color: 'var(--text-secondary)', marginBottom: '0.25rem' },
    })
  );

  blocks.sources.appendChild(
    DOMUtils.create('div', {}, [
      DOMUtils.create('h3', {
        textContent: 'Sources',
        style: { color: 'var(--text-primary)', margin: '0 0 var(--space-sm)' },
      }),
      DOMUtils.create('ul', {
        style: { paddingLeft: '1.25rem', margin: '0' },
      }, sourceItems),
    ])
  );
}

// ─── Chart Configs ───────────────────────────────────────────

export function getChartConfigs() {
  // Stub returns empty -- real topics will return chart configurations
  return [];
}

// ─── Cleanup ─────────────────────────────────────────────────

export function cleanup() {
  console.log('[StubTopic] cleanup()');
}
