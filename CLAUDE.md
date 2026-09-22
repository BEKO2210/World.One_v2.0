# CLAUDE.md — World.One v2.0

Static-Site (GitHub Pages, kein Build-Step) + Node-Datenpipeline in GitHub Actions.
Ausführlicher Zustand, Historie und Score-Datenfluss: `CLOUDE.md`. Aktuelle Roadmap: `AUDIT_ROADMAP.md`.

## Struktur
- `index.html` + `js/app.js` — Hauptseite (15 Scroll-Sektionen), lädt `data/processed/world-state.json`.
- `detail/index.html?topic=<id>` + `detail/detail-app.js` + `detail/topics/*.js` — Detailseiten
  (3-Tier Live → `data/cache/*.json` → `data/fallback/static-values.json`).
- `scripts/` — `collect-data.js` → `process-data.js` (Score) + `cache-*.js`; `validate-*.js`.
- `.github/workflows/data-pipeline-v2.yml` — einziger geplanter Workflow (alle 6 h), committet Daten und
  setzt `CACHE_VERSION` in `service-worker.js`. Bot-Commits nie manuell überschreiben.

## Lokal prüfen
```
python3 -m http.server 8000          # Seite unter http://localhost:8000
node scripts/validate-cache.js
node scripts/validate-fallback.js
node scripts/validate-routing.js
node scripts/validate-score-coverage.js
```
`process-data.js` und `self-heal.js` schreiben Dateien unter `data/` — nur ausführen, wenn Datenänderungen gewollt sind.

## Regeln
- Ein Thema pro Commit; alle Validatoren grün.
- `js/i18n.js` immer DE + EN gleichzeitig ändern.
- Keine Doppeldaten: Werte aus `world-state.json`/Cache lesen, nie in HTML/Topics hartkodieren.
- Externe Daten nie ungeescaped per `innerHTML` einfügen.
- Tier-Badge (`live|cache|static`) muss die tatsächlich genutzte Quelle widerspiegeln.
- Schema-Änderungen an `world-state.json` nur additiv.
- Service-Worker-Registrierung ist in `index.html` und `detail/index.html` dupliziert — beide synchron halten.
