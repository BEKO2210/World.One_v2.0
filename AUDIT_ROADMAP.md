# World.One — Audit & Roadmap „Next Level“ (Stand 2026-09-22)

> Ergebnis eines Audits durch 5 parallele Fach-Agenten (Frontend-QA Hauptseite,
> Frontend-QA Detailseiten, Data Engineering, UI/UX & Dataviz, Performance/PWA/
> SEO/A11y/Security). Alle Befunde wurden im Browser (Playwright/Chromium,
> 1440 px + 390 px) oder per Code-Review erhoben. Konfidenz: **[C]** = belegt,
> **[L]** = starke Indizien, **[G]** = Annahme.

---

## 0. Die unbequeme Wahrheit zuerst

**Das größte Problem ist nicht die Optik, sondern die Datenehrlichkeit.** [C]
Jedes `fetchedAt`/`ageHours` ist der Zeitpunkt des Pipeline-Laufs, nicht das Alter
der Daten. Dadurch tragen eingefrorene, hartkodierte oder Jahre alte Werte dasselbe
„LIVE · vor 0 h“-Badge wie echte Live-Daten. Die Quellenquote wird rechnerisch
immer auf 65/65 = 100 % gesetzt. Für eine Daten-Website ist Vertrauen das Produkt:
**Phase 1 (Datenwahrheit) muss vor jedem visuellen Redesign kommen.** Ein
schöneres Design auf falschen Zahlen macht den Schaden nur sichtbarer.

---

## 1. Bereits in diesem PR behoben

| # | Bug | Ursache | Fix | Verifiziert |
|---|---|---|---|---|
| 1 | **Ladeanimation erscheint 2×** | Beim Erstbesuch `skipWaiting()` + `clients.claim()` → `controllerchange` → bedingungsloses `location.reload()` (`index.html`, `detail/index.html`) | Erster Controller-Wechsel wird als Baseline übernommen; echte Updates laden erst neu, wenn der Tab im Hintergrund ist | Playwright: vorher 2 Navigationen, jetzt 1; Update-Fall: 0 Reloads sichtbar, 1 Reload bei `hidden` |
| 2 | 3 Detail-Charts bleiben leer (forests Ursachen, crypto_sentiment Verlauf, solar Zyklus 25) | `blockId: 'trend'`/`'chart'` existieren nicht, solar ohne `blockId` | Echte IDs `detail-trend`/`detail-chart`, Warnung bei fehlendem Block, `.catch` bei Chart.js-Ladefehler | Playwright: vorher 3× `EMPTY`, jetzt alle `drawn` |

---

## 2. Befundliste (priorisiert)

### 2.1 Kritisch / Hoch — Daten „live“, die nicht live sind [C]

| Indikator | angezeigt als | tatsächlich | Ursache |
|---|---|---|---|
| Aktive Katastrophen (fließt in Score) | GDACS, 0 h | statische Liste mit falschen Jahren | GDACS-Aufruf `MAP?eventlist=EQ,TC,…` → HTTP 400 (`collect-data.js:873`, `cache-disasters.js:23`). Richtig: `geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;DR;WF` |
| Aktive Konflikte = 59 | Cache 0 h, „(2026)“ | `static_fallback`, kann nur steigen | ACLED/UCDP 401; `Math.max(…, existing, 59)` (`process-data.js:681`); Jahr = `new Date()` (`conflicts.js:135`) |
| Geflüchtete 108,4 Mio | UNHCR | Stand Ende 2022 (real ~117–123 Mio) | `existing ||` friert Wert ein (`process-data.js:697`) |
| Freiheit 84/56/55 | Freedom House 0 h | eingefroren; UI zeigt sogar 83 (i18n hartkodiert) | `process-data.js:720`, `i18n.js:97/1298` |
| News-Sentiment −0,42 | LIVE | Konstante seit 15.03. | GDELT 429 + Parser |
| GitHub Global Pulse | LIVE | hartkodiert (`process-data.js:1343`), Kachel „0K+“ | — |
| Ozean-SST | NOAA | `annual_sst_anomaly: []` | Parser liest `anomaly`, API liefert `departure` (`cache-environment-ext.js:66`, `collect-data.js:810`) |
| Temperatur 1,19 °C | 0 h | Jahreswert, NOAA-Monatsdaten leer | gleicher Parser-Bug |
| Erneuerbare 19,74 % | 0 h | WB-Jahreswert 2020 | Quelle veraltet |
| Luftqualität | WAQI | 4/19 Städte falsche Station (Karachi→Delhi, Lagos→Kanaren, Kairo→Israel) | Stadtname statt Geo-Koordinate |
| Wechselkurse | Detailseite | Chart hartkodiert (EUR/USD 0,91), aktueller Wert 0,872 liegt außerhalb der fixen y-Achse; Label invertiert | `currencies.js:18/397` |
| ISS-Crew | LIVE | Crew von 2024 hartkodiert | `space.js:36-44`, Badge `space.js:121` |
| Wetter | LIVE-Badge vor dem Fetch | bei Ausfall 24× „Nicht verfügbar“ + „0 Warnungen“, Cache ungenutzt | `weather.js:107` |
| Quellenquote | 65/65 = 100 % | tatsächlich 47/48 | `process-data.js:1074` addiert Cache-Dateien |
| `meta.json` | Health-Rollup | seit 15.04. eingefroren | `--job unified-v2` fehlt in `JOB_FILES`, `|| true` verdeckt Exit 1 (`data-pipeline-v2.yml:141`) |

**Umgekehrt:** CO₂ (Monatswert), Erdbeben, FRED, WAQI und Open-Meteo sind wirklich live, gehen aber im
Einheitsbadge unter. Die Wärmestreifen nutzen immer `ANNUAL_ANOMALIES` statt Cache (`temperature.js:202`). [C]

### 2.2 Methodik- und Einheitenfehler [C/L]
- FAO-Food-Price-Index mischt Basisjahre 2002–04 und 2014–16 → Scheinabsturz 171 → 98 [L].
- `progress.publications.history` enthält für 2021–25 Internet-Prozentwerte [C].
- Inflation mittelt Welt-WB mit US-CPI [C]; AQI mischt US- und EU-Skala [C].
- Armut: drei verschiedene Werte (8,5 % / 648 Mio / 10,4 %), noch $2.15-Linie statt $3.00 (seit Juni 2025) [C/L].
- Momentum-Detail: Hero ▲17/►6/▼4, Balken 13/6/8; Sparklines sind generierte Kurven, keine Daten [C].
- Erdbeben: M4.5+-Wert wird als „M2.5+“ beschriftet [C]. Ozean-Plastik: 11 Mio t/Jahr ≠ 23 Mio kg/Tag [C].

### 2.3 Frontend-Bugs [C]
- Hartkodierte Zahlen ohne Datenbindung: Arktis `-46.2%` (`index.html:283`), pH `8.08` (`:407`), Gini „42“ (`:589`, ohne i18n), Milliardäre 2781 (`:538`), „65 Quellen“ (`i18n.js:8`), Fallback `'49'` (`app.js:429`).
- Momentum-Indikatornamen bleiben in EN deutsch (`app.js:1036-1049`).
- Timeline: fehlende Null-Checks (`app.js:1413-1442`), `_initTimeline()` ohne `await`/`.catch` (`app.js:76`).
- Zurück-Button auf Detailseite führt bei Direkteinstieg aus der Seite (`detail-app.js:159`, `history.length > 1`).
- `_stub` öffentlich routbar, zeigt rohen i18n-Key (`detail-app.js:25`).
- Doppeltes Escaping zeigt `&amp;` (`earthquakes.js:297`, `conflicts.js:369`).
- Listener auf Block statt `document` feuern nie (biodiversity, co2, forests, population, temperature).
- Viele i18n-Lücken (Tipping Points, Disasters, Kacheln) und DE-Zahlenformat in der EN-Ansicht.

### 2.4 Security [C]
- **XSS-Risiko:** externe Daten per `innerHTML` ohne Escaping (`app.js:443, 651, 727, 745, 1048-1050, 1095-1099`); `space.js:430` setzt `href` ohne Schema-Prüfung (`javascript:` möglich); `escapeHTML` escapt kein `'`.
- Keine CSP, Chart.js ohne SRI (`chart-manager.js:22-24`).
- Actions auf Tags statt SHA gepinnt; `contents/pages/id-token: write` für den ganzen Workflow; `pull --rebase -X theirs` kann fremde Commits überschreiben; `upload-pages-artifact path: '.'` veröffentlicht `.planning/`, `scripts/` und alle MD-Dateien.

### 2.5 Performance / PWA / Repo [C]
- Pipeline setzt bei **jedem** Datenlauf eine neue SW-Version → offene Tabs laden ~4×/Tag neu und cachen alle Assets neu.
- SW cacht auch 404/500-Antworten unter `/data/` ohne Limit; offline unbehandelte Rejection (`service-worker.js:96-118`).
- Partikel: ~50 % Main-Thread-CPU im Leerlauf, auch wenn der Prolog nicht sichtbar ist (`particles.js:19,114`).
- `data/history`: 784 Dateien / 97 MB, ~180 MB/Jahr, keine Bereinigung; `manifest.json` (62 KB) wird bei jedem Besuch geladen.
- `i18n.js` 147 KB (beide Sprachen immer geladen), `world.svg` 151 KB, Unsplash-Bild extern.
- Keine Tests, kein Linter, keine PR-Checks.

### 2.6 Design / UX [C/L]
- Widersprüchliche Zahlen & Formate (CO₂ 428 vs. 427.6; „7.8“ neben „4,2“).
- `--text-muted #5a5a65` = 2,9:1 → WCAG-AA-Fehler (`css/core.css:11`); Temperatur-Hero ~1,5:1.
- Mobil verdecken 3 FABs (Uhr, Scroll-Top, Sprache) Inhalte.
- Leere Blöcke ohne Empty-State (Erdbeben-Histogramm, Ozean-Chart, Internet-Trend, Gini-Karte).
- 366 Hex-Literale, keine Datenfarb-Tokens, kein Light Mode.
- Konfliktkarte färbt Flächen (Russland dominiert), Wärmekarte fast einfarbig rot.
- Keine Webfont (System-Fallback), Hero ohne Aussage („100 % Erfolgsrate“).
- Hauptseite 26 000 px (Desktop) / 29 000 px (mobil) lang — zu viele Kacheln pro Akt.

### 2.7 SEO / A11y [C]
- Fehlen: `robots.txt`, `sitemap.xml`, `canonical`, OG/Twitter-Tags, JSON-LD, Favicon, `meta description` auf Detailseiten.
- axe: `aria-required-children` (4×), `color-contrast` (8×), `#global-news` nicht fokussierbar, Detailseite ohne `<h1>`, Nav-Dots sind `div role=button`.

---

## 3. Roadmap

### Phase 1 — Datenwahrheit (Woche 1–2) · höchste Priorität
Ziel: Jede Zahl sagt ehrlich, **wie alt** sie ist und **woher** sie kommt.

1. **Datenmodell erweitern** (additiv, rückwärtskompatibel): jeder Indikator/Cache bekommt
   `dataAsOf` (Datum/Jahr der Messung), `retrievedAt` (Abruf), `tier` (`live|cache|fallback|static`),
   `cadence` (`realtime|daily|monthly|annual`). Badge rendert nach `dataAsOf` + `cadence`
   („Jahreswert 2024“, „Monatswert Aug 2026“, „live · vor 12 min“).
2. **Kaputte Collectoren reparieren:** GDACS-URL, NOAA-`departure`-Parser, GDELT mit Backoff,
   WAQI per `geo:lat;lng` mit Distanzprüfung, `JOB_FILES` für `unified-v2`.
3. **`existing ||`-Einfrieren und `Math.max`-Sperre entfernen:** Fallback nur mit Alterslimit
   und `tier: 'fallback'`.
4. **Ehrliche Quellenquote:** nur echte Erfolge zählen; leere Ergebnisse = Fehler.
5. **Tier-Badges aus der tatsächlich genutzten Quelle** (weather, space, momentum_detail, ocean_temp, conflicts).
6. **Alle hartkodierten Frontend-Zahlen binden** (Liste 2.3 + `index.html:434/538/544`,
   `conflicts.js:98`, `currencies.js`, `crypto_sentiment.js:33`, `health.js:95`).
7. **Neuer Validator `validate-freshness.js`:** bricht ab, wenn ein als `live`/`daily` markierter Wert
   ≥ 30 Tage identisch ist oder `dataAsOf` älter als 3× `cadence`.

**Definition of Done:** kein Wert mit Badge „live“, dessen `dataAsOf` älter als seine Kadenz ist; Quellenquote = realer Wert.

### Phase 2 — Sicherheit & Pipeline-Hygiene (Woche 2–3)
1. XSS: überall `_esc()`, URL-Allowlist `https?:`, Sanitizing zusätzlich in der Pipeline.
2. CSP-Meta + SRI für Chart.js; Inline-Skripte in eigene Dateien.
3. Workflows: gemeinsame Concurrency-Gruppe `data-write`, `exit 1` nach letztem Push-Fehlversuch,
   Actions auf SHA pinnen, Rechte pro Job, Deploy aus einem `dist/`-Verzeichnis statt `.`.
4. **SW-Version nur bei Code-Änderung** (Hash über `js/ css/ *.html`), Daten laufen ohnehin network-first;
   `response.ok`-Check und Cache-Limit für `/data/`.
5. `data/history` ausdünnen: täglich statt 6-stündlich, Delta-Snapshots (~2 KB), > 30 Tage → Monats-Archiv
   als gzip in einem `data`-Branch oder Release; Manifest paginieren.
6. **CI für PRs:** `node --check`, ESLint, alle `validate-*.js` als Fail-Gate, Playwright-Smoke-Test
   (jede Seite: 1 Navigation, keine Konsolenfehler, alle Canvas gezeichnet, kein `NaN/undefined` im DOM).

### Phase 3 — Design-System & Konsistenz (Woche 3–5)
1. **Token-System in 3 Ebenen:** Primitives → Semantic (`--surface-1..3`, `--text-1..3`) → Data
   (`--series-co2`, `--seq-*`, `--div-*`), geteilt zwischen Haupt- und Detailseiten; Light Mode über
   `prefers-color-scheme` + `[data-theme]`.
2. Kontrast: `--text-muted` ≥ `#8a8a96`; Farbskala auf dunklem Grund mit Mindestkontrast 4,5:1.
3. **`js/utils/fmt.js`** mit `Intl.NumberFormat(lang)` + einheitlicher Rundungsregel — ersetzt alle ad-hoc-Formatierungen.
4. Webfont: Inter (Text) + `font-variant-numeric: tabular-nums` für Zahlen, selbst gehostet.
5. Einheitliche Komponenten: `kpi-card`, `source-chip` (Quelle · Stand · Tier · Methodik-Link), `empty-state`.
6. Mobil: FABs zu einer Bottom-Bar zusammenfassen (`safe-area-inset`), Index-Ringe als 2×3-Grid.
7. i18n-Lücken schließen, `i18n.js` in `i18n/de.json` + `i18n/en.json` splitten und lazy laden.

### Phase 4 — Dataviz & Storytelling (Woche 5–10)
1. **Chart-Standard:** schrittweise Migration von Chart.js auf **Observable Plot** (SVG, token-fähig,
   Annotationen eingebaut), D3 nur für Sonderfälle. Regeln: direkte Beschriftung statt Legende, eine
   Kern-Annotation pro Chart, Achsen mit Einheit, Quellzeile unter jedem Chart.
   *Nicht als Big Bang* — pro Topic migrieren, Smoke-Test sichert ab.
2. **Karten:** Konflikte als proportionale Kreise statt Flächen, Choropleth mit Quantil-Klassen und
   divergierender Palette, Projektion Equal Earth.
3. **Scrollytelling mit Sticky-Graphic** pro Akt (3–4 Textschritte): Klima (Stripes → CO₂ → 1,5 °C),
   Wirtschaft (Top-1 % vs. untere 50 %), Gesellschaft (Flow-Map Flucht).
4. **Pro Akt maximal:** 1 Hero-Chart, 3 KPIs, 1 Karte; Tiefe auf die Detailseiten verlagern.
5. **Hero neu:** starke Headline („66 von 100.“ + Einordnung + Trend) statt Typewriter.
   Optional später: 3D-Globus (globe.gl), lazy, mit statischem Fallback — **erst nachdem** die
   Partikel-CPU-Last behoben ist [G, Performance vorher messen].

### Phase 5 — Reichweite & Performance (parallel ab Woche 4)
1. SEO: OG/Twitter-Cards, `robots.txt`, `sitemap.xml` mit allen `?topic=`-URLs, JSON-LD (`Dataset`, `WebSite`),
   Favicon; Detailseiten vorab rendern (statische `detail/<topic>/index.html` mit Titel/Description).
2. Partikel: max. ~300, 30 fps, per IntersectionObserver pausieren.
3. Bilder selbst hosten (AVIF/WebP), `world.svg` optimieren/lazy.
4. A11y: axe-Befunde beheben, Nav-Dots als `<button>`, `<h1>` auf Detailseiten.
5. Public API (`PUBLIC_API.md`) mit `dataAsOf`/`tier` dokumentieren — macht World.One als Datenquelle zitierbar.

---

## 4. Bessere Datenquellen (Phase 1–2)

| Bereich | heute | Empfehlung |
|---|---|---|
| Temperatur | NOAA (Parser-Bug) | Copernicus C3S Climate Pulse (täglich, ERA5) oder NOAA NCEI mit `departure` |
| Arktis-Eis | hartkodiert 4,2 | NSIDC Sea Ice Index v3 (tägliche CSV) |
| Konflikte | ACLED/UCDP 401 | ACLED-Key als Secret oder UCDP Candidate (monatlich, Token) |
| Flucht | eingefroren 2022 | UNHCR Refugee Data Finder API (`api.unhcr.org/population/v1`) |
| Erneuerbare/Energie | WB 2020 | Our World in Data Grapher-CSV bzw. Ember (Strom 2024/25) |
| Emissionen | — | Global Carbon Budget |
| Armut/Hunger/SDG | 3 widersprüchliche Werte | WB PIP API ($3.00-Linie) + UN SDG API |
| Luftqualität | WAQI per Stadtname | WAQI `geo:lat;lng` oder OpenAQ v3, Median, eine Skala |
| Katastrophen | GDACS 400 | GDACS `SEARCH`-Endpoint |
| ISS-Crew | hartkodiert 2024 | Launch Library 2 (`astronaut/?in_space=true`) |
| COVID | disease.sh eingefroren | entfernen bzw. WHO Disease Outbreak News / OWID |

---

## 5. Erfolgskriterien

| KPI | heute | Ziel |
|---|---|---|
| Werte mit ehrlichem `dataAsOf` | 0 % | 100 % |
| Eingefrorene „live“-Werte | ≥ 8 | 0 (Validator erzwingt) |
| Navigationen pro Erstbesuch | 2 → **1 (behoben)** | 1 |
| Ungewollte Reloads offener Tabs/Tag | ~4 | 0 (nur bei Code-Deploy, im Hintergrund) |
| Leere Charts auf Detailseiten | 3 → **0 (behoben)** + 3 leere Blöcke | 0, sonst Empty-State |
| WCAG-AA-Kontrastfehler (axe) | 8+ | 0 |
| Leerlauf-CPU Hauptseite | ~50 % | < 5 % |
| `data/history` Wachstum | ~180 MB/Jahr | < 10 MB/Jahr |
| PR-Checks | keine | Lint + Validatoren + Playwright-Smoke |
