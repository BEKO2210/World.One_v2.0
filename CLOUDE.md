# World.One_v2.0 – Full Codebase Review & Stabilization Plan

## 1. Executive Summary

World.One_v2.0 ist ein statisches Vanilla-JS-Webprojekt mit zwei UI-Einstiegspunkten (`index.html` und `detail/index.html`), einer GitHub-Actions-Datenpipeline, einem lokalen Caching-/Fallback-Konzept und einem großen Bestand an bereits generierten Daten- und Verlaufssnapshots. Der Kern des Frontends läuft ohne Build-Tool (direkte ES-Module im Browser), während die Datenaufbereitung serverseitig über Node-Skripte erfolgt.

**Stärken (belegbar):**
- Klare Trennung zwischen Main Page (`js/app.js`) und Detail-Page-Modulen (`detail/topics/*.js`).
- Mehrstufige Fallback-Strategien im Main-Loader (Fresh -> Cache -> Stale) und Detail-Loader (Live -> Cache -> Static).
- Vorhandene GitHub Actions Pipeline inkl. Self-Heal, README-Generierung, Snapshot-Historie und Deploy.
- Internationalisierung (DE/EN) mit zentraler `i18n`-Datei.

**Haupt-Risikobild:**
- Hoher Anteil hardcodierter Inhalte (insb. Szenarien, mehrere Vergleichswerte, rechtliche Texte, einzelne KPI-Defaults).
- Mischbetrieb aus echten API-Daten, Cache-Daten und statischen Fallbacks mit unterschiedlicher Aktualität.
- Abhängigkeit von vielen externen Quellen (API-Ausfälle, Rate Limits, Schema-Drift).
- Cache-/Service-Worker-Strategie ist grundsätzlich robust, kann aber bei Deploy/Paths und Datenfrische inkonsistent wirken, wenn Annahmen brechen.

**Unsicherheitshinweis:**
Ich habe eine statische Code- und Dateianalyse durchgeführt. Live-Verhalten (z. B. tatsächliche Rendering-Fehler in bestimmten Browsern, externe API-Verfügbarkeit im Runtime-Zeitpunkt) kann ohne vollständige End-to-End-Läufe nur eingeschränkt bewertet werden.

---

## 2. Repository Map

### 2.1 Root-Ebene (funktional)
- `index.html`: Hauptseite mit 15 Scroll-Sektionen (Prolog + Akte + Epilog).
- `detail/index.html`: Detailseiten-Shell für Topic-Module.
- `js/`: Main-Frontend-Logik (App, Scroll, i18n, Loader, Visualisierungen, Utils).
- `detail/`: Detailseiten-App + Topic-Module + Detail-Utils.
- `css/`: Core/Components/Sections/Animations + Detail-Styles.
- `data/`:
  - `processed/world-state.json`: Hauptdatenquelle der Hauptseite.
  - `cache/*.json`: Erweiterte cache-basierte Datenquellen für Detailmodule.
  - `fallback/static-values.json`: statische letzte Fallback-Stufe.
  - `history/*.json` + `history/manifest.json`: Snapshot-Historie für Timeline.
- `scripts/`: Collector, Processor, Cache-Builder, Validierer, Meta-/README-Generator.
- `.github/workflows/data-pipeline.yml`: geplanter Pipeline-Lauf alle 6h + Deploy.
- `service-worker.js`: Offline-/Caching-Schicht.
- `package.json` + `package-lock.json`: Node-Skripte/Dependencies.

### 2.2 Frontend-Architektur
- **Main page**
  - Bootstrap in `js/app.js` (Klasse `BelkisOne`).
  - Data load via `js/data-loader.js` (`data/processed/world-state.json`).
  - Rendering/Animation über Subsysteme (`charts`, `maps`, `particles`, `counters`, `cinematic`).
- **Detail page**
  - Routing/Topic-Allowlist in `detail/detail-app.js`.
  - Dynamisches `import('./topics/${topic}.js')` nach Validierung.
  - Topic-Daten via `js/utils/data-loader.js` (3-Tier-Fallback).

### 2.3 Datenpipeline
- `scripts/collect-data.js`: API-Abzug (viele Quellen, Retry/Timeout).
- `scripts/process-data.js`: Normalisierung, Subscores, World Index, Merges/Fallbacks.
- `scripts/self-heal.js` (im Workflow genutzt): Integritäts-/Korrekturlogik.
- `scripts/generate-readme.js`: README aus aktuellen Daten.
- Workflow committed Daten, README, History und SW-Version regelmäßig.

---

## 3. Dependency Review

## 3.1 package.json (direkte Runtime-Dependencies)
- `rss-parser@^3.13.0`: RSS-Verarbeitung (Pipeline-Kontext).
- `xml2js@^0.6.2`: XML-Parsing (Pipeline-Kontext).

## 3.2 Scripts (package.json)
- `collect`: `node scripts/collect-data.js`
- `process`: `node scripts/process-data.js`
- `pipeline`: collect + process

## 3.3 Implizite/extern geladene Dependencies
- Chart.js wird nicht via npm gebundled, sondern in `js/utils/chart-manager.js` zur Laufzeit von CDN geladen (jsDelivr, fallback cdnjs).
  - **Risiko:** Abhängigkeit von CDN-Verfügbarkeit/CSP.

## 3.4 Lockfiles/Install-State
- `package-lock.json` vorhanden.
- `node_modules/` ist im Repo vorhanden (ungewöhnlich für reine Deploy-Repos, aber technisch möglich).
  - **Risiko:** Repo-Bloat, potenzielle Drift zwischen lockfile und committetem `node_modules`.

## 3.5 Bewertung
- Dependency-Footprint ist klein.
- Größtes technisches Risiko liegt weniger in npm-Paketen als in externen HTTP-Datenquellen und CDN-Laufzeitabhängigkeit.

---

## 4. Pages & Routes Review

## 4.1 Hauptroute
- `/index.html` mit 15 Sections:
  1) prolog
  2) akt-indicator
  3) akt-environment
  4) akt-biodiversity
  5) akt-oceans
  6) akt-society
  7) akt-economy
  8) akt-progress
  9) akt-realtime
  10) akt-momentum
  11) akt-crisis-map
  12) akt-scenarios
  13) akt-sources
  14) akt-action
  15) epilog

**Datenquelle:** primär `data/processed/world-state.json` via Main DataLoader.

**Risiken:**
- Viele DOM-IDs und selektorbasierte Verdrahtungen in `app.js`; Layoutänderungen können leicht versteckte Brüche erzeugen.

## 4.2 Detailroute
- `/detail/index.html` + Query-Parameter `?topic=<topicKey>`.
- Topic-Allowlist (`VALID_TOPICS`) kontrolliert Importziele (Sicherheitsmaßnahme gegen beliebige File-Imports).
- Bei ungültigem Topic: Error-State statt Crash.

**Risiken:**
- Topic muss gleichzeitig in Allowlist, Datei und (optional) Main-Link-Mapping stimmen.
- Inkonsistenzen zwischen Main-Link-Mapping und tatsächlicher Topic-Liste sind möglich.

## 4.3 Navigation/Deep Linking
- Main zu Detail: Delegiertes Click/Keyboard Handling auf `.detail-link` in `app.js`.
- Zurücknavigation Detail -> Main nutzt `history.back()` mit Fallback Link.
- Scroll-Position-Restore über `sessionStorage`.

**Risiken:**
- Event-Delegation ist robust, aber stark an Klassen/DOM-Struktur gekoppelt.

---

## 5. Component Review

## 5.1 Main-Komponenten (funktionale Module)
- `ScrollEngine`: Abschnitts-Progress + Reveal-Beobachtung.
- `WorldIndicator`: Kernanzeige World Index.
- `Charts`: Chart-Rendering (SVG/Canvas-Kontexte je nach Modul).
- `Maps`: Karte/Layer-Rendering inkl. Krisenlayer.
- `ParticleSystem`: visuelles Hintergrundsystem.
- `CounterManager`: Counter-Animationen.
- `CinematicScroll`: Scroll-gebundene visuelle Effekte.

**Wiederverwendbarkeit:** mittel bis hoch im Projektkontext; APIs sind module-intern stabil, aber nicht als externe Library abstrahiert.

**Mögliche Probleme:**
- Hohe Orchestrierungsdichte in `app.js` (Single-Controller mit sehr vielen Zuständigkeiten).
- Eine strukturelle Änderung kann mehrere Funktionen beeinflussen.

## 5.2 Detail-Komponenten
- `detail/detail-app.js` als Shell-Orchestrator.
- 29 Topic-Module in `detail/topics/` mit einheitlichem Contract:
  - `meta`
  - `render(blocks)`
  - `getChartConfigs()`
  - `cleanup()`

**Stärken:**
- Klarer Modulvertrag.
- Lazy Chart Loading per IntersectionObserver.

**Mögliche Probleme:**
- Teilweise statische/placeholderhafte Inhalte innerhalb der Topic-Module.
- Unterschiedliche Datenstrategien je Topic (nicht vollständig homogen).

---

## 6. Text & Content Inventory

## 6.1 Sichtbare Textebenen
1. **Statisches HTML** (`index.html`, `detail/index.html`) inkl. Labels, Legal/Footer.
2. **i18n-Katalog** (`js/i18n.js`) mit sehr großem Keyset (DE/EN + Detailkeys).
3. **Dynamische Strings in JS** (App/Topics), teils i18n-basiert, teils hardcoded.
4. **README/Architekturdokus** (nicht primär UI, aber inhaltlich wichtig für Betrieb).

## 6.2 Harte Textstrings (Beispiele)
- Rechtstexte/Impressum/Datenschutz direkt in `index.html`.
- Zahlreiche harte Default-/Fallbacktexte in Topic-Modulen (z. B. CO2, Space, Science etc.).
- Einige Placeholder in UI (z. B. Kartenplatzhaltertexte, statische Vergleichszahlen).

## 6.3 Wiederholte Inhalte
- Source-/Methodik-/Erklärungstexte sowohl im i18n-Katalog als auch in Topic-/Main-Modulen.
- Gefahr inkonsistenter Formulierungen zwischen Main- und Detailansichten.

## 6.4 SEO-relevante Inhalte
- `index.html` besitzt `<title>` + `meta description`.
- `detail/index.html` hat nur generischen Title („World.One - Detail“), wird erst clientseitig überschrieben.
  - **Risiko:** schwaches SEO für detail deep-links ohne SSR/prerender.

## 6.5 Inhalte, die dynamisch werden sollten
- Statische Zahlen in Vergleichsblöcken (z. B. 2000-vs-heute Elemente, Szenarien, einzelne Akt-Karten).
- Teilweise hartkodierte „Fallback-News“ und pseudo-live Platzhalter in Topics.

---

## 7. Data Source Review

## 7.1 Primärdaten (Mainseite)
- `data/processed/world-state.json` wird browserseitig geladen (network-first).
- Bei Fehler: localStorage-Cache (frisch oder stale).

## 7.2 Pipeline-Rohdaten
- Sammlung in `data/raw/{environment,society,economy,tech,realtime}`.
- Verarbeitet in `scripts/process-data.js`.

## 7.3 Cache-Daten (Detailseite)
- `data/cache/*.json` (z. B. `co2-history.json`, `ocean.json`, `disasters.json`, ...).
- Genutzt über `fetchTopicData(topic, apiUrl)` in Topics.

## 7.4 Statischer Fallback
- `data/fallback/static-values.json`: letzte Sicherheitsstufe pro Topic.
- Enthält viele numerische Ersatzwerte mit teils älterem Jahrgang.

## 7.5 Historische Daten / Timeline
- `data/history/manifest.json` + `data/history/snapshot-*.json`.
- Timeline in Mainseite kann LIVE und historische Snapshots laden.

## 7.6 Externe URLs / API-nahe Stellen
- Intensive API-Nutzung in `scripts/collect-data.js`.
- Zusätzlich direkte Runtime-Live-Calls in einigen Detailtopics (z. B. Weather, Solar, Earthquakes, Space, CO2 live attempt).

## 7.7 Hardcoded / Mock / Statisch / gecacht
**Hardcoded sichtbar im Prozess/Frontend:**
- Konflikt-Locations-Baselines, Refugee/Freedom-Baselines, Szenarien, diverse Vergleichswerte, einzelne source-lists.
**Gecacht:**
- Detaildaten via `data/cache`.
**Statisch:**
- `data/fallback/static-values.json`.
**Mock-/placeholderartig:**
- `_stub` Topic explizit als Test-/Platzhaltermodul.

---

## 8. Cached-to-Live-API Migration Candidates

> Ziel: klar priorisierte Kandidaten, wo aktuell cache/static dominiert und Live-API sinnvoll wäre.

## Kandidat A: Konflikte/Refugees/Freedom in `process-data.js`
- **Datei/Bereich:** `scripts/process-data.js` (society-build, Konflikt-/Refugee-/Freedom-Objekte).
- **Aktueller Zustand:** harte Baselines + teilweise Cache-Override.
- **Zielzustand:** deterministische Live-Adapter (mit Quellenpriorität + schema-validierung).
- **Risiko:** inkonsistente Qualitätsniveaus und sprunghafte Werte bei Quellenwechsel.
- **Migrationsweg:**
  1. Adapter-Layer je Quelle definieren.
  2. Score-Eingänge strikt von UI-Displaydaten trennen.
  3. „Data confidence“ pro Feld mitführen.

## Kandidat B: Szenarien (`worldState.scenarios`)
- **Datei/Bereich:** `scripts/process-data.js`, Szenario-Block.
- **Aktueller Zustand:** vollständig statisch (existing fallback/hardcoded).
- **Zielzustand:** versionierte Szenariodaten aus eigener Datenquelle/JSON-Pipeline.
- **Risiko:** Scheinpräzision und inhaltliche Alterung.
- **Migrationsweg:**
  1. `data/scenarios/scenarios.json` als erste externe Schicht.
  2. Danach optional API/Modellintegration.

## Kandidat C: Detailtopics mit statischen Fallbackzahlen
- **Datei/Bereich:** mehrere `detail/topics/*.js` + `data/fallback/static-values.json`.
- **Aktueller Zustand:** Topic-spezifische static defaults als letzte Instanz.
- **Zielzustand:** per-topic „freshness metadata“ + kontrollierte degradierte Darstellung.
- **Risiko:** veraltete Werte ohne klar sichtbare Frischewarnung.
- **Migrationsweg:**
  1. Ein einheitliches fallback-schema (`value`, `as_of`, `confidence`, `origin`).
  2. UI-Badges stärker an Staleness koppeln.

## Kandidat D: Realtime-Widgets Mainseite
- **Datei/Bereich:** `js/app.js` Realtime-Population.
- **Aktueller Zustand:** Mix aus liveähnlichen Daten, fallback arrays und statischen Labels.
- **Zielzustand:** nur aus `world-state.json` plus explizite „not available“ UI states.
- **Risiko:** Nutzer sieht evtl. Echtzeit-Anmutung bei statischem Fallback.
- **Migrationsweg:**
  1. Strict data contract für realtime-Felder.
  2. Keine stillen impliziten Defaultdaten im Rendering.

## Kandidat E: Chart.js CDN runtime load
- **Datei/Bereich:** `js/utils/chart-manager.js`.
- **Aktueller Zustand:** Runtime-CDN + fallback-CDN.
- **Zielzustand:** optional self-hosted chart bundle im Repo oder geprüfter pinning-mechanismus.
- **Risiko:** CDN-Ausfall/CSP/Netzrestriktionen.
- **Migrationsweg:**
  1. Chart.js lokal bereitstellen.
  2. Integrity/Version pinning + health check.

---

## 9. Stability Risks

## 9.1 Build
- Kein klassischer Web-Build; Browser lädt direkte Module.
- Pipeline-„Build“ ist datengetrieben (`collect`, `process`, `self-heal`, deploy).
- **Risiko:** Fehler in externen APIs wirken direkt auf Datenqualität.

## 9.2 Routing
- Query-routing für Detailseite robust durch allowlist.
- **Risiko:** Link-Mappings in Mainseite sind manuell; bei neuen Topics kann Inkonsistenz entstehen.

## 9.3 GitHub Pages Deployment
- Workflow deployt Root als artifact.
- **Risiko:** Pfadannahmen im SW/relative fetches müssen exakt zur Pages-Basis passen.

## 9.4 Broken Links
- Externe Source-Links zahlreich, keine zentrale regelmäßige Linkvalidierung im Workflow sichtbar.

## 9.5 Assets
- `assets/maps/world.svg` erforderlich für Kartenvisualisierungen.
- Bei Fehlen greifen teils Fallbacktexte, aber UX degradiert stark.

## 9.6 API-Ausfälle
- Collector nutzt Retry/Timeout, aber manche Datenbereiche landen dann auf alten/statischen Defaults.
- **Risiko:** stilles Degradieren ohne eindeutige Nutzerwarnung.

## 9.7 Responsive Layout
- Viele visuelle komplexe Bereiche (grids, maps, widgets, particles).
- **Unsicherheit:** ohne visuelle E2E-Tests nicht vollständig verifizierbar.

## 9.8 SEO
- SPA-artiges clientseitiges Rendering begrenzt SEO-Tiefe der Detailseiten.
- Detail-title wird erst nach JS-Load gesetzt.

## 9.9 Accessibility
- Positiv: mehrere aria-labels vorhanden.
- Risiko: viele interaktive Divs (role/link/tabindex) und komplexe visuelle Komponenten -> Keyboard/Screenreader-Flüsse sollten systematisch geprüft werden.

## 9.10 Performance
- Potenziell hohe Kosten: großes i18n-Objekt, Partikel (bis 1000), viele Charts/DOM updates.
- Timeline + dynamische Rebuilds können bei schwachen Geräten teuer werden.

---

## 10. Quality Baseline

Vor jeder Änderungsrunde sollten folgende Checks standardisiert ausgeführt werden:

1. **Install**
   - `npm ci` (oder `npm install` fallback)

2. **Lint**
   - Aktuell kein Lint-Script in `package.json`.
   - Empfehlung: ESLint-Check ergänzen (späterer Run).

3. **Typecheck**
   - Kein TypeScript vorhanden.
   - Empfehlung: JSDoc + optional `tsc --noEmit` mit checkJs als späterer Stabilitätsrun.

4. **Build/Process**
   - `npm run collect` (optional in lokalen Runs wegen externer APIs)
   - `npm run process`
   - `node scripts/self-heal.js`

5. **Tests**
   - Kein Testscript vorhanden.
   - Empfehlung: mindestens smoke tests für Loader/Processor hinzufügen.

6. **Link checks**
   - Kein automatischer Linkchecker sichtbar.
   - Empfehlung: externer Linkcheck auf source URLs im CI nightly.

---

## 11. Ten-Run Stabilization Roadmap

### Run 1 – Baseline & Reproducibility
**Ziel:** belastbare Ist-Baseline herstellen.
**Was wird analysiert/geändert:** keine Produktänderung, nur Baseline-Reports.
**Dateien/Bereiche:** package/scripts, workflow, world-state schema.
**Akzeptanzkriterien:** reproduzierbarer `process + self-heal` Lauf; dokumentierte Ausgangswerte.
**Risiken:** externe APIs liefern variierende Ergebnisse.
**Nachweis/Checks:** install, process, self-heal, schema-smoke.

### Run 2 – Routing & Navigation Integrity
**Ziel:** stabile Main<->Detail Navigation ohne Broken Topic Links.
**Was wird analysiert/geändert:** Mappings, allowlist, keyboard navigation.
**Dateien/Bereiche:** `js/app.js`, `detail/detail-app.js`, `detail/topics/*`.
**Akzeptanzkriterien:** jeder klickbare Datenpunkt führt deterministisch zu gültigem Ziel.
**Risiken:** Selektor-abhängige Brüche bei Layoutänderung.
**Nachweis/Checks:** automatisierte Topic-URL-Smokes + manual keyboard pass.

### Run 3 – Content & Textstring Normalization
**Ziel:** konsistente, i18n-konforme sichtbare Inhalte.
**Was wird analysiert/geändert:** harte Strings inventarisieren, Duplikate reduzieren.
**Dateien/Bereiche:** `index.html`, `js/i18n.js`, Topic-Module.
**Akzeptanzkriterien:** keine kritischen sichtbaren Hardcoded-Texte außerhalb definierter Ausnahmen.
**Risiken:** Regression in Übersetzungen.
**Nachweis/Checks:** i18n-key coverage report.

### Run 4 – Data Source Inventory & API Boundaries
**Ziel:** klare Trennung Score-Daten vs. Display-Daten vs. Fallback.
**Was wird analysiert/geändert:** Datendomänen und Vertrauensstufen definieren.
**Dateien/Bereiche:** `scripts/collect-data.js`, `scripts/process-data.js`, `data/cache`, `data/fallback`.
**Akzeptanzkriterien:** jedes Feld hat Herkunft, Freshness, Fallback-Regel.
**Risiken:** erhöhte Komplexität in Datenmodellen.
**Nachweis/Checks:** data-contract doc + validation script.

### Run 5 – Adapter Layer for Cache/Mock/Hardcoded
**Ziel:** harte Datenzugriffe in Adapter abstrahieren.
**Was wird analysiert/geändert:** Einführung konsistenter adapter functions.
**Dateien/Bereiche:** processor + detail data loader.
**Akzeptanzkriterien:** keine verstreuten direkten Hardcoded defaults ohne zentralen Adapter.
**Risiken:** kurzfristige Refactor-Risiken.
**Nachweis/Checks:** adapter unit-smokes, unchanged UI outputs.

### Run 6 – First Low-Risk Live API Integration
**Ziel:** risikoarme Quelle komplett auf live-first mit stabilem fallback migrieren.
**Was wird analysiert/geändert:** z. B. weather/solar/ocean subset.
**Dateien/Bereiche:** passendes Topic + cache updater + process mapping.
**Akzeptanzkriterien:** Live-Quelle nutzt validiertes schema, fallback sauber markiert.
**Risiken:** Rate limiting/API schema drift.
**Nachweis/Checks:** simulated outage tests.

### Run 7 – Loading/Error/Offline States
**Ziel:** konsistente degradierte Zustände über Main + Detail.
**Was wird analysiert/geändert:** loading placeholders, error messaging, stale badges.
**Dateien/Bereiche:** `js/app.js`, `detail/detail-app.js`, topic renderers, SW.
**Akzeptanzkriterien:** bei API/Cache-Ausfall keine leeren Blöcke ohne Kontext.
**Risiken:** visuelle Überladung durch Warnhinweise.
**Nachweis/Checks:** offline simulation, forced fetch failure.

### Run 8 – Performance, SEO, Accessibility Hardening
**Ziel:** messbare Verbesserungen in Lighthouse-Kernbereichen.
**Was wird analysiert/geändert:** particles tuning, chart lazy policies, meta/accessibility fixes.
**Dateien/Bereiche:** main/detail HTML, JS modules, CSS.
**Akzeptanzkriterien:** definierte Lighthouse/A11y Mindestwerte erreicht.
**Risiken:** Trade-off zwischen visueller Qualität und Performance.
**Nachweis/Checks:** Lighthouse profile + keyboard/screenreader smoke.

### Run 9 – Production/Pages/Env Hardening
**Ziel:** belastbarer Deploy auf GitHub Pages mit klaren Env-Regeln.
**Was wird analysiert/geändert:** workflow guards, cache busting, path checks.
**Dateien/Bereiche:** `.github/workflows/data-pipeline.yml`, `service-worker.js`.
**Akzeptanzkriterien:** deterministische Deploys, kein stale mismatch nach rollout.
**Risiken:** SW cache invalidation edge cases.
**Nachweis/Checks:** deploy dry-run + post-deploy sanity script.

### Run 10 – Final QA & Claude/Cloud Handover
**Ziel:** übergabefähiger, reproduzierbarer Betriebszustand.
**Was wird analysiert/geändert:** Enddokumentation, offene Risiken, Runbooks.
**Dateien/Bereiche:** Architektur-/Betriebsdokus + checklists.
**Akzeptanzkriterien:** neuer Agent kann Run 1..10 reproduzierbar ausführen.
**Risiken:** Wissensverlust bei unvollständiger Übergabe.
**Nachweis/Checks:** handover checklist pass + command matrix.

---

## 12. API Migration Strategy

## 12.1 API Client Layer
- Einheitliche Clients pro Daten-Domäne (`environmentClient`, `societyClient`, ...).
- Jeder Client liefert normalisierte DTOs, nie rohe API-Strukturen weiterreichen.

## 12.2 Environment Variables
- Secrets/API-Keys nur in CI (GitHub Secrets), nie im Frontend.
- Klare Konfiguration pro source (timeout, retry, enabled flag).

## 12.3 Fallback Cache
- Mehrstufig bleiben, aber schema-vereinheitlicht:
  - `live`
  - `cache` (+age)
  - `static` (+as_of)
- Jede UI-Komponente muss tier-aware rendern.

## 12.4 Error Handling
- Keine stillen Ausfälle ohne sichtbare Nutzerinformation in kritischen Bereichen.
- Fehlerklassifikation: network / parse / schema / stale.

## 12.5 Loading States
- Skeletons + eindeutiges Label („Livedaten“, „Cache“, „Statisch“).
- Timeouts mit user-freundlicher Retry-Option (Detailseite).

## 12.6 Rate Limits
- Backoff + jitter + source-specific throttling im Collector.
- Für runtime-live-calls in Topics: strict timeout + capped refresh.

## 12.7 Deployment Compatibility
- Pfadrobuste Fetch-Strategie für GitHub Pages Unterpfade.
- Service Worker Versioning + controlled rollback.

---

## 13. Recommended Next Prompt for Claude

Nutze diesen Prompt direkt als nächsten Schritt:

```text
Arbeite im Repository World.One_v2.0 und starte mit Stabilization Run 1 (Baseline & Reproducibility).

Ziele für Run 1:
1) Erstelle eine reproduzierbare Baseline-Dokumentation des aktuellen Zustands.
2) Führe nur Analyse und minimale nicht-funktionale Doku-Artefakte aus (keine Feature-Änderungen).
3) Erfasse alle aktuell verfügbaren npm scripts, workflow-Schritte und Datenflüsse von collect -> process -> self-heal -> deploy.
4) Führe die lokal möglichen Checks aus (install/process/self-heal, soweit ohne Seiteneffekte machbar) und dokumentiere Ergebnisse inkl. Fehler/Warnungen.
5) Definiere eine Baseline-Checkliste, die in allen folgenden Runs wiederverwendet werden kann.

Wichtige Regeln:
- Evidence-based, nichts erfinden.
- Unsicherheiten explizit markieren.
- Keine API-Migration umsetzen, nur Baseline vorbereiten.
- Gib am Ende einen klaren Run-1-Abschlussbericht mit: Ist-Zustand, Risiken, offene Fragen, Go/No-Go für Run 2.
```
