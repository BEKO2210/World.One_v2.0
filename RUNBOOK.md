# World.One — Runbook für häufige Ops-Aufgaben

Praktische Schritt-für-Schritt-Anleitungen für die wichtigsten
Operationen. Gedacht als Referenz für Maintainer, die **nicht jedes
Mal den ganzen Code neu lesen wollen**.

---

## 1. Neue Live-Daten-Quelle hinzufügen

### Case A — Quelle ist keyless (z.B. World Bank, NOAA, USGS)

**Beispiel**: hinzufügen eines neuen Welt-Bank-Indikators (z.B.
Gesundheitsausgaben pro Kopf, `SH.XPD.CHEX.PC.CD`).

1. **Entscheide die Cache-Datei und Envelope-Form.**
   - Ist es ein neuer Topic (eigene Detail-Page)? → eigener Cache-File.
   - Oder ergänzt es eine bestehende Kategorie? → in bestehenden Cache
     mit rein packen.

2. **Cache-Skript erweitern**. Beispiel — füge in
   `scripts/cache-live-data.js` einen neuen Task hinzu:

   ```js
   async function cacheHealthSpending() {
     console.log('  [health-spending] Fetching WB health expenditure/capita...');
     const data = await fetchJSON(
       `https://api.worldbank.org/v2/country/WLD/indicator/SH.XPD.CHEX.PC.CD` +
       `?format=json&per_page=60&date=1995:${CURRENT_YEAR}`
     );
     const history = extractWorldBankEntries(data, { roundDigits: 1 });
     const latest = history.length ? history[history.length - 1] : null;
     if (!latest) throw new Error('No health spending data');

     saveCache('health-spending.json', {
       per_capita_usd: {
         value: latest.value, year: latest.year, unit: 'USD',
         source: 'World Bank (SH.XPD.CHEX.PC.CD)'
       },
       history
     });
     console.log(`  [health-spending] latest=${latest.value} USD (${latest.year})`);
   }

   // Am Ende der TASKS-Liste:
   const TASKS = [
     ['temperature', cacheTemperature],
     // ...
     ['health-spending', cacheHealthSpending]   // NEU
   ];
   ```

3. **Validator anpassen**. In `scripts/validate-cache.js` zu
   `EXPECTED_FILES` hinzufügen:

   ```js
   const EXPECTED_FILES = [
     // ...
     'health-spending.json'
   ];
   ```

4. **generate-meta.js** anpassen, damit Cache-Job-Rollup stimmt:

   ```js
   const JOB_FILES = {
     // ...
     'live-data': [
       'temperature.json', /* ... */ 'health-spending.json'
     ]
   };
   ```

5. **Lokal testen**:
   ```bash
   node scripts/cache-live-data.js
   node scripts/validate-cache.js --full
   ```

6. **Optional: in den Score einbauen** (wenn relevant für eine
   Sub-Kategorie). In `scripts/process-data.js`:
   ```js
   const healthSpendingCache = readCacheFresh('health-spending.json');
   // ... in society indicators ergänzen
   ```

7. **Commit**:
   ```bash
   git add scripts/cache-live-data.js scripts/validate-cache.js \
           scripts/generate-meta.js scripts/process-data.js \
           data/cache/health-spending.json
   git commit -m "feat(cache): add World Bank health spending per capita"
   ```

### Case B — Quelle braucht einen API-Key (z.B. FRED, WAQI, NewsAPI)

1. **Registriere den Key bei der Quelle** (siehe CLOUDE.md §7 für
   die aktuellen Offenen-Fragen).

2. **GitHub Secret anlegen**: Repo → Settings → Secrets and
   variables → Actions → New repository secret. Name: z.B.
   `NEW_API_KEY` (SCREAMING_SNAKE, passt zu bestehender Convention).

3. **Skript lesen den Key via env und skippen wenn leer**:

   ```js
   async function cacheNewSource() {
     const apiKey = process.env.NEW_API_KEY;
     if (!apiKey) {
       console.log('  [new-source] skipped — no NEW_API_KEY env var set');
       return { skipped: true };
     }
     // ... fetch mit apiKey ...
   }
   ```

   Muster: `scripts/cache-premium-sources.js` als Vorbild.

4. **Workflow-Env erweitern**. In
   `.github/workflows/cache-pipeline.yml` im entsprechenden Job:

   ```yaml
   - name: Run cache script
     env:
       NEW_API_KEY: ${{ secrets.NEW_API_KEY }}
     run: node scripts/cache-new-source.js
   ```

5. Der Rest wie in Case A (Validator, Processor, Commit).

### Case C — Neuer eigener Workflow-Job (eigener Cron-Slot)

Wenn die Quelle ihren eigenen Zeitplan braucht:

1. Neuen Cron-Schedule in `cache-pipeline.yml` unter `on.schedule`:
   ```yaml
   - cron: '15 7 * * *'    # 07:15 UTC - my-new-job
   ```

2. Neuen Job definieren — kopiere einen existierenden als Template,
   ändere `if:`-Bedingung auf den neuen Cron + das `workflow_dispatch`
   Choice.

3. **`workflow_dispatch` Options** ergänzen:
   ```yaml
   options:
     - all
     - biodiversity
     - ...
     - my-new-job
   ```

4. Validator-Check:
   ```bash
   node scripts/validate-cache.js --check-workflow
   ```

---

## 2. Score-Modell anpassen (neuer Indikator im Sub-Score)

**Vorsicht**: Änderungen am Score-Modell verschieben den World Index.
Immer gegen die Baseline vergleichen.

1. **Processor erweitern**. In `scripts/process-data.js` in der
   Ziel-Sub-Score-Sektion:

   ```js
   // Daten-Input holen (raw oder cache)
   const newMetricData = readCache('new-metric.json');
   const newMetricValue = newMetricData?.value ?? 0;

   // In Score-Berechnung aufnehmen
   const newMetricScore = normalize(newMetricValue, worst, best);

   // Weights anpassen, damit die Summe wieder stimmt
   const envScore = (envTempScore * 0.25 + envCO2Score * 0.25 +
                     envForestScore * 0.15 + envRenewableScore * 0.15 +
                     envAQIScore * 0.10 + newMetricScore * 0.10);
   ```

2. **Indicator-Array ergänzen** (damit UI es sieht):

   ```js
   environment: {
     // ...
     indicators: [
       /* bestehende ... */
       { name: 'Neue Metrik', value: `${newMetricValue}%`,
         score: Math.round(newMetricScore), trend: 'stable',
         ...freshness(fetchedAt, 'Source') }
     ]
   }
   ```

3. **Self-Heal updaten** falls neues Feld erwartet wird. In
   `scripts/self-heal.js`:
   ```js
   ensureField(data, 'environment.newMetric.current', 0, 'New metric');
   ```

4. **Validator-Lauf**:
   ```bash
   node scripts/process-data.js
   node scripts/self-heal.js
   node scripts/validate-score-coverage.js
   ```

5. **Baseline-Vergleich**: World Index vorher vs. nachher im
   Commit-Message notieren.

---

## 3. Release eines Code-Fixes (ohne Data-Change)

Typisch: UI-Fix, CSS, neues JS-Feature. Kein Data-Pipeline-Run nötig.

1. Änderung machen + lokal testen.
2. `service-worker.js` CACHE_VERSION bumpen → aktuelle ISO-Minute
   (z.B. `'20260416-1545'`). Browser-Clients bekommen die neue
   Version automatisch.
3. Commit + push.
4. Deploy-Only-Workflow läuft automatisch (siehe
   `.github/workflows/deploy-only.yml`).

---

## 4. Debug: "World Index sieht falsch aus"

1. **Processor lokal laufen lassen + Output prüfen**:
   ```bash
   node scripts/process-data.js
   ```
   → Console zeigt Zwischenschritte je Sub-Score.

2. **Score-Coverage prüfen** (wieviele Caches fließen ein):
   ```bash
   node scripts/validate-score-coverage.js
   ```

3. **Bestimmte Indikatoren inspizieren**:
   ```bash
   node -e "
   const d = JSON.parse(require('fs').readFileSync(
     'data/processed/world-state.json','utf8'));
   console.log(JSON.stringify(d.subScores.environment.indicators, null, 2));
   "
   ```

4. **Cache-Frische prüfen**:
   ```bash
   node scripts/validate-cache.js
   ```
   → Alter je Cache-File in der Tabelle.

---

## 5. Debug: "Detail-Seite zeigt statt Live-Daten den Fallback"

1. **Browser-DevTools → Network-Tab**. Filter nach `/data/cache/`.
   - Status 200: Cache hat gegriffen.
   - 404: Cache-File existiert nicht im Deploy-Artifact — Cache-Pipeline-Job
     nie erfolgreich gelaufen.

2. **Validate im Repo**:
   ```bash
   node scripts/validate-cache.js
   ```
   → zeigt welche Files fehlen oder invalid sind.

3. **Manuellen Workflow-Run anstoßen**:
   - Actions → Cache Pipeline → Run workflow → Branch wählen →
     Job-Group (z.B. `live-data`) → Run.

4. **Secret-Check für premium-sources**:
   - Actions → letzter Run → Log inspizieren.
   - "skipped — no XXX env var set" bedeutet Secret ist nicht
     (korrekt) gesetzt.

---

## 6. Notfall: Pipeline schreibt kaputte `world-state.json`

1. `data/processed/world-state.backup.json` ist die letzte
   funktionierende Version vor dem letzten `self-heal`-Lauf.
2. Manuelles Rollback:
   ```bash
   cp data/processed/world-state.backup.json \
      data/processed/world-state.json
   git commit -am "revert: rollback world-state from backup"
   git push
   ```
3. Self-Heal rennt beim nächsten Pipeline-Run automatisch wieder
   und legt neues Backup an.

---

## 7. Service-Worker verhält sich merkwürdig

Seit Schritt 2 der UI-Consistency-Serie ist der SW aggressiv
konfiguriert (`updateViaCache: 'none'` + 30-min-update-polling +
auto-reload). Trotzdem Edge-Cases:

1. **User sieht alte Version**: DevTools → Application → Service Workers
   → "Update on reload" + "Unregister". Reload → holt frische Version.
2. **SW hängt fest**: Application → Storage → "Clear site data"
   → reload.
3. **Debug**: `navigator.serviceWorker.controller?.scriptURL` in
   Console zeigt welchen SW der Tab aktuell nutzt.

Wenn viele User klagen: CACHE_VERSION bumpen + commit.

---
