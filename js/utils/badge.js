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
 * @param {number|null} [options.age=null] - Cache age in milliseconds.
 * @param {number|string|null} [options.year=null] - Reference year (static tier).
 * @param {string|null} [options.source=null] - Human-readable data source
 *   (appears in the hover tooltip: "Quelle: X · aktualisiert vor Yh").
 * @returns {HTMLSpanElement} The badge element.
 */
export function createTierBadge(tier, options = {}) {
  const { age = null, year = null, source = null } = options;

  const STALE_THRESHOLD = 86400000; // 24 hours in ms
  const isStale = tier === 'cache' && age !== null && age > STALE_THRESHOLD;
  const normalizedTier = ['live', 'cache', 'static'].includes(tier) ? tier : 'static';

  // ─── CSS variant class ───
  const variantMap = {
    live: 'data-badge--live',
    cache: isStale ? 'data-badge--stale' : 'data-badge--cache',
    static: 'data-badge--static',
  };
  const variant = variantMap[normalizedTier];

  // ─── Label text via i18n ───
  const label = i18n.t(`badge.${normalizedTier}`);

  // ─── Build children ───
  const children = [];

  // Live tier gets a pulsing dot
  if (normalizedTier === 'live') {
    children.push(DOMUtils.create('span', { className: 'data-badge__dot' }));
  }

  // Label text node
  children.push(label);

  // Static tier appends reference year
  if (normalizedTier === 'static' && year != null) {
    children.push(` ${year}`);
  }

  // ─── Visible age suffix (Run 9 follow-up) ───
  // "Cache soll dahinter immer in klein die Zeit haben wann es geCache
  // wurde" — user-requested. Für cache-Tier und live-mit-Alter wird
  // die Aktualisierungs-Zeit als kleiner span direkt im Badge angezeigt
  // (vorher nur im title-tooltip).
  if (normalizedTier === 'cache' && age !== null && Number.isFinite(age)) {
    const hours = age / 3600000;
    const mins = Math.round(age / 60000);
    const ageLabel = mins < 2
      ? i18n.t('badge.ageJustNow')
      : mins < 60
        ? i18n.t('badge.ageMinutes', { n: mins })
        : hours < 24
          ? i18n.t('badge.ageHours', { n: Math.round(hours) })
          : i18n.t('badge.ageDays', { n: Math.round(hours / 24) });
    children.push(DOMUtils.create('span', {
      className: 'data-badge__age',
      textContent: ' · ' + ageLabel
    }));
  }

  // ─── Tooltip (Schritt 6): always informative ───
  // Shows "Quelle: X" for live/cache when source is provided,
  // "aktualisiert vor Xh/Xd" for cache tiers,
  // "Stale warning" when cache is >24h, and static fallback note.
  const tooltipParts = [];
  if (source) tooltipParts.push(`${i18n.t('badge.sourceLabel')}: ${source}`);
  if (normalizedTier === 'live') {
    tooltipParts.push(i18n.t('badge.liveLabel'));
  } else if (normalizedTier === 'cache' && age !== null) {
    const hours = age / 3600000;
    const mins = Math.round(age / 60000);
    const ageLabel = mins < 2
      ? i18n.t('badge.ageJustNow')
      : mins < 60
        ? i18n.t('badge.ageMinutes', { n: mins })
        : hours < 24
          ? i18n.t('badge.ageHours', { n: Math.round(hours) })
          : i18n.t('badge.ageDays', { n: Math.round(hours / 24) });
    tooltipParts.push(ageLabel);
  } else if (normalizedTier === 'static') {
    tooltipParts.push(i18n.t('badge.staticNote'));
  }
  if (isStale) tooltipParts.push(i18n.t('badge.staleWarning'));

  // ─── Badge attributes ───
  const attrs = {
    className: `data-badge ${variant}`,
    'aria-label': [label, ...tooltipParts].join(' — '),
  };
  if (tooltipParts.length > 0) {
    attrs.title = tooltipParts.join(' · ');
  }

  return DOMUtils.create('span', attrs, children);
}
