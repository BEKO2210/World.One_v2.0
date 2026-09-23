/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Scrollytelling „Klima in drei Schritten“
   Grafik bleibt stehen (sticky), Textschritte ziehen vorbei:
   1 Wärmestreifen · 2 CO₂-Anstieg · 3 Temperatur mit 1,5-°C-Schwelle.
   Alle Zahlen im Text werden aus den Reihen berechnet.
   ═══════════════════════════════════════════════════════════ */

import { Charts } from './charts.js';
import { i18n } from '../i18n.js';
import { fmtNumber } from '../utils/fmt.js';
import { cssVar } from '../utils/chart-manager.js';

let _observer = null;

// Vorindustrielles Referenzmittel: 1880–1900 (übliche Näherung bei GISTEMP)
function preindustrialMean(temp) {
  const pre = temp.filter(d => d.year >= 1880 && d.year <= 1900);
  return pre.length ? pre.reduce((s, d) => s + d.value, 0) / pre.length : null;
}

/**
 * @param {HTMLElement} root - .story-Container
 * @param {Object} env - world-state.environment
 */
export function initClimateStory(root, env) {
  const temp = env?.temperatureAnomaly?.history || [];
  const co2 = env?.co2?.history || [];
  if (!root || temp.length < 30 || co2.length < 10) {
    if (root) root.hidden = true;
    return;
  }

  const layers = root.querySelectorAll('.story__layer');
  const steps = root.querySelectorAll('.story__step');
  const lastT = temp[temp.length - 1];
  const firstC = co2[0];
  const lastC = co2[co2.length - 1];
  const pre = preindustrialMean(temp);
  const threshold = pre != null ? pre + 1.5 : null;
  const aboveNow = pre != null ? lastT.value - pre : null;
  const maxYear = temp.reduce((m, d) => (d.value > m.value ? d : m), temp[0]);
  const lastCool = [...temp].reverse().find(d => d.value < 0);

  // Texte (Zahlen aus den Daten)
  const t = (key, p) => i18n.t(key, p);
  root.querySelector('[data-story-text="0"]').textContent = t('story.climate.step1', {
    first: temp[0].year, last: lastT.year, lastCool: lastCool ? lastCool.year : temp[0].year,
  });
  root.querySelector('[data-story-text="1"]').textContent = t('story.climate.step2', {
    firstYear: firstC.year, first: fmtNumber(firstC.value, { decimals: 1 }),
    lastYear: lastC.year, last: fmtNumber(lastC.value, { decimals: 1 }),
    pct: fmtNumber((lastC.value / firstC.value - 1) * 100, { decimals: 0 }),
  });
  const crossed = temp.filter(d => threshold != null && d.value >= threshold).map(d => d.year);
  root.querySelector('[data-story-text="2"]').textContent = t(crossed.length ? 'story.climate.step3crossed' : 'story.climate.step3', {
    year: lastT.year,
    anomaly: fmtNumber(lastT.value, { decimals: 2, sign: true }),
    above: fmtNumber(aboveNow, { decimals: 2 }),
    maxYear: maxYear.year,
    crossedYears: crossed.join(', '),
  });

  // Grafik-Ebenen
  Charts.warmingStripes(layers[0].querySelector('.story__stripes'), temp);
  Charts.lineChart(layers[1], co2, {
    color: cssVar('--series-2'), unit: 'ppm', yLabel: 'ppm', height: (layers[1].clientHeight || 340) - 40,
    source: `${t('badge.sourceLabel')}: NOAA Mauna Loa`,
  });
  Charts.lineChart(layers[2], temp, {
    color: cssVar('--series-8'), unit: '°C', yLabel: t('story.climate.axisTemp'), height: (layers[2].clientHeight || 340) - 40,
    refLine: threshold != null ? { value: threshold, label: t('story.climate.threshold') } : null,
    source: `${t('badge.sourceLabel')}: NASA GISTEMP v4 · ${t('story.climate.baseNote')}`,
  });

  // Aktiver Schritt → passende Ebene einblenden
  const activate = (i) => {
    layers.forEach((l, k) => l.classList.toggle('is-active', k === i));
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  };
  activate(0);
  _observer?.disconnect();
  _observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) activate(Number(e.target.dataset.step)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => _observer.observe(s));
}
