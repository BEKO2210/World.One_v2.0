/* ===================================================================
   World.One 2.0 -- Reusable SVG Marker Map Component
   Renders world.svg base map with an overlay for geo-positioned markers.
   =================================================================== */

import { DOMUtils } from '../../js/utils/dom.js';

/**
 * Create a world map with an SVG overlay for markers.
 * @param {Object} [options]
 * @param {string} [options.background] - wrapper background color
 * @returns {Promise<{wrapper: HTMLElement, overlay: SVGElement, geoToXY: Function, svgWidth: number, svgHeight: number}|null>}
 */
export async function createMarkerMap(options = {}) {
  const { background = 'rgba(255,255,255,0.02)' } = options;

  const basePath = window.location.pathname.includes('/detail') ? '../' : '';
  let svgText = null;
  try {
    const response = await fetch(`${basePath}assets/maps/world.svg`);
    if (response.ok) svgText = await response.text();
  } catch (_) { /* fallback below */ }

  if (!svgText) return null;

  // Parse the SVG to get actual viewBox dimensions
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = svgDoc.querySelector('svg');
  const vb = svgEl.getAttribute('viewBox').split(/\s+/).map(Number);
  const svgWidth = vb[2];   // 2000
  const svgHeight = vb[3];  // 857

  // Wrapper
  const wrapper = DOMUtils.create('div', {
    style: {
      position: 'relative',
      width: '100%',
      borderRadius: '12px',
      overflow: 'hidden',
      background,
      border: '1px solid rgba(255,255,255,0.06)',
    },
  });

  // Inject world.svg as base
  wrapper.innerHTML = svgText;
  const baseSvg = wrapper.querySelector('svg');
  if (baseSvg) {
    baseSvg.style.width = '100%';
    baseSvg.style.height = 'auto';
    baseSvg.style.display = 'block';
    baseSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    baseSvg.style.background = 'transparent';
    baseSvg.removeAttribute('fill');
    baseSvg.removeAttribute('stroke');
    baseSvg.removeAttribute('stroke-width');
    baseSvg.removeAttribute('stroke-linecap');
    baseSvg.removeAttribute('stroke-linejoin');

    // Style country paths for dark theme background
    const paths = baseSvg.querySelectorAll('path');
    for (const p of paths) {
      p.style.fill = 'rgba(255,255,255,0.06)';
      p.style.stroke = 'rgba(255,255,255,0.12)';
      p.style.strokeWidth = '0.3';
    }
  }

  // Create transparent SVG overlay for markers, matching the same viewBox
  const overlay = DOMUtils.createSVG('svg', {
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    width: '100%',
    height: '100%',
    style: 'position:absolute; top:0; left:0; pointer-events:none;',
    preserveAspectRatio: 'xMidYMid meet',
  });
  // Allow pointer events on individual markers
  wrapper.appendChild(overlay);

  // Geo coordinate to SVG coordinate mapper
  function geoToXY(lat, lng) {
    const x = ((lng + 180) / 360) * svgWidth;
    const y = ((90 - lat) / 180) * svgHeight;
    return { x, y };
  }

  return { wrapper, overlay, geoToXY, svgWidth, svgHeight };
}
