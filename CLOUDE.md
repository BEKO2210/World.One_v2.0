# World.One_v2.0 — Aktueller Zustand & Roadmap

> Arbeitsdokument für Claude Code. Wird bei jedem größeren Commit aktualisiert. Die
> Datei ersetzt das frühere Architektur-Review — der alte "Full Codebase Review"-
> Text ist archiviert in `ARCHITECTURE.md` (Read-only Referenz).

---

## 1. Projektkern in 30 Sekunden

World.One ist eine Static-Site (GitHub Pages) mit:

- **Hauptseite** `index.html` — 15 Scroll-Sektionen (Prolog → Akte → Epilog).
- **Detail-Shell** `detail/index.html` mit 29 Topic-Modulen (`detail/topics/*.js`).
- **Zwei Pipelines als GitHub Actions** (entkoppelt, unterschiedliche Schedules):
  1. **data-pipeline.yml** (alle 6 h) — `collect-data.js` → `data/raw/` → `process-data.js` → `data/processed/world-state.json` → Deploy.
  2. **cache-pipeline.yml** (7 Jobs/Tag) — einzelne `cache-*.js` Skripte → `data/cache/*.json` für Detail-Pages und (seit Run 3) auch den Score.
- **Client-Loader** in `js/data-loader.js` (Haupt: `world-state.json`) und `js/utils/data-loader.js` (Detail: 3-Tier Live → Cache → Static).
- **Score-Architektur** (World Index 0-100): Carrying-Capacity-Prinzip V6. Gewichte
  Environment 25% · Society 25% · Economy 20% · Progress 20% · Momentum 10%.

---

## 2. Historie: jeder Commit seit Run-1-Baseline

| Commit | Kurztitel | Was |
|---|---|---|
| `47b4b63` | docs: Run 1 baseline | Baseline-Report, Validate-Runs dokumentiert. |
| `7c5f522` | Run 2 (Fehler-Fix + 10 Live-Caches) | fallback-schema 16→0 Fehler, processor/self-heal-contract geschlossen, `cache-live-data.js` (temperature, forests, renewables, airquality, weather, earthquakes, crypto_sentiment, science, space, health). |
| `c5ebceb` | routing run 2 + internet cache | Main-Page→Detail Nav-Audit, poverty+biodiversity neu verlinkt, A11y-Guard keydown, `validate-routing.js`, `internet.json`. |
| `b7392ca` | premium sources (FRED/WAQI/NewsAPI) | `cache-premium-sources.js` + Workflow-Job `update-premium-sources` (06:30 UTC), env-gated: fehlendes Secret → silent skip. |
| `f4d0fc4` | collector fixes | NASA Sea Level 404 → neuer Pfad, ReliefWeb 406 → GDACS-Ersatz, 6 tote RSS durch Google-News-Ersatz / `climate.gov/rss.xml`. |
| `0310a5d` | Run 3 cache-to-score | Score liest 14 statt 2 Caches, jeder der 25 scored indicators trägt `{fetchedAt, ageHours, source}`, `meta.cacheFreshness` emittiert, "aktualisiert vor Xh" Badge im UI, `validate-score-coverage.js`. |
| **HEAD** | ui consistency Schritt 1 | Population doppelter Zeit-Selector entfernt, 5 stale `data-target` in index.html synced, i18n 49→48 Quellen + 24→20 Indikatoren, `bio-threatened-count` live aus GBIF-Cache. |

---

## 3. Projektstruktur (Stand: HEAD)

```
World.One_v2.0/
├── index.html                    # Hauptseite, 15 Sektionen
├── manifest.json, service-worker.js
├── README.md                     # auto-generiert von generate-readme.js
├── ARCHITECTURE.md               # Ursprungs-Review (archiviert)
├── RUN1_BASELINE.md              # fortlaufende Run-Doku (1, 2, 3, …)
├── CLOUDE.md                     # ← DIESES Dokument
│
├── assets/                       # SVGs, World-Map
├── css/                          # core + components + sections + animations
│
├── js/
│   ├── app.js                    # Haupt-Orchestrator (BelkisOne Klasse)
│   ├── data-loader.js            # lädt world-state.json (network-first + localStorage)
│   ├── i18n.js                   # DE/EN Katalog (sehr groß)
│   ├── scroll-engine.js
│   ├── utils/
│   │   ├── badge.js              # Tier-Badge (live/cache/static)
│   │   ├── chart-manager.js      # Chart.js CDN-Loader
│   │   ├── data-loader.js        # Detail-Seiten 3-Tier Fallback
│   │   ├── dom.js, math.js
│   └── visualizations/           # charts, cinematic, counters, maps, particles,
│                                 #  world-indicator (rendert die 5 Sub-Score-Karten)
│
├── detail/
│   ├── index.html                # Detail-Shell
│   ├── detail-app.js             # Routing + Topic-Loading + generic 1y/5y/20y/max Selector
│   └── topics/                   # 29 Topic-Module (_stub ist Placeholder)
│
├── data/
│   ├── raw/                      # vom Workflow geschrieben, lokal meist abwesend
│   ├── processed/world-state.json# Score-Output, Hauptseiten-Quelle
│   ├── processed/heal-log.json
│   ├── cache/*.json              # 25 Files, von cache-*.js geschrieben
│   ├── fallback/static-values.json # letzte Fallback-Stufe für Detail-Topics
│   └── history/                  # Snapshots für Timeline
│
├── scripts/
│   ├── collect-data.js           # 48 Quellen → data/raw/
│   ├── process-data.js           # raw + cache → world-state.json (Score-Berechner)
│   ├── self-heal.js              # Integritäts-Checks + Auto-Repair
│   ├── generate-meta.js          # cache/meta.json Health-Rollup
│   ├── generate-readme.js        # README aus Live-Daten
│   ├── cache-biodiversity.js     # GBIF
│   ├── cache-disasters.js        # GDACS + Hunger (WB)
│   ├── cache-economy-ext.js      # currencies, inequality, poverty
│   ├── cache-environment-ext.js  # co2-history, ocean, solar
│   ├── cache-live-data.js        # 11 Quellen (temperature, forests, …, internet)
│   ├── cache-premium-sources.js  # FRED + WAQI + NewsAPI (env-gated)
│   ├── cache-progress-ext.js     # arxiv-ai, space-news
│   ├── cache-society-ext.js      # population, freedom, conflicts (+ACLED/UCDP)
│   ├── cache-utils.js            # fetchJSON/fetchText/saveCache (Envelope-Writer)
│   ├── validate-cache.js         # Cache-Schema + Workflow-Check
│   ├── validate-fallback.js      # Static-Fallback-Schema
│   ├── validate-routing.js       # Allowlist ↔ FS ↔ Mapping ↔ i18n + Tier-Coverage
│   └── validate-score-coverage.js# welche Caches fließen in den Score
│
└── .github/workflows/
    ├── data-pipeline.yml         # alle 6 h
    ├── cache-pipeline.yml        # 7 Jobs (03:00 … 06:30 UTC)
    └── deploy-only.yml
```

---

## 4. Score-Datenfluss (wichtig für alle weiteren Änderungen)

```
┌────────────────────────────────────────────────────────────────────┐
│                   DATA PIPELINE (alle 6h)                          │
│                                                                    │
│ collect-data.js ──► data/raw/{environment,society,economy,tech,    │
│                              realtime}/*.json                      │
│                            │                                       │
│                            ▼                                       │
│ process-data.js ────► data/processed/world-state.json              │
│                       ▲                                            │
└───────────────────────┼────────────────────────────────────────────┘
                        │ liest auch 15 Cache-Files (Run 3):
                        │
┌───────────────────────┴────────────────────────────────────────────┐
│                   CACHE PIPELINE (tägl. 7 Jobs)                    │
│                                                                    │
│ cache-*.js ──► data/cache/*.json   (25 Files mit _meta.fetched_at) │
│                                                                    │
│ Von process-data.js konsumiert (15): ocean, conflicts,             │
│   temperature, forests, renewables, airquality, waqi, disasters,   │
│   biodiversity, fred, freedom, health, news, internet, science.    │
│                                                                    │
│ Nur Detail-Seiten (10, bewusst):                                   │
│   arxiv-ai, co2-history, crypto_sentiment, currencies,             │
│   earthquakes, hunger, inequality, population, poverty, solar,     │
│   space, space-news, weather, meta.                                │
└────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────────┐
│ CLIENT                                                             │
│   js/data-loader.js   lädt world-state.json (Hauptseite)           │
│   js/utils/data-loader.js  3-Tier: Live → cache/*.json → fallback  │
│                                                                    │
│ UI:                                                                │
│   world-indicator.js rendert 5 Sub-Score-Karten + "aktualisiert    │
│     vor Xh" Badge aus meta.cacheFreshness (seit Run 3).            │
└────────────────────────────────────────────────────────────────────┘
```

### Invarianten, die NIE verletzt werden dürfen

- `data/processed/world-state.json` **muss** nach jedem `process + self-heal`
  validieren (alle 5 Sub-Scores mit `value, weight, indicators` belegt;
  Weights summieren zu 1.0; worldIndex.zone konsistent mit value).
- Jede Änderung am Score-Modell erzeugt einen neuen Snapshot in `data/history/`
  (Timeline-Feature braucht kontinuierliche Historie).
- Cache-Files dürfen nie ohne `_meta.fetched_at` geschrieben werden
  (`saveCache()` in `cache-utils.js` kümmert sich).
- Kein neuer User-Secret ohne env-gated Skip-Logik (siehe
  `cache-premium-sources.js` als Muster).

---

## 5. UI-Konsistenz Roadmap (nächste Schritte)

Ziel: **alle sichtbaren Zahlen/Zeitangaben auf der Site stimmen mit Live-Daten
überein**, doppelte oder veraltete UI-Elemente sind raus. User-Regel: immer safe,
immer reversibel, Site ist aktiv in Nutzung.

### ✅ Schritt 1 — HEAD-Commit (fertig)

- Population: `supportsTimeRange: false` → Pyramide hat nur noch einen Zeit-Selector.
- `index.html` data-target Synchronisation:
  - `prolog-sources` 49 → 48, `sources-total` 49 → 48.
  - Momentum-Counter 14 / 20 → 16 / 20 (Initial-HTML matched jetzt Live-Wert).
  - Epilog-Score 47.3 → 62.6 (Initial-HTML matched aktuellen World Index).
  - Refugee-Counter 123 000 000 → 108 400 000 (Initial-HTML matched world-state).
- i18n DE+EN: "49 Quellen" → "48", "24 Indikatoren" → "20 Schlüsselindikatoren".
- `scripts/process-data.js`: neuer `biodiversityCache` → `environment.biodiversity.threatenedTotal` fließt in world-state.
- `js/app.js`: `#bio-threatened-count` wird jetzt live aus env.biodiversity.threatenedTotal synchronisiert.

### 🔜 Schritt 2 — HTML-Counter-Audit aller 15 verbleibenden `data-target`

Je Eintrag: (a) prüfen ob JS bereits live-überschreibt; (b) wenn nein, Bindung
in app.js ergänzen; (c) Initial-HTML auf aktuellen Wert aus world-state setzen.

- Line 236 CO2 `data-target="421"` → soll env.co2.current binden.
- Line 276 Arktis-Eisfläche `4.2 Mio km²` → soll env.arcticIce.current binden.
- Line 401 Ocean Plastic `170 Mio t` → soll env.ocean.plasticTotal (wenn existiert).
- Line 424 Weltbevölkerung `8200 Mio` → soll society.population.total binden.
- Line 434 Life Expectancy `73.6 J.` → soll society.lifeExpectancy.global binden.
- Line 521 Billionaires `2781` → soll economy.wealth.billionaires binden.
- Line 527 Extreme Poverty `648 Mio` → soll society.poverty.people_m.
- Line 544 GDP Growth `3.1%` → soll economy.gdpGrowth.global.
- Line 622 Internet `67.4%` → progress.internet.current.
- Line 627 Literacy `87.4%` → progress.literacy.current.
- Line 657, 661 GitHub `142 Mio / 120 Mio` → progress.github metrics.

### 🔜 Schritt 3 — Detail-Topic Hero-Werte konsistent

Für jedes der 29 Topics prüfen: stimmt der Hero-Wert mit dem Main-Page-Counter
überein? Bei Abweichung: beide aus der gleichen Quelle (`environment.X` oder
entsprechender Cache) lesen, kein Topic pflegt eigene Default-Baselines mehr
ohne klaren Staleness-Marker. Kandidaten:

- `biodiversity.js` (129753) vs new 130285 live.
- `temperature.js` Hero vs. Main `#temp-anomaly-value`.
- `forests.js` Hero vs. Main `#forest-value`.
- `renewables.js` Hero vs. Main `#renewable-value`.
- `population.js`, `conflicts.js`, `health.js`, …

### 🔜 Schritt 4 — Jahreszahlen & Zeitangaben

- i18n "18. Jahr in Folge" (Freedom-Index) → soll Jahr aus Daten ableiten.
- `act2.tempTitle` "1880-2026" → dynamisch via JS setzen basierend auf letztem
  temperature.history-Eintrag.
- i18n "25 Jahre Veränderung" (Vergleichs-Block) → statisch OK (2000 vs heute).
- Pro Topic: Hero-Labels mit Jahr prüfen (meist Format "Stand 2024").

### 🔜 Schritt 5 — Detail-Topics `supportsTimeRange` Audit

Für die 6 Topics die den Flag setzen (conflicts, freedom, population (jetzt
false), poverty, renewables, science): funktioniert der generische 1y/5y/20y/max
Selector tatsächlich sinnvoll? Wenn nicht → supportsTimeRange: false
(wie population) und eigenen Selector rendern oder weglassen.

### 🔜 Schritt 6 — Visuell kosmetisch ohne Risiko

- Konsistente Typographie für "aktualisiert vor Xh" Badges (Run 3 hat sie für
  Sub-Scores gerendert — gleichen Style für Topic-Hero-Tier-Badges verwenden).
- Einheitliche Tier-Badge (live/cache/static) Darstellung über alle 29 Topics.
- Skeleton-Loader-Konsistenz: einheitliche Padding/Höhe vor Live-Render.
- Hover-Tooltips auf Counter-Werten: "Quelle: X · aktualisiert: Y".

### 🔜 Schritt 7 — Accessibility-Sweep

- Alle interaktiven Divs mit `role="link" tabindex="0"` auch `aria-label` geben.
- Keyboard-Fokus-Stil sichtbar (outline) — prüfen ob `css/core.css` dafür
  Regeln hat.
- Screen-Reader-Text für reine Icon-Buttons (Back-to-Top, Share, Lang-Toggle).

### 🔜 Schritt 8 — Performance

- Particles-System: Reduktion auf schwachen Geräten (Mediaquery
  `prefers-reduced-motion` schon vorhanden? prüfen).
- Chart.js Lazy-Load: bereits per IntersectionObserver — OK, nur Audit.
- i18n.js ist groß (~2000 Zeilen) — evtl. per Sprache splittable. Niedrige Prio.

### 🔜 Schritt 9 — Dokumentation & Übergabe

- `ARCHITECTURE.md` als archivierte Referenz markieren.
- `CLOUDE.md` bleibt das lebende Dokument.
- `RUN1_BASELINE.md` → `RUNS.md` (alle Run-Reports zusammenfassen).
- Runbook für neue Quelle hinzufügen (Secret registrieren → Cache-Skript →
  Workflow-Job → Processor-Integration → Validator).

---

## 6. Arbeitsregeln für folgende Änderungen

1. **Immer Schritt für Schritt**, ein Thema pro Commit.
2. **Nichts Risikoreiches ohne Confirm**: `git reset --hard`, `push --force`,
   Schema-Änderungen an `world-state.json` (außer rein additiv).
3. **Jeder Commit schließt mit allen Validatoren grün ab**:
   ```
   node scripts/process-data.js
   node scripts/self-heal.js
   node scripts/validate-cache.js
   node scripts/validate-fallback.js
   node scripts/validate-routing.js
   node scripts/validate-score-coverage.js
   ```
4. **Änderungen an i18n.js immer DE + EN parallel.**
5. **CLOUDE.md wird nach jedem Run-Commit aktualisiert** (Historie-Tabelle in §2
   ergänzen, ggf. Roadmap-Status ✅/🔜 verschieben).
6. **Keine Doppeldaten**: ist ein Wert in `world-state.json`, dann darf Topic
   ihn nicht separat hartkodieren — immer aus der gleichen Quelle lesen.

---

## 7. Offene Fragen für den Betreiber

- ReliefWeb appname registrieren? (würde v2-API unblocken → reichhaltigere
  Disaster-Feeds neben GDACS).
- GitHub PAT für erhöhtes Rate-Limit (60/h → 5000/h) bei `fetchGitHubActivity`?
- UCDP Token (keyless reicht aktuell, aber Token gäbe höhere Limits).
- Soll `supportsTimeRange` komplett in den Topic-Vertrag übernommen werden
  (d.h. die Detail-Shell baut den Selektor nur wenn Topic das aktiv fordert)?
  Aktuell macht es das — wir haben nur die Meta-Default-Semantik geändert.
