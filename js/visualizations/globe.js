/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Globus im Startbereich
   Eine Kugel mit gebackener Länder-Textur (scripts/build-globe-texture.js),
   darauf Konfliktorte und Erdbeben der letzten 24 h als Punkte.
   - three.js selbst gehostet (assets/vendor/three), lädt erst im Leerlauf
     nach dem ersten Rendern der Seite — der Hero-Text bleibt das LCP.
   - Waagerecht wischen dreht, senkrecht scrollt die Seite (touch-action).
   - Pausiert außerhalb des Bildschirms und in Hintergrund-Tabs; bei
     „Bewegung reduzieren“ keine Eigendrehung.
   - Ohne WebGL oder bei Ladefehler bleibt der Platzhalter ausgeblendet.
   ═══════════════════════════════════════════════════════════ */

import { i18n } from '../i18n.js';
import { fmtNumber } from '../utils/fmt.js';
import { cssVar } from '../utils/chart-manager.js';

const THREE_URL = '../../assets/vendor/three/three.module.min.js';
const DEG = Math.PI / 180;
const AUTO_SPEED = 0.06;          // rad/s Eigendrehung
const DRAG_SPEED = 0.005;         // rad je Pixel
const START_LNG = 20;             // Europa/Afrika/Nahost zu Beginn vorn
const TILT = 18 * DEG;            // Nordhalbkugel leicht zugewandt

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Breite/Länge → Punkt auf der Einheitskugel, passend zur UV-Abbildung von
// THREE.SphereGeometry und zur equirektangulären Textur
function toVec(THREE, lat, lng, r = 1) {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function whenIdle() {
  return new Promise(resolve => {
    const go = () => ('requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 2500 }) : setTimeout(resolve, 600));
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  });
}

/**
 * @param {HTMLElement} holder - .prolog__globe (Platz ist im HTML reserviert)
 * @param {Object} data - world-state
 */
export async function initHeroGlobe(holder, data) {
  if (!holder || holder.dataset.ready) return;
  holder.dataset.ready = '1';
  const conn = navigator.connection;
  if (!webglAvailable() || conn?.saveData) { holder.hidden = true; return; }

  await whenIdle();
  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch (err) {
    console.warn('[Globe] three.js nicht geladen:', err);
    holder.hidden = true;
    return;
  }

  const light = document.documentElement.dataset.theme === 'light';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = holder.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.9);   // Kugel + Saum passen ganz ins Bild

  const globe = new THREE.Group();
  globe.rotation.x = TILT;
  scene.add(globe);

  // Kugel mit Länder-Textur (unbeleuchtet: Farben = Token-Farben der Textur)
  const texture = await new THREE.TextureLoader().loadAsync(`assets/globe/earth-${light ? 'light' : 'dark'}.webp`).catch(() => null);
  if (!texture) { holder.hidden = true; renderer.dispose(); return; }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial({ map: texture }));
  globe.add(earth);

  // Atmosphäre: Fresnel-Saum in Akzentfarbe hinter der Kugel
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(cssVar('--accent') || '#8ab4f8') }, strength: { value: light ? 0.35 : 0.55 } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; uniform float strength; varying vec3 vN; void main(){ float i = pow(clamp(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 0.0, 1.0), 3.0) * strength; gl_FragColor = vec4(color, i); }',
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(glow);

  // Punkte: Konflikte (Intensität) + Erdbeben 24 h (Magnitude)
  const conflicts = (data?.society?.conflicts?.locations || []).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  const quakes = (data?.realtime?.earthquakes?.last24h || []).filter(q => Number.isFinite(q.lat) && Number.isFinite(q.lng));
  const dots = [
    ...quakes.map(q => ({ lat: q.lat, lng: q.lng, r: 0.006 + Math.max(0, q.magnitude - 2) * 0.004, color: cssVar('--series-2') })),
    ...conflicts.map(c => ({ lat: c.lat, lng: c.lng, r: 0.012 + (c.intensity || 0.3) * 0.016, color: cssVar('--status-critical') })),
  ];
  if (dots.length) {
    const disc = new THREE.CircleGeometry(1, 20);
    const mesh = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), dots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const z = new THREE.Vector3(0, 0, 1);
    dots.forEach((d, i) => {
      const n = toVec(THREE, d.lat, d.lng).normalize();
      q.setFromUnitVectors(z, n);
      m.compose(n.clone().multiplyScalar(1.003), q, new THREE.Vector3(d.r, d.r, d.r));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color(d.color));
    });
    globe.add(mesh);
  }

  // Legende mit Zahlen
  const legend = holder.querySelector('.prolog__globe-legend');
  if (legend) {
    legend.textContent = '';
    [[cssVar('--status-critical'), i18n.t('globe.conflicts', { n: fmtNumber(conflicts.length, { decimals: 0 }) })],
     [cssVar('--series-2'), i18n.t('globe.quakes', { n: fmtNumber(quakes.length, { decimals: 0 }) })],
     [null, `↔ ${i18n.t('globe.hint')}`]]
      .forEach(([color, text]) => {
        const li = document.createElement('li');
        if (color) {
          const dot = document.createElement('span');
          dot.className = 'prolog__globe-dot';
          dot.style.background = color;
          li.appendChild(dot);
        }
        li.appendChild(document.createTextNode(text));
        legend.appendChild(li);
      });
  }

  // Startausrichtung: START_LNG zeigt zur Kamera
  let rotY = -(START_LNG + 90) * DEG;
  let velocity = 0;

  const resize = () => {
    const size = holder.querySelector('.prolog__globe-stage').clientWidth;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(holder);

  // Waagerecht ziehen dreht; senkrechte Gesten bleiben Scrollen (touch-action: pan-y)
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastT = performance.now(); velocity = 0;
    canvas.setPointerCapture(e.pointerId);
    holder.classList.add('is-dragging');
    wake();
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    rotY += dx * DRAG_SPEED;
    velocity = dx * DRAG_SPEED / Math.max(16, now - lastT) * 1000;
    lastX = e.clientX; lastT = now;
  });
  const end = () => { dragging = false; holder.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // Renderschleife nur, solange sichtbar und etwas passiert
  let visible = true;
  let running = false;
  let prev = 0;
  const frame = (t) => {
    const dt = prev ? Math.min(0.05, (t - prev) / 1000) : 0;
    prev = t;
    if (!dragging) {
      if (Math.abs(velocity) > 0.01) { rotY += velocity * dt; velocity *= Math.pow(0.04, dt); }
      else if (!reduced) rotY += AUTO_SPEED * dt;
    }
    globe.rotation.y = rotY;
    renderer.render(scene, camera);
    const idle = reduced && !dragging && Math.abs(velocity) <= 0.01;
    if (visible && !document.hidden && !idle) requestAnimationFrame(frame);
    else { running = false; prev = 0; }
  };
  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(holder);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  renderer.render(scene, camera);
  holder.classList.add('is-ready');
  holder.closest('.prolog')?.classList.add('has-globe');
  wake();
}
