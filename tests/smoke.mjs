#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Browser-Smoke-Test (Playwright)
   Pro Seite (Startseite + alle Detailseiten):
     - genau 1 Navigation (kein Doppel-Reload)
     - keine Page-Errors, keine CSP-Verstöße, keine 4xx/5xx der eigenen Site
     - jedes <canvas> ist nach dem Scrollen gezeichnet (kein leerer Chart)
     - kein NaN / undefined / [object Object] / roher i18n-Key im Text
   Aufruf: BASE=http://localhost:8000 node tests/smoke.mjs
   ═══════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = (process.env.BASE || 'http://localhost:8000').replace(/\/$/, '');
const detailSrc = readFileSync(new URL('../detail/detail-app.js', import.meta.url), 'utf8');
const TOPICS = [...detailSrc.match(/VALID_TOPICS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

const BAD_TEXT = /\bNaN\b|\bundefined\b|\[object Object\]|\b(?:detail|act\d+|js|badge|nav|region|unit)\.\w+\.[\w.]+\b/;

// CHROMIUM_PATH: lokal vorhandenes Chromium statt Playwright-Download
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
const failures = [];

async function check(path, label) {
  const page = await ctx.newPage();
  const problems = [];
  let navigations = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
  page.on('pageerror', e => problems.push(`pageerror: ${e.message.slice(0, 140)}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Content Security Policy|Refused to/.test(t)) problems.push(`csp: ${t.slice(0, 140)}`);
    // App-Fehler, die per console.error statt als Exception gemeldet werden
    // (z. B. „[DetailApp] Failed to load topic“). Netzwerk-/SW-Meldungen
    // externer Quellen sind kein Code-Fehler und werden ignoriert.
    else if (!/Failed to load resource|Service Worker|net::ERR|\[SW\]/.test(t)) problems.push(`console: ${t.split('\n')[0].slice(0, 140)}`);
  });
  page.on('response', r => {
    const u = r.url();
    if (u.startsWith(BASE) && r.status() >= 400 && !/favicon/.test(u)) problems.push(`HTTP ${r.status()} ${u.replace(BASE, '')}`);
  });

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => problems.push(`goto: ${e.message}`));
  await page.waitForTimeout(2000);
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2500);

  if (navigations !== 1) problems.push(`${navigations} Navigationen statt 1`);

  const emptyCanvas = await page.evaluate(() => [...document.querySelectorAll('canvas')]
    .filter(c => c.offsetParent !== null && c.id && !(window.Chart && window.Chart.getChart(c)))
    .map(c => c.id));
  if (emptyCanvas.length) problems.push(`leere Charts: ${emptyCanvas.join(', ')}`);

  const text = await page.evaluate(() => document.body.innerText);
  const bad = text.split('\n').find(line => BAD_TEXT.test(line));
  if (bad) problems.push(`Text: "${bad.trim().slice(0, 100)}"`);

  console.log(`${problems.length ? '✘' : '✔'} ${label}${problems.length ? ' — ' + problems.join(' | ') : ''}`);
  if (problems.length) failures.push(label);
  await page.close();
}

await check('/', 'index');
for (const t of TOPICS) await check(`/detail/?topic=${t}`, t);
await browser.close();

console.log(`\n${TOPICS.length + 1 - failures.length}/${TOPICS.length + 1} Seiten ohne Befund`);
if (failures.length) process.exit(1);
