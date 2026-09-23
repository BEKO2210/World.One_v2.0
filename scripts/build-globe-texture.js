#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Globus-Texturen (equirektangulär) für den Startbereich
   Länder als gebackenes Bild auf EINER Kugel statt je Polygonring ein
   Mesh (Verfahren aus dem Demografie-Atlas: 8094 → 14 Draw-Calls).
   Je Theme eine Textur in den Token-Farben von css/core.css.

   Eingabe: world-atlas@2 countries-110m (TopoJSON, jsdelivr)
   Ausgabe: assets/globe/earth-{dark,light}.png; ausgeliefert werden
            verlustfreie WebP (halbe Größe), danach umwandeln:
            python3 -c "from PIL import Image; [Image.open(f'assets/globe/earth-{t}.png').save(f'assets/globe/earth-{t}.webp', lossless=True, method=6) for t in ('dark','light')]"
            und die PNGs löschen.
   Aufruf:  npm i --no-save topojson-client && node scripts/build-globe-texture.js
   ═══════════════════════════════════════════════════════════════ */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 2048;          // reicht für den Startbereich, auch auf Retina
const HEIGHT = WIDTH / 2;
const SUPERSAMPLE = 2;       // weiche Kanten, danach heruntergerechnet
const W = WIDTH * SUPERSAMPLE;
const H = HEIGHT * SUPERSAMPLE;
const STROKE_WIDTH = 3;

const THEMES = {
  dark:  { ocean: [16, 24, 38],   land: [44, 52, 66],    stroke: [120, 134, 156], strokeAlpha: 0.55 },
  light: { ocean: [221, 229, 240], land: [255, 255, 255], stroke: [150, 162, 180], strokeAlpha: 0.7 },
};

const toX = (lon) => ((lon + 180) / 360) * W;
const toY = (lat) => ((90 - lat) / 180) * H;
let pixels;
const setPixel = (x, y, color, alpha = 1) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const at = (y * W + x) * 3;
  for (let c = 0; c < 3; c++) pixels[at + c] = alpha >= 1 ? color[c] : Math.round(color[c] * alpha + pixels[at + c] * (1 - alpha));
};

function unwrapRing(ring) {
  let offset = 0;
  const out = [];
  for (let index = 0; index < ring.length; index += 1) {
    const [lon, lat] = ring[index];
    if (index > 0) {
      const previous = ring[index - 1][0] + offset;
      if (lon + offset - previous > 180) offset -= 360;
      else if (lon + offset - previous < -180) offset += 360;
    }
    out.push([lon + offset, lat]);
  }
  return out;
}

/** Even-odd-Scanline über alle Ringe eines Polygons — Löcher bleiben Löcher. */
function fillPolygon(rings, color) {
  let minY = Infinity;
  let maxY = -Infinity;
  const edges = [];
  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [lon1, lat1] = ring[index];
      const [lon2, lat2] = ring[index + 1];
      const x1 = toX(lon1);
      const y1 = toY(lat1);
      const x2 = toX(lon2);
      const y2 = toY(lat2);
      if (y1 === y2) continue;
      edges.push([x1, y1, x2, y2]);
      minY = Math.min(minY, y1, y2);
      maxY = Math.max(maxY, y1, y2);
    }
  }
  if (edges.length === 0) return;

  const from = Math.max(0, Math.floor(minY));
  const to = Math.min(H - 1, Math.ceil(maxY));
  const crossings = [];
  for (let y = from; y <= to; y += 1) {
    const scan = y + 0.5;
    crossings.length = 0;
    for (const [x1, y1, x2, y2] of edges) {
      if ((scan >= y1 && scan < y2) || (scan >= y2 && scan < y1)) {
        crossings.push(x1 + ((scan - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const left = Math.max(0, Math.round(crossings[index]));
      const right = Math.min(W - 1, Math.round(crossings[index + 1]));
      for (let x = left; x <= right; x += 1) setPixel(x, y, color);
    }
  }
}

/** Dünne Umrisslinie. */
function strokeRings(rings, STROKE_RGB, STROKE_ALPHA) {
  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const x1 = toX(ring[index][0]);
      const y1 = toY(ring[index][1]);
      const x2 = toX(ring[index + 1][0]);
      const y2 = toY(ring[index + 1][1]);
      if (Math.max(x1, x2) < 0 || Math.min(x1, x2) >= W) continue;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
      const reach = Math.floor(STROKE_WIDTH / 2);
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const px = Math.round(x1 + (x2 - x1) * t);
        const py = Math.round(y1 + (y2 - y1) * t);
        for (let dy = -reach; dy <= reach; dy += 1) {
          for (let dx = -reach; dx <= reach; dx += 1) {
            setPixel(px + dx, py + dy, STROKE_RGB, STROKE_ALPHA);
          }
        }
      }
    }
  }
}

const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const WRAPS = [-360, 0, 360];
const shiftRing = (ring, delta) => ring.map(([lon, lat]) => [lon + delta, lat]);

// Heruntergerechnet (Box-Filter) und als PNG (RGB, ohne Filter) kodiert
function png(buf) {
  const out = new Uint8Array(WIDTH * HEIGHT * 3);
  const s = SUPERSAMPLE;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) sum += buf[((y * s + dy) * W + (x * s + dx)) * 3 + c];
    out[(y * WIDTH + x) * 3 + c] = Math.round(sum / (s * s));
  }
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) Buffer.from(out.buffer, y * WIDTH * 3, WIDTH * 3).copy(raw, y * (WIDTH * 3 + 1) + 1);
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
if (!res.ok) throw new Error(`world-atlas: HTTP ${res.status}`);
const topo = await res.json();
const features = feature(topo, topo.objects.countries).features;

mkdirSync(join(ROOT, 'assets', 'globe'), { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  pixels = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) pixels.set(t.ocean, i * 3);
  for (const item of features) {
    for (const rings of polygonsOf(item.geometry)) {
      const unwrapped = rings.map(unwrapRing);
      for (const delta of WRAPS) {
        const shifted = unwrapped.map((ring) => shiftRing(ring, delta));
        fillPolygon(shifted, t.land);
        strokeRings(shifted, t.stroke, t.strokeAlpha);
      }
    }
  }
  const file = join(ROOT, 'assets', 'globe', `earth-${name}.png`);
  writeFileSync(file, png(pixels));
  console.log(`[build-globe-texture] ${file}`);
}
