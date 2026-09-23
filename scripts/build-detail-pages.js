#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Statische Detailseiten + Sitemap
   Erzeugt aus detail/index.html je Thema detail/<topic>/index.html mit
   eigenem <title>, meta description, canonical und Open-Graph-Tags
   (Suchmaschinen und Link-Vorschauen sehen den Inhalt ohne JavaScript),
   dazu sitemap.xml.

   node scripts/build-detail-pages.js          # schreiben
   node scripts/build-detail-pages.js --check  # nur prüfen (PR-Check)
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://beko2210.github.io/World.One_v2.0/';
const CHECK = process.argv.includes('--check');

const template = readFileSync(join(ROOT, 'detail', 'index.html'), 'utf8');
const de = JSON.parse(readFileSync(join(ROOT, 'i18n', 'de.json'), 'utf8'));
const detailApp = readFileSync(join(ROOT, 'detail', 'detail-app.js'), 'utf8');
const topics = [...detailApp.match(/VALID_TOPICS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const firstSentences = (s, max = 160) => {
  const text = String(s || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + ' …';
};

let changed = 0;
const write = (rel, content) => {
  const path = join(ROOT, rel);
  const old = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (old === content) return;
  changed++;
  if (CHECK) { console.error(`[build-detail-pages] veraltet: ${rel}`); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

for (const topic of topics) {
  const title = de[`detail.${topic}.title`] || topic;
  const desc = firstSentences(de[`detail.${topic}.explanation`] || de[`detail.${topic}.heroLabel`] || de['meta.description'] || title);
  const url = `${SITE}detail/${topic}/`;
  const head = [
    `  <base href="../">`,
    `  <title>${esc(title)} — World.One</title>`,
    `  <meta name="description" content="${esc(desc)}">`,
    `  <link rel="canonical" href="${url}">`,
    `  <meta property="og:type" content="article">`,
    `  <meta property="og:site_name" content="World.One">`,
    `  <meta property="og:title" content="${esc(title)} — World.One">`,
    `  <meta property="og:description" content="${esc(desc)}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${SITE}assets/og-image.png">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
  ].join('\n');

  const page = template
    .replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- Generiert von scripts/build-detail-pages.js — nicht von Hand ändern -->')
    .replace(/<html lang="de"([^>]*)>/, `<html lang="de"$1 data-topic="${topic}">`)
    .replace(/ {2}<title>[^<]*<\/title>/, head)
    // mit <base href="../"> zeigte „#detail-main“ auf /detail/ statt auf diese Seite
    .replace('href="#detail-main"', `href="${topic}/#detail-main"`);
  if (!page.includes(`data-topic="${topic}"`) || !page.includes('<base href="../">')) {
    throw new Error(`Vorlage passt nicht (lang/title-Zeile geändert?) für ${topic}`);
  }
  write(`detail/${topic}/index.html`, page);
}

const urls = [SITE, ...topics.map(t => `${SITE}detail/${t}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><changefreq>${u === SITE ? 'hourly' : 'daily'}</changefreq></url>`).join('\n')}
</urlset>
`);

if (CHECK && changed) {
  console.error(`[build-detail-pages] ${changed} Datei(en) veraltet — node scripts/build-detail-pages.js ausführen`);
  process.exit(1);
}
console.log(`[build-detail-pages] ${topics.length} Detailseiten + sitemap.xml ${CHECK ? 'aktuell' : `(${changed} geschrieben)`}`);
