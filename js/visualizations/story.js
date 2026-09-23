/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Scrollytelling
   Grafik bleibt stehen (sticky), Textschritte ziehen vorbei.
   Klima:   1 Wärmestreifen · 2 CO₂-Anstieg · 3 Temperatur mit 1,5-°C-Schwelle
   Vermögen: 1 Anteil reichstes 1 % · 2 Menschen vs. Vermögen · 3 Einkommen vs. Vermögen
   Flucht:  1 Wer flieht · 2 größte Ströme (Karte) · 3 größte Aufnahmeländer
   Alle Zahlen im Text werden aus den Reihen berechnet.
   ═══════════════════════════════════════════════════════════ */

import { Charts } from './charts.js';
import { i18n } from '../i18n.js';
import { fmtNumber } from '../utils/fmt.js';
import { cssVar } from '../utils/chart-manager.js';
import { projectWorld } from '../utils/geo.js';

const _observers = new Map(); // root → IntersectionObserver
const MOBILE = '(max-width: 800px)';

// Mobil: keine Sticky-Grafik (Karte verdeckte sie, Ebene passte nicht zum
// gelesenen Text), sondern je Schritt Grafik + Text als Einheit.
// Muss vor dem Zeichnen laufen, damit Diagramme ihre Endgröße messen.
function stackOnMobile(root) {
  if (!window.matchMedia(MOBILE).matches || root.classList.contains('story--stacked')) return;
  root.classList.add('story--stacked');
  const layers = root.querySelectorAll('.story__layer');
  root.querySelectorAll('.story__card').forEach((card, i) => {
    if (!layers[i]) return;
    layers[i].setAttribute('aria-hidden', 'true');
    card.prepend(layers[i]);
  });
}

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

  stackOnMobile(root);
  const layers = root.querySelectorAll('.story__layer');
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

  bindSteps(root);
}

// Aktiver Schritt → passende Ebene einblenden
function bindSteps(root) {
  const layers = root.querySelectorAll('.story__layer');
  const steps = root.querySelectorAll('.story__step');
  const activate = (i) => {
    layers.forEach((l, k) => l.classList.toggle('is-active', k === i));
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  };
  _observers.get(root)?.disconnect();
  if (root.classList.contains('story--stacked')) {
    layers.forEach(l => l.classList.add('is-active'));
    return;
  }
  activate(0);
  // Auslöser ist die Karte, nicht der (höhere) Schritt-Container: sonst
  // wechselte die Grafik, während noch die vorige Karte gelesen wird.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) activate(Number(e.target.closest('.story__step').dataset.step));
    });
  }, { rootMargin: '-74% 0px -25% 0px' }); // Linie bei 75 %: Wechsel, sobald die Karte auftaucht
  steps.forEach(s => observer.observe(s.querySelector('.story__card') || s));
  _observers.set(root, observer);
}

// Gestapelter 100-%-Balken: segments = [{ value, label, series }]
function shareBar(label, segments) {
  const row = document.createElement('div');
  row.className = 'share-bar';
  const title = document.createElement('div');
  title.className = 'share-bar__label';
  title.textContent = label;
  const track = document.createElement('div');
  track.className = 'share-bar__track';
  segments.forEach(seg => {
    const el = document.createElement('div');
    el.className = 'share-bar__seg';
    el.style.flexBasis = `${seg.value}%`;
    el.style.background = `var(--series-${seg.series})`;
    el.title = `${seg.label}: ${fmtNumber(seg.value, { decimals: 1 })} %`;
    track.appendChild(el);
  });
  row.append(title, track);
  return row;
}

function shareLegend(items) {
  const ul = document.createElement('ul');
  ul.className = 'share-legend';
  items.forEach(it => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'share-legend__dot';
    dot.style.background = `var(--series-${it.series})`;
    li.append(dot, document.createTextNode(it.label));
    ul.appendChild(li);
  });
  return ul;
}

function sourceNote(text) {
  const p = document.createElement('p');
  p.className = 'chart-source';
  p.textContent = text;
  return p;
}

/**
 * @param {HTMLElement} root - .story-Container
 * @param {Object} wealth - world-state.economy.wealth
 */
export function initWealthStory(root, wealth) {
  const series = wealth?.wealthShares;
  const top1 = series?.wealthTop1 || [];
  const top10 = series?.wealthTop10?.at(-1);
  const income = series?.incomeTop1?.at(-1);
  if (!root || top1.length < 10 || !top10 || !income) {
    if (root) root.hidden = true;
    return;
  }

  stackOnMobile(root);
  const layers = root.querySelectorAll('.story__layer');
  const t = (key, p) => i18n.t(key, p);
  const f1 = (v) => fmtNumber(v, { decimals: 1 });
  const first = top1[0];
  const last = top1[top1.length - 1];
  const rest90 = 100 - top10.value;
  const mid9 = top10.value - last.value;
  // Pro Kopf: 1 % der Menschen hält last.value %, 90 % halten rest90 %
  const perCapita = (last.value / 1) / (rest90 / 90);
  const src = `${t('badge.sourceLabel')}: World Inequality Database (WID.world) · ${t('story.wealth.asOf', { year: last.year })}`;

  root.querySelector('[data-story-text="0"]').textContent = t('story.wealth.step1', {
    firstYear: first.year, first: f1(first.value), lastYear: last.year, last: f1(last.value),
  });
  root.querySelector('[data-story-text="1"]').textContent = t('story.wealth.step2', {
    top10: f1(top10.value), rest: f1(rest90), times: fmtNumber(perCapita, { decimals: 0 }),
  });
  root.querySelector('[data-story-text="2"]').textContent = t(
    last.value > income.value ? 'story.wealth.step3' : 'story.wealth.step3neutral',
    { income: f1(income.value), wealth: f1(last.value), year: income.year },
  );

  // Ebene 1: Verlauf
  Charts.lineChart(layers[0], top1, {
    color: cssVar('--series-1'), unit: '%', yLabel: t('story.wealth.axisShare'), yMin: 0,
    height: (layers[0].clientHeight || 340) - 40, source: src,
  });

  // Ebene 2: Menschen vs. Vermögen
  const groups = [
    { label: t('story.wealth.groupTop1'), series: 1 },
    { label: t('story.wealth.groupNext9'), series: 3 },
    { label: t('story.wealth.groupRest90'), series: 7 },
  ];
  const box2 = document.createElement('div');
  box2.className = 'share-bars';
  box2.append(
    shareBar(t('story.wealth.people'), [1, 9, 90].map((v, i) => ({ ...groups[i], value: v }))),
    shareBar(t('story.wealth.wealth'), [last.value, mid9, rest90].map((v, i) => ({ ...groups[i], value: v }))),
    shareLegend(groups.map((g, i) => ({ ...g, label: `${g.label} · ${f1([last.value, mid9, rest90][i])} %` }))),
    sourceNote(src),
  );
  layers[1].appendChild(box2);

  // Ebene 3: Einkommen vs. Vermögen des reichsten 1 %
  const top = { label: t('story.wealth.groupTop1'), series: 1 };
  const other = { label: t('story.wealth.groupOther99'), series: 7 };
  const box3 = document.createElement('div');
  box3.className = 'share-bars';
  box3.append(
    shareBar(`${t('story.wealth.income')} ${income.year} · ${f1(income.value)} %`, [{ ...top, value: income.value }, { ...other, value: 100 - income.value }]),
    shareBar(`${t('story.wealth.wealth')} ${last.year} · ${f1(last.value)} %`, [{ ...top, value: last.value }, { ...other, value: 100 - last.value }]),
    shareLegend([top, other]),
    sourceNote(src),
  );
  layers[2].appendChild(box3);

  bindSteps(root);
}

// Ländername in der Seitensprache (ISO2 → Intl), sonst UNHCR-Name
function countryName(iso2, fallback) {
  try {
    return new Intl.DisplayNames([i18n.lang], { type: 'region' }).of(iso2) || fallback;
  } catch {
    return fallback;
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

async function flowMap(layer, flows, note) {
  const res = await fetch('assets/maps/world.svg');
  if (!res.ok) return;
  const wrap = document.createElement('div');
  wrap.className = 'flow-map';
  wrap.innerHTML = await res.text();
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'flow-map__svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const max = Math.max(...flows.map(f => f.count));
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'flow-map__flows');
  // kleinste zuerst, damit große Ströme obenauf liegen
  [...flows].reverse().forEach(f => {
    const a = projectWorld(f.fromLatLng[0], f.fromLatLng[1]);
    const b = projectWorld(f.toLatLng[0], f.toLatLng[1]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Bogen: Kontrollpunkt senkrecht zur Verbindung, Höhe ∝ Distanz
    const bend = Math.max(12, dist * 0.3);
    const cx = (a.x + b.x) / 2 - (dy / dist) * bend;
    const cy = (a.y + b.y) / 2 + (dx / dist) * bend;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    path.setAttribute('class', 'flow-map__arc');
    path.style.strokeWidth = (6 + 18 * Math.sqrt(f.count / max)).toFixed(1);
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = `${countryName(f.fromIso2, f.from)} → ${countryName(f.toIso2, f.to)}: ${fmtNumber(f.count / 1e6, { decimals: 2 })} ${i18n.t('story.refugees.mio')}`;
    path.appendChild(title);
    g.appendChild(path);
    const origin = document.createElementNS(SVG_NS, 'circle');
    origin.setAttribute('cx', a.x.toFixed(1));
    origin.setAttribute('cy', a.y.toFixed(1));
    origin.setAttribute('r', '7');
    origin.setAttribute('class', 'flow-map__origin');
    g.appendChild(origin);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', b.x.toFixed(1));
    dot.setAttribute('cy', b.y.toFixed(1));
    dot.setAttribute('r', '9');
    dot.setAttribute('class', 'flow-map__host');
    g.appendChild(dot);
  });
  svg.appendChild(g);
  const legend = document.createElement('ul');
  legend.className = 'share-legend flow-map__legend';
  [['origin', 'story.refugees.legendOrigin'], ['host', 'story.refugees.legendHost']].forEach(([cls, key]) => {
    const li = document.createElement('li');
    const mark = document.createElement('span');
    mark.className = `flow-map__mark flow-map__mark--${cls}`;
    li.append(mark, document.createTextNode(i18n.t(key)));
    legend.appendChild(li);
  });
  layer.replaceChildren(wrap, legend, sourceNote(note));
}

function rankBars(items) {
  const max = Math.max(...items.map(it => it.value));
  const list = document.createElement('ol');
  list.className = 'rank-bars';
  items.forEach(it => {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'rank-bars__head';
    const name = document.createElement('span');
    name.textContent = it.label;
    const val = document.createElement('span');
    val.className = 'rank-bars__value';
    val.textContent = it.valueText;
    head.append(name, val);
    const track = document.createElement('div');
    track.className = 'rank-bars__track';
    const bar = document.createElement('div');
    bar.className = 'rank-bars__bar';
    bar.style.width = `${(it.value / max) * 100}%`;
    track.appendChild(bar);
    li.append(head, track);
    list.appendChild(li);
  });
  return list;
}

/**
 * @param {HTMLElement} root - .story-Container
 * @param {Object} refugees - world-state.society.refugees
 */
export function initRefugeeStory(root, refugees) {
  const r = refugees;
  const flows = (r?.flows || []).filter(f => f.fromLatLng && f.toLatLng && f.fromIso2).slice(0, 8);
  const hosts = r?.topHosts || [];
  if (!root || !r?.total || r.flowsFallback || flows.length < 3 || hosts.length < 3 || !r.crossBorderTotal) {
    if (root) root.hidden = true;
    return;
  }

  stackOnMobile(root);
  const layers = root.querySelectorAll('.story__layer');
  layers.forEach(l => l.replaceChildren()); // wird bei Neu-Render erneut aufgerufen
  const t = (key, p) => i18n.t(key, p);
  const mio = (v) => fmtNumber(v / 1e6, { decimals: 1 });
  const pct = (v) => fmtNumber(v / r.total * 100, { decimals: 0 });
  const src = `${t('badge.sourceLabel')}: UNHCR Refugee Data Finder · ${t('story.wealth.asOf', { year: r.dataYear })}`;
  const name = (iso2, fb) => countryName(iso2, fb);
  const [f1, f2] = flows;
  const top5 = hosts.reduce((s, h) => s + h.count, 0);

  root.querySelector('[data-story-text="0"]').textContent = t('story.refugees.step1', {
    year: r.dataYear, total: mio(r.total), idpsPct: pct(r.displaced),
  });
  root.querySelector('[data-story-text="1"]').textContent = t('story.refugees.step2', {
    from1: name(f1.fromIso2, f1.from), to1: name(f1.toIso2, f1.to), n1: mio(f1.count),
    from2: name(f2.fromIso2, f2.from), to2: name(f2.toIso2, f2.to), n2: mio(f2.count),
  });
  root.querySelector('[data-story-text="2"]').textContent = t('story.refugees.step3', {
    cross: mio(r.crossBorderTotal), h1: name(hosts[0].iso2, hosts[0].name), h2: name(hosts[1].iso2, hosts[1].name),
    h3: name(hosts[2].iso2, hosts[2].name), share: fmtNumber(top5 / r.crossBorderTotal * 100, { decimals: 0 }),
  });

  // Ebene 1: Zusammensetzung
  const groups = [
    { key: 'idps', value: r.displaced, series: 2 },
    { key: 'refugees', value: r.refugees, series: 1 },
    { key: 'asylum', value: r.asylumseekers, series: 3 },
    { key: 'other', value: r.otherInNeed || 0, series: 7 },
  ].map(g => ({ ...g, label: t(`story.refugees.cat.${g.key}`), value: g.value / r.total * 100 }));
  const box = document.createElement('div');
  box.className = 'share-bars';
  box.append(
    shareBar(`${t('story.refugees.total')} ${r.dataYear} · ${mio(r.total)} ${i18n.t('story.refugees.mio')}`, groups),
    shareLegend(groups.map(g => ({ ...g, label: `${g.label} · ${fmtNumber(g.value, { decimals: 0 })} %` }))),
    sourceNote(src),
  );
  layers[0].appendChild(box);

  // Ebene 2: Karte
  flowMap(layers[1], flows, `${src} · ${t('story.refugees.mapNote')}`);

  // Ebene 3: Aufnahmeländer
  const box3 = document.createElement('div');
  box3.className = 'share-bars';
  box3.append(
    rankBars(hosts.map(h => ({ label: name(h.iso2, h.name), value: h.count, valueText: `${mio(h.count)} ${i18n.t('story.refugees.mio')}` }))),
    sourceNote(`${src} · ${t('story.refugees.hostNote')}`),
  );
  layers[2].appendChild(box3);

  bindSteps(root);
}
