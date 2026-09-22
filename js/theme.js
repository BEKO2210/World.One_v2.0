/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Theme (hell/dunkel)
   Blockierend im <head> geladen, damit vor dem ersten Zeichnen das
   richtige Theme steht (kein Aufblitzen). Ohne gespeicherte Wahl gilt
   die Systemeinstellung (prefers-color-scheme).
   ═══════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'world-one-theme';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { /* privat/blockiert */ }
  var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  var theme = stored === 'light' || stored === 'dark' ? stored : system;
  document.documentElement.setAttribute('data-theme', theme);

  // Umschalter: speichern und neu laden — SVG- und Canvas-Charts übernehmen
  // ihre Farben beim Aufbau und müssen neu gezeichnet werden.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next); } catch (err) { /* ohne Speicher nur diese Seite */ }
    document.documentElement.setAttribute('data-theme', next);
    window.location.reload();
  });
})();
