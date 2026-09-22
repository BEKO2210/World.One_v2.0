/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Empty State
   Statt leerer Diagrammflächen: kurzer Hinweis, dass für diesen Bereich
   gerade keine Daten vorliegen (Quelle nicht erreichbar oder Reihe leer).
   ═══════════════════════════════════════════════════════════ */

import { DOMUtils } from './dom.js';
import { i18n } from '../i18n.js';

/**
 * @param {Object} [o]
 * @param {string} [o.title] - Überschrift des Bereichs (bleibt sichtbar)
 * @param {string} [o.message] - eigener Text, sonst i18n 'empty.noData'
 * @returns {HTMLElement}
 */
export function createEmptyState({ title = null, message = null } = {}) {
  return DOMUtils.create('div', { className: 'empty-state', role: 'status' }, [
    title ? DOMUtils.create('h2', { className: 'empty-state__title', textContent: title }) : null,
    DOMUtils.create('div', { className: 'empty-state__body' }, [
      DOMUtils.create('span', { className: 'empty-state__icon', 'aria-hidden': 'true', textContent: '∅' }),
      DOMUtils.create('p', { className: 'empty-state__text', textContent: message || i18n.t('empty.noData') }),
    ]),
  ].filter(Boolean));
}
