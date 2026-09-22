# HANDOFF — World.One v2.0 (Stand 2026-09-22, 20:00 UTC)

Übergabe von einer Claude-Code-Cloud-Session an die lokale Dev-Umgebung.
Vollständige Befunde und Roadmap: `AUDIT_ROADMAP.md`. Projektregeln: `CLAUDE.md`.

## Git-Stand
- Branch: `claude/website-audit-roadmap-e9q5ui`
- **PR #39 — gemergt:** SW-Doppel-Reload (Ladeanimation 2×) behoben, 3 leere Detail-Charts
  (forests, crypto_sentiment, solar) behoben, `AUDIT_ROADMAP.md` + `CLAUDE.md` angelegt.
- **PR #40 — offen (Draft):** Phase 1, Teil 1 (Datenwahrheit), 3 Commits:
  - `697ae2c` GDACS `MAP`→`SEARCH` (vorher immer HTTP 400), NOAA-Parser liest `departure`
    (vorher 0 Datensätze bei Ozean-SST und Temperatur).
  - `c40710d` neuer Cache `refugees.json` aus UNHCR Refugee Data Finder (keyless).
  - `db94969` `process-data.js`: ehrliche Quellenquote (war immer 100 %), Konflikt-Ratchet
    (`Math.max(…, existing)`) entfernt, Geflüchtete nicht mehr eingefroren, statischer
    Katastrophen-Fallback fließt nicht mehr in den Score. Neue additive Felder:
    `isFallback`, `isStatic`, `dataYear`.
- Lokaler Volllauf: Quellen 63/65 (97 %), World Index 66,2 → 65,4, alle Validatoren grün.

## Offene Entscheidung für Belkis
Katastrophen-Abzug im Environment-Score steigt von −3 auf −6 (2 laufende Orange-Fluten).
Formel unverändert: −1 pro laufendem Event, −2 pro laufendem Orange/Red, max. −10.
Ggf. Gewichtung anpassen (`scripts/process-data.js`, Block `disasterPenalty`).

## Nächste Schritte (Reihenfolge)
1. **Tier-Badges ehrlich machen** — Frontend liest die neuen Flags noch nicht:
   - `js/app.js` `_syncLiveCounters`/`findInd()`: `isFallback` → Badge „Schätzung/Fallback“,
     `isStatic` + `dataYear` → „Jahreswert <Jahr>“.
   - `detail/topics/weather.js:107` (LIVE vor dem Fetch; bei Fehler `fetchTopicData('weather')`),
     `space.js:121`, `momentum_detail.js:229`, `ocean_temp.js` (hartkodierter Hero-Wert),
     `conflicts.js:135` (Jahr aus `new Date()` statt Datenjahr).
2. **Hartkodierte Zahlen binden:** `js/i18n.js:97/1298` „Frei (83)“ → Platzhalter `{n}`;
   `index.html:283` Arktis `-46.2%`, `:407` pH `8.08`, `:589` Gini „42“ (ohne i18n),
   `:434` „8.1 Mrd“, `:538/544` 2781/648; `js/app.js:429/779` Fallback `'49'`.
3. **Datenmodell `dataAsOf` + `cadence`** für alle Indikatoren/Caches (Roadmap Phase 1, Punkt 1)
   und neuer Validator `scripts/validate-freshness.js` (≥ 30 Tage identischer „live“-Wert = Fehler).
4. Weitere tote Quellen: GDELT-Sentiment (429, Konstante −0,42), GitHub-Pulse hartkodiert
   (`process-data.js` ~Z. 1343), WAQI falsche Stationen (Geo-Koordinaten nutzen),
   `meta.json` eingefroren (`--job unified-v2` fehlt in `JOB_FILES`, `|| true` in
   `data-pipeline-v2.yml:141`).
5. Danach Phase 2 (XSS-Escaping in `js/app.js`, SW-Version nur bei Code-Änderung, History-Bloat).

## Lokal arbeiten
```
python3 -m http.server 8000                 # Seite
node scripts/collect-data.js                # ~5–8 min, schreibt data/raw (gitignored)
node scripts/cache-disasters.js             # einzelne Caches
node scripts/cache-environment-ext.js
node scripts/cache-society-ext.js
node scripts/process-data.js && node scripts/self-heal.js
for s in scripts/validate-*.js; do node "$s" || echo "FAIL $s"; done
```

## Stolperfallen
- **Keine Datendateien committen** (`data/cache`, `data/processed`, `data/history`): der
  Pipeline-Bot pusht alle 6 h auf `main` → sonst Merge-Konflikte. Nach lokalen Läufen:
  `git checkout -- data/ && git clean -fd data/`.
- SW-Registrierung ist in `index.html` **und** `detail/index.html` dupliziert — beide synchron halten.
- Beim Testen mit Playwright `serviceWorkers: 'block'` setzen, sonst greifen `page.route`-Mocks nicht.
- `js/i18n.js`: DE und EN immer gemeinsam ändern.
