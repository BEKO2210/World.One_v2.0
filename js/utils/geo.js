/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Kartenprojektion für assets/maps/world.svg
   Die Weltkarte ist eine Robinson-Projektion (2000 × 857, beschnitten
   auf ca. 83° N bis 56° S), keine equirektanguläre. Kalibriert an den
   Ländergrenzen von 10 Staaten: Restfehler ≤ 3,8 px (x) / 1,9 px (y).
   Die frühere Formel (lng+180)/360, (90−lat)/180 lag bis ~100 px daneben.
   ═══════════════════════════════════════════════════════════ */

// Robinson-Tabelle: Breite (°) → [X-Faktor, Y-Faktor]
const TABLE = [
  [1.0000, 0.0000], [0.9986, 0.0620], [0.9954, 0.1240], [0.9900, 0.1860],
  [0.9822, 0.2480], [0.9730, 0.3100], [0.9600, 0.3720], [0.9427, 0.4340],
  [0.9216, 0.4958], [0.8962, 0.5571], [0.8679, 0.6176], [0.8350, 0.6769],
  [0.7986, 0.7346], [0.7597, 0.7903], [0.7186, 0.8435], [0.6732, 0.8936],
  [0.6213, 0.9394], [0.5722, 0.9761], [0.5322, 1.0000],
];

// Kalibrierung in Koordinaten der Original-viewBox 2000 × 857
const VB_W = 2000, VB_H = 857;
const X0 = 986.46, KX = 5.6665;   // px je Längengrad × X-Faktor
const Y0 = 501.797, KY = 518.086; // px je Y-Faktor

function factors(lat) {
  const a = Math.min(90, Math.abs(lat)) / 5;
  const i = Math.min(Math.floor(a), TABLE.length - 2);
  const t = a - i;
  const [x0, y0] = TABLE[i];
  const [x1, y1] = TABLE[i + 1];
  return [x0 + (x1 - x0) * t, (y0 + (y1 - y0) * t) * Math.sign(lat)];
}

/**
 * Geokoordinate → Punkt auf world.svg, skaliert auf width × height.
 * @returns {{x: number, y: number}}
 */
export function projectWorld(lat, lng, width = VB_W, height = VB_H) {
  const [fx, fy] = factors(lat);
  return {
    x: (X0 + KX * fx * lng) / VB_W * width,
    y: (Y0 - KY * fy) / VB_H * height,
  };
}
