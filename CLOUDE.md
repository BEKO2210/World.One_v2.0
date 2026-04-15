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
| `128a48a` | ui consistency Schritt 1 | Population doppelter Zeit-Selector entfernt, 5 stale `data-target` in index.html synced, i18n 49→48 Quellen + 24→20 Indikatoren, `bio-threatened-count` live aus GBIF-Cache. |
| `8004900` | ui consistency Schritt 2 + SW | Alle 14 Main-Page-Counter haben stabile IDs + werden zentral live gebunden (`_syncLiveCounters`). Processor exponiert `biodiversity.threatenedTotal`, `population.totalMillions`. Service Worker: `updateViaCache:'none'`, periodische Update-Checks alle 30 min, auto-reload bei Controller-Wechsel, resilient-install mit `allSettled`. |
| `e06f6e2` | ui consistency Schritt 3 | Detail-Topic-Fallbacks auf aktuelle Live-Werte gehoben (biodiversity/endangered/extinction: 129753→130285; forests 31.2→31.14; renewables 29.6→19.7; temperature 1.45→1.19). crypto_sentiment.js liest jetzt Live-Cache (alternative.me) mit 30-Tage-Serie statt hardcoded. |
| `181d598` | ui consistency Schritt 4 | i18n bekommt globale Platzhalter `{currentYear}`, `{tempLatestYear}`, `{popLatestYear}`, `{freedomStreak}`. 5 zeitgebundene Strings (DE+EN) umgestellt. `_applyDynamicYears(data)` in app.js leitet Werte aus world-state ab und schiebt sie via `setGlobalParams()` ins i18n — alle `[data-i18n]`-Elemente re-rendern automatisch. SW v20260415-2305. |
| **HEAD** | ui consistency Schritt 5 | `supportsTimeRange` Audit: 3 stille Bugs gefixt. `timerangechange` wird jetzt auf `document` dispatcht (war auf sibling-block → 3 Topics stumm). `renewables.js` Case-Mismatch UPPERCASE→lowercase. `conflicts.js` hardcoded `2019`/`2004` → `currentYear - N`. Alle 5 Selektoren jetzt funktional. SW v20260415-2320. |

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

### ✅ Schritt 2 — HTML-Counter-Audit aller `data-target` + Service-Worker-Härtung

**Counter**: Neue zentrale Funktion `_syncLiveCounters(data)` in `js/app.js`
läuft als erstes im Populate-Pass. Alle 14 Counter haben jetzt eine stabile
`id` und werden live aus `world-state.json` befüllt. Initial-HTML-Targets
sind auf plausible aktuelle Werte gesetzt, damit der erste Paint nicht
springt. Processor exponiert dafür zusätzlich:
- `environment.biodiversity.threatenedTotal` (aus GBIF-Cache)
- `society.population.totalMillions` (Konvenienz für UI)
- `society.population.current` mit Fallback 8100000000

Gebunden: `co2-value`, `arctic-ice-value`, `ocean-plastic-value`,
`bio-threatened-count`, `population-value`, `life-expectancy-value`,
`refugee-counter-value`, `billionaires-value`, `extreme-poverty-value`,
`gdp-growth-value`, `internet-penetration-value`, `literacy-value`,
`github-commits-value`, `github-devs-value`.

**Service Worker**: deutlich robuster gemacht:
- `CACHE_VERSION` immer bump bei direkten Commits (Workflow bumpt automatisch).
- Install: `Promise.allSettled` statt `addAll` — ein einzelnes 404 blockt
  nicht mehr die ganze Installation.
- Activate: postet `SW_ACTIVATED` an offene Tabs.
- Neue Message-Listener: `SKIP_WAITING` erlaubt dem Page-Script, ein
  wartendes Worker-Update sofort zu aktivieren.
- Registration in `index.html` + `detail/index.html`:
  - `updateViaCache: 'none'` → Browser cached die SW-Datei selbst NIE.
  - `reg.update()` sofort + alle 30 min → lange offene Tabs bekommen neue
    Version ohne User-Reload.
  - Neu-Worker `installed` → `SKIP_WAITING` → `controllerchange` → einmaliger
    `window.location.reload()`. User sieht neue Version automatisch.
  - Reload-Dedup via `_reloaded` Flag, damit kein Loop entsteht.

### ✅ Schritt 3 — Detail-Topic Hero-Werte konsistent

**Phase A — Fallback-Zahlen in Detail-Topics auf aktuelle Live-Werte angehoben**
(wirkt wenn Live+Cache beide offline sind; sonst gewinnt Cache-Wert aus
gleicher Quelle wie Main-Page):

| Topic | Fallback alt → neu | Quelle |
|---|---|---|
| `biodiversity.js` | 129753 / 27358 / 48895 / 53500 → **130285 / 27454 / 49014 / 53817** | GBIF 2026-04 |
| `endangered.js`   | dieselben → **matched** | GBIF 2026-04 |
| `extinction.js`   | 129753 → **130285** | GBIF 2026-04 |
| `forests.js`      | 31.2 → **31.14** | World Bank AG.LND.FRST.ZS |
| `renewables.js`   | 29.6 → **19.7** (war sachlich falsch) | World Bank EG.FEC.RNEW.ZS |
| `temperature.js`  | 1.45 → **1.19** | NASA GISTEMP 2025 |

**Phase B — crypto_sentiment.js liest jetzt Live-Cache**:

- Neues `fetchTopicData('crypto_sentiment')` vor dem hardcoded 30-Tage-Fallback.
- Live-Serie (alternative.me → Server-seitig gecached → CORS umgangen)
  hat Vorrang. Tier + Age Badge an Hero übergeben.
- Fallback-Label-Mapping `_fgLabel(v)` wenn Cache nur numerische Werte liefert.
- `getChartConfigs()` konsumiert `_chartData.series` statt FG_HISTORY direkt,
  damit die gleiche Live-Serie im Chart landet.

**Nicht umgebaut (bewusst)**:

- `solar.js` Fallback 150 (SSN) / 3 (Kp): die Solar-Cycle-Daten variieren zyklisch,
  ein fester Zahlen-Fallback ist sinnvoll wenn NOAA ausfällt. Topic zieht bereits
  Live-Cache wo möglich.
- Die 6 Topics die `fetchTopicData` auf den gleichen Cache zeigen wie der Score
  (`forests`, `renewables`, `airquality`, `health`, `internet`, `conflicts`,
  `freedom`, `population`, `poverty`, `hunger`, `inequality`): Sync-Garantie ist
  bereits durch identische Quelle gewährleistet.

### ✅ Schritt 4 — Jahreszahlen & Zeitangaben dynamisch

i18n bekommt globale Platzhalter, die site-weit aus Live-Daten gefüllt werden:

**i18n-Erweiterung** (`js/i18n.js`):

- Neue Instanzvariable `_globalParams` mit Defaults aus dem Konstruktor:
  `{currentYear, tempLatestYear, popLatestYear, freedomStreak}`.
- Neue Methode `i18n.setGlobalParams(obj)` merged Werte und triggert
  `_applyToDOM()` — alle DOM-Strings werden neu gerendert.
- `t(key, params)` merged `_globalParams` mit Call-spezifischen params,
  nutzt `replaceAll()` (mehrere Vorkommen pro String möglich).

**i18n-Strings auf Platzhalter umgestellt** (DE + EN):

| Key | Vorher | Nachher |
|---|---|---|
| `act2.tempTitle` | `Temperaturanomalie 1880–2026` | `… 1880–{tempLatestYear}` |
| `act3.refugeeSource` | `Quelle: UNHCR 2026 — …` | `Quelle: UNHCR {currentYear} — …` |
| `act3.freedomDecline` | `19. Jahr in Folge … Freedom House 2026` | `{freedomStreak}. Jahr … {currentYear}` |
| `act4.gdpContext` | `Global 2026` | `Global {currentYear}` |
| `detail.population.year2026` | `2026: 8,1 Mrd` | `{currentYear}: 8,1 Mrd` |

**App-seitige Füllung** (`js/app.js`):

Neue Methode `_applyDynamicYears(data)` läuft nach `_syncLiveCounters`.
Leitet Kontextwerte aus `world-state.json` ab:

```js
{
  currentYear:    new Date().getFullYear(),
  tempLatestYear: latest(environment.temperatureAnomaly.history).year,
  popLatestYear:  latest(society.population.history).year,
  freedomStreak:  society.freedom.yearDecline
}
```

und schiebt sie via `i18n.setGlobalParams()` global durch. Das löst
automatisch ein Re-Render aller `[data-i18n]`-Elemente aus.

**Nicht angefasst (bewusst)**:

- Report-Jahre: `WWF Living Planet Report 2024`, `IRENA … 2024`,
  `WHO … 2021`, `Forbes … 2025`, `UNEP 2023` — das sind
  konkrete Publikationsreferenzen, nicht dynamisch.
- Historische Fixpunkte: `SDG-Ziel 2030`, `2000 vs 2023`,
  `13.2% (2000) auf 8.5% (2023)`, `Cycle 25 maximum 2024-2026` —
  bleiben statisch.
- `detail.population.explainP2` enthält `{currentYear} ist die Form
  zylindrisch` als Fließtext — könnte später auch dynamisch werden,
  aber Bedeutung ändert sich mit Datenalter (aktuell 2026-beschreibend).

### ✅ Schritt 5 — Detail-Topics `supportsTimeRange` Audit (mit harten Bugs)

Audit förderte **drei stille Bugs** zutage:

1. **Event-Dispatch auf falschem DOM-Target.**
   `detail-app.js setupTimeRange()` feuerte das `timerangechange`-Event auf
   `trendBlock` (`detail-trend`). Drei Topics (`freedom`, `poverty`, `science`)
   hatten den Listener aber auf `chartEl` (`detail-chart`) registriert, einen
   Geschwisterknoten von trend. CustomEvents bubbeln nicht seitwärts →
   **die Selektoren waren vollständig tot** (Button wurde visuell aktiv,
   Chart änderte sich nie). Fix: Event wird jetzt auf `document`
   dispatched, alle 5 Topics lauschen dort.

2. **Case-Mismatch in renewables.js.**
   detail-app emittiert lowercase `'1y'/'5y'/'20y'/'max'`. `renewables.js`
   prüfte UPPERCASE `'1Y'/'5Y'/'20Y'/'Max'` → keine Bedingung traf je zu
   → **Selector komplett tot**. Fix: alle range-Keys auf lowercase.

3. **Hardcoded Baseline-Jahre in conflicts.js.**
   5y-Filter war `d.year >= 2019` (korrekt für 2024, stale ab 2025),
   20y-Filter war `d.year >= 2004`. Fix: `currentYear - 5` /
   `currentYear - 20`.

Nicht angefasst (bewusst):

- `population.js` hat seit Schritt 1 `supportsTimeRange: false` und eigenen
  Pyramiden-Jahr-Selector — bleibt.
- `conflicts.js`, `freedom.js`, `poverty.js`, `renewables.js`, `science.js`:
  behalten `supportsTimeRange: true`, Selektor ist jetzt in allen funktional.
- Der Content-Bereich bleibt in sich schlüssig; die Button-Labels kommen
  via `i18n.t('detail.range.*')`, Platzhalter-Ersatz greift nicht
  (kurze Strings wie "1Y", "5Y", "Max").

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
