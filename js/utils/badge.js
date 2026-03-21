/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Data Tier Badge Renderer
   ═══════════════════════════════════════════════════════════ */

import { DOMUtils } from './dom.js';
import { i18n } from '../i18n.js';

/**
 * Creates a badge DOM element indicating which data tier served a result.
 *
 * @param {'live'|'cache'|'static'} tier - The data source tier.
 * @param {Object} [options={}] - Badge options.
 * @param {number|null} [options.age=null] - Cache age in milliseconds (cache tier only).
 * @param {number|string|null} [options.year=null] - Reference year (static tier only).
 * @returns {HTMLSpanElement} The badge element.
 */
export function createTierBadge(tier, options = {}) {
  const { age = null, year = null } = options;

  const STALE_THRESHOLD = 86400000; // 24 hours in ms
  const isStale = tier === 'cache' && age !== null && age > STALE_THRESHOLD;

  // ─── CSS variant class ───
  const variantMap = {
    live: 'data-badge--live',
    cache: isStale ? 'data-badge--stale' : 'data-badge--cache',
    static: 'data-badge--static',
  };
  const variant = variantMap[tier] || 'data-badge--cache';

  // ─── Label text via i18n ───
  const label = i18n.t(`badge.${tier}`);

  // ─── Build children ───
  const children = [];

  // Live tier gets a pulsing dot
  if (tier === 'live') {
    children.push(DOMUtils.create('span', { className: 'data-badge__dot' }));
  }

  // Label text node
  children.push(label);

  // Static tier appends reference year
  if (tier === 'static' && year != null) {
    children.push(` ${year}`);
  }

  // ─── Badge attributes ───
  const attrs = {
    className: `data-badge ${variant}`,
    'aria-label': label,
  };

  // Stale cache gets a title tooltip
  if (isStale) {
    attrs.title = i18n.t('badge.staleWarning');
  }

  return DOMUtils.create('span', attrs, children);
}
