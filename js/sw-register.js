/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Service-Worker-Registrierung (Haupt- und Detailseite)
   Früher als Inline-Skript in index.html und detail/index.html dupliziert;
   als Datei CSP-tauglich (script-src 'self') und nur noch einmal gepflegt.
   ═══════════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  // Detailseite liegt eine Ebene tiefer; der SW gilt für die ganze Site.
  const inDetail = /\/detail\//.test(window.location.pathname);
  const swUrl = inDetail ? '../service-worker.js' : 'service-worker.js';
  const scope = inDetail ? '../' : './';

  // Erstbesuch: Seite hatte noch keinen Controller → clients.claim() löst
  //   controllerchange aus, ein Reload würde den Loader ein zweites Mal
  //   zeigen. Nur bei echten Updates neu laden, und nicht vor den Augen
  //   des Users, sondern erst wenn der Tab in den Hintergrund geht.
  let hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (reloaded) return;
    if (document.visibilityState === 'hidden') { reload(); return; }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reload();
    });
  });

  // updateViaCache:'none' → der Browser cached die SW-Datei nicht; Update-
  // Check beim Laden und alle 30 min für lange offene Tabs.
  navigator.serviceWorker
    .register(swUrl, { updateViaCache: 'none', scope })
    .then(reg => {
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    })
    .catch(err => console.warn('[SW] register failed:', err));
}
