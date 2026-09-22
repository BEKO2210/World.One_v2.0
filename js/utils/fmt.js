/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Zahlenformat (Intl.NumberFormat, sprachabhängig)
   Eine Stelle für Dezimaltrennzeichen, Tausenderpunkte und
   Kurzformen (Tsd./Mio./Mrd. bzw. K/M/B).
   ═══════════════════════════════════════════════════════════ */

import { i18n } from '../i18n.js';

const _cache = new Map();

function _nf(opts) {
  const locale = i18n.lang === 'en' ? 'en-GB' : 'de-DE';
  const key = locale + JSON.stringify(opts);
  if (!_cache.has(key)) _cache.set(key, new Intl.NumberFormat(locale, opts));
  return _cache.get(key);
}

/**
 * @param {number} value
 * @param {Object} [o]
 * @param {number} [o.decimals] - feste Nachkommastellen
 * @param {number} [o.maxDecimals=1] - höchstens so viele Nachkommastellen
 * @param {boolean} [o.compact=false] - 3,3 Mio. / 3.3M
 * @param {boolean} [o.sign=false] - Vorzeichen auch bei positiven Werten
 * @returns {string} '–' für ungültige Werte
 */
export function fmtNumber(value, o = {}) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return '–';
  const opts = {};
  if (o.decimals != null) {
    opts.minimumFractionDigits = o.decimals;
    opts.maximumFractionDigits = o.decimals;
  } else {
    opts.maximumFractionDigits = o.maxDecimals ?? 1;
  }
  if (o.sign) opts.signDisplay = 'exceptZero';
  if (o.compact) {
    // Eigene Kurzformen: Intl-„compact“ kürzt auf Deutsch erst ab Mio.
    const units = i18n.lang === 'en'
      ? [[1e12, ' tn'], [1e9, ' bn'], [1e6, ' m'], [1e3, 'k']]
      : [[1e12, ' Bio.'], [1e9, ' Mrd.'], [1e6, ' Mio.'], [1e3, ' Tsd.']];
    const unit = units.find(([f]) => Math.abs(n) >= f);
    if (unit) return _nf(opts).format(n / unit[0]) + unit[1];
  }
  return _nf(opts).format(n);
}

/** Achsenbeschriftung: ab 10.000 kompakt, sonst passend gerundet. */
export function fmtAxis(value) {
  const a = Math.abs(value);
  if (a >= 1e4) return fmtNumber(value, { compact: true, maxDecimals: 1 });
  return fmtNumber(value, { maxDecimals: a >= 100 ? 0 : 1 });
}
