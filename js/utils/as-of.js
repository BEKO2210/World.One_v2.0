/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Datenstand (dataAsOf + cadence) als Text
   ═══════════════════════════════════════════════════════════ */

import { i18n } from '../i18n.js';

/**
 * Beschriftet den Messzeitpunkt eines Werts nach seiner Kadenz:
 * annual → „Jahreswert 2024“, monthly → „Monatswert Aug. 2026“,
 * daily → „Tageswert 21.09.2026“. realtime/unbekannt → null (dann
 * zeigt der Aufrufer das Abrufalter).
 *
 * @param {number|string|null} dataAsOf - Jahr, "YYYY-MM" oder ISO-Datum
 * @param {'realtime'|'daily'|'monthly'|'annual'|null} cadence
 * @returns {string|null}
 */
export function formatAsOf(dataAsOf, cadence) {
  if (dataAsOf == null || !cadence || cadence === 'realtime') return null;
  const locale = i18n.lang === 'en' ? 'en-GB' : 'de-DE';
  const str = String(dataAsOf);

  if (cadence === 'annual') {
    const year = str.slice(0, 4);
    return /^\d{4}$/.test(year) ? i18n.t('badge.annual', { year }) : null;
  }

  const m = str.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));

  if (cadence === 'monthly') {
    const label = date.toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return i18n.t('badge.monthly', { date: label });
  }
  if (cadence === 'daily' && m[3]) {
    const label = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    return i18n.t('badge.daily', { date: label });
  }
  return null;
}
