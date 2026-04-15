# World.One Public Data API

> Alle Live-Daten, die World.One berechnet, sind als öffentliche JSON-
> Endpunkte auf GitHub Pages verfügbar. Dieses Dokument beschreibt
> Endpunkte, Schemas, Lizenzen und Integration.

---

## 1. TL;DR — in 60 Sekunden starten

```js
// Haupt-Score (World Index + 5 Sub-Scores + alle Kategorien)
const res = await fetch(
  'https://beko2210.github.io/World.One_v2.0/data/processed/world-state.json'
);
const data = await res.json();

console.log('World Index:', data.worldIndex.value);          // z.B. 62.6
console.log('Environment:', data.subScores.environment.value);
console.log('Generated:',   data.meta.generated);
```

Keine API-Keys nötig. Kein Rate-Limit außerhalb GitHub-Pages-Traffic.
CORS ist weltweit offen (`Access-Control-Allow-Origin: *`).

Einzige Pflicht: **Attribution.** Siehe Abschnitt 5.

---

## 2. Basis-URL

```
https://beko2210.github.io/World.One_v2.0/
```

Hängt am GitHub-Pages-Hosting des `BEKO2210/World.One_v2.0` Repos.
Änderung der Basis-URL ist unwahrscheinlich aber möglich; Integration
sollte die Basis-URL konfigurierbar halten.

---

## 3. Endpunkte auf einen Blick

| Endpunkt | Inhalt | Update-Zyklus | Größe |
|---|---|---|---|
| `data/processed/world-state.json` | World Index + alle Sub-Scores + aggregierte Daten je Kategorie | alle 6 h | ~85 KB |
| `data/cache/*.json` | Per-Topic Detail-Caches (25 Files) | 1× täglich, gestaffelt | je 1-30 KB |
| `data/cache/meta.json` | Cache-Pipeline Health Status | bei jedem Cache-Job | ~3 KB |
| `data/fallback/static-values.json` | Statische Baseline-Werte | stabil | ~4 KB |
| `data/history/manifest.json` | Liste aller historischen Snapshots | bei jedem `self-heal` | skaliert |
| `data/history/snapshot-{ts}.json` | Historischer World-State-Snapshot | write-once | ~85 KB je |

Alle Dateien sind plain JSON, `Content-Type: application/json`,
UTF-8 kodiert. Kein Authentication, keine Rate-Limits (außer den
GitHub-Pages-Traffic-Limits: ~100 GB/Monat soft limit).

---

## 4. `world-state.json` — die Haupt-API (Schema)

```
{
  meta: {
    generated:         ISO timestamp
    version:           "2.0.0"
    sources_count:     number of API sources queried
    sources_available: number that responded successfully
    sources_success_rate: percent
    next_update:       ISO timestamp
    realtimePulse:     {env, soc, eco, prog}   // -1..+1 tone signal
    cacheFreshness: {
      environment: {newest, oldest, newestHours, oldestHours, sourceCount}
      society:    same shape or null
      economy:    same shape or null
      progress:   same shape or null
    }
  },
  worldIndex: {
    value:      0-100           // Haupt-Index (Carrying Capacity V6)
    rawValue:   0-100           // vor Penalties/Bonuses
    label:      KOLLAPS | BESORGNISERREGEND | GEMISCHT | POSITIV | EXZELLENT
    zone:       critical | concerning | mixed | positive | excellent
    previous:   0-100           // letzter Run
    change:     ±                // Delta
    trend:      improving | declining | stable
    carryingCapacity: {checks, spectrum, method}
  },
  subScores: {
    environment: {
      value, label, zone, weight (0.25), trend, change,
      indicators: [{
        name, value, score, trend, source,
        fetchedAt?, ageHours?                 // freshness metadata
      }, …]
    }
    society:   same shape (weight 0.25)
    economy:   same shape (weight 0.20)
    progress:  same shape (weight 0.20)
    momentum: {
      value, weight (0.10), label, zone, trend, change,
      positiveCount, negativeCount, totalIndicators,
      indicators: [derived]
    }
  },
  environment: { temperatureAnomaly, co2, airQuality, arcticIce, forest,
                 renewableEnergy, co2PerCapita, weather, ocean,
                 biodiversity },
  society:    { lifeExpectancy, childMortality, population, conflicts,
                refugees, freedom, electricityAccess, safeWater, … },
  economy:    { wealth, gdpGrowth, gini, inflation, unemployment,
                gdpPerCapita, trade, regions, cryptoFearGreed, … },
  progress:   { internet, literacy, mobile, github, arxiv, patents,
                rdSpending, space, … },
  realtime:   { earthquakes, newsSentiment, cryptoFearGreed, rss, … },
  momentum:   { indicators[], comparison2000[] },
  scenarios:  { businessAsUsual, worstCase, bestCase },
  dataSources: [{name, url, reliability, coverage}]
}
```

Jede Ebene ist optional (Processor füllt mit Fallbacks). Ein
Consumer sollte defensiv zugreifen (`data.worldIndex?.value ?? null`).

---

## 5. Code-Beispiele

### 5.1 Browser (fetch)

```html
<script>
const API = 'https://beko2210.github.io/World.One_v2.0/data/processed/world-state.json';

fetch(API)
  .then(r => r.json())
  .then(data => {
    document.getElementById('score').textContent = data.worldIndex.value;
    document.getElementById('zone').textContent  = data.worldIndex.label;
    document.getElementById('updated').textContent =
      'aktualisiert: ' + new Date(data.meta.generated).toLocaleString();
  })
  .catch(err => console.error('World.One API offline:', err));
</script>
```

### 5.2 Node.js (ESM, Node ≥ 18)

```js
import https from 'node:https';

const BASE = 'https://beko2210.github.io/World.One_v2.0';

async function getWorldState() {
  const res = await fetch(`${BASE}/data/processed/world-state.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const data = await getWorldState();
console.log(`World Index ${data.worldIndex.value} (${data.worldIndex.label})`);
console.log(`Environment ${data.subScores.environment.value}`);
console.log(`Society     ${data.subScores.society.value}`);
console.log(`Economy     ${data.subScores.economy.value}`);
console.log(`Progress    ${data.subScores.progress.value}`);
console.log(`Momentum    ${data.subScores.momentum.value}`);
```

### 5.3 Python

```python
import requests

BASE = 'https://beko2210.github.io/World.One_v2.0'

def get_world_state():
    r = requests.get(f'{BASE}/data/processed/world-state.json', timeout=10)
    r.raise_for_status()
    return r.json()

def get_topic(topic):
    """z.B. 'temperature', 'forests', 'earthquakes'…"""
    r = requests.get(f'{BASE}/data/cache/{topic}.json', timeout=10)
    r.raise_for_status()
    return r.json()

ws = get_world_state()
print(f"World Index: {ws['worldIndex']['value']}/100  "
      f"({ws['worldIndex']['label']})")

# Pro Topic:
eq = get_topic('earthquakes')
print(f"Significant 24h: {eq['significant_24h']['value']} Beben")

temp = get_topic('temperature')
print(f"Latest temperature anomaly: {temp['anomaly']['value']}°C "
      f"({temp['anomaly']['year']})")
```

### 5.4 curl (CLI / Bash)

```bash
BASE='https://beko2210.github.io/World.One_v2.0'

# World Index nur als Zahl:
curl -s "$BASE/data/processed/world-state.json" | jq -r '.worldIndex.value'

# Alle Sub-Score-Werte:
curl -s "$BASE/data/processed/world-state.json" \
  | jq '.subScores | to_entries | map({name: .key, value: .value.value})'

# Aktuellste Live-Erdbeben (M≥4.5):
curl -s "$BASE/data/cache/earthquakes.json" \
  | jq '.significant_24h_events[] | {mag, place, time}'
```

### 5.5 React Hook

```jsx
import { useEffect, useState } from 'react';

const API = 'https://beko2210.github.io/World.One_v2.0/data/processed/world-state.json';

export function useWorldState(pollMs = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let timer;
    const fetchNow = async () => {
      try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: err }));
      }
      if (!cancelled && pollMs > 0) timer = setTimeout(fetchNow, pollMs);
    };
    fetchNow();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pollMs]);

  return state;
}

// Anwendung (Poll alle 15 Minuten):
function Dashboard() {
  const { data, loading, error } = useWorldState(15 * 60 * 1000);
  if (loading) return <div>Lade…</div>;
  if (error)   return <div>Fehler: {error.message}</div>;
  return <div>World Index: {data.worldIndex.value}</div>;
}
```

---

## 6. Topic-Caches (`data/cache/*.json`)

Jeder Cache ist als Envelope gepackt:

```json
{
  "_meta": {
    "fetched_at": "2026-04-15T21:30:17.873Z",
    "source": "cache-pipeline",
    "version": "1.0"
  },
  /* ... topic-spezifische Felder ... */
}
```

Aktuell 25 Topic-Caches verfügbar:

| Topic | Inhalt | Live-Quelle |
|---|---|---|
| `temperature.json` | Jährl. NASA GISTEMP Anomalie 1880-heute | NASA GISTEMP v4 (Fallback NOAA NCEI) |
| `co2-history.json` | Monatl. NOAA Mauna Loa CO2 1958-heute | NOAA GML |
| `ocean.json` | SST-Anomalie-Historie | NOAA Climate-at-a-Glance |
| `forests.json` | World Bank Forest-% Historie | World Bank (AG.LND.FRST.ZS) |
| `renewables.json` | World Bank Renewable-% Historie | World Bank (EG.FEC.RNEW.ZS) |
| `airquality.json` | Multi-City AQI Snapshot | Open-Meteo Air Quality |
| `waqi.json` | Optional: Offizielle WAQI-Stationen | WAQI (Token erforderlich) |
| `weather.json` | Multi-City Wetter Snapshot | Open-Meteo |
| `earthquakes.json` | USGS 24h + 7d + significant feeds | USGS |
| `solar.json` | Solar-Cycle Predicted | NOAA SWPC |
| `disasters.json` | GDACS active events (EQ/TC/FL/VO/DR/WF) | GDACS (JRC/EU) |
| `biodiversity.json` | GBIF threatened species counts | GBIF |
| `population.json` | UN DESA Weltbevölkerung Historie | World Bank (SP.POP.TOTL) |
| `health.json` | WB Life Expectancy + Mortality + DTP3 | World Bank |
| `hunger.json` | WB Undernourishment Historie | World Bank (SN.ITK.DEFC.ZS) |
| `freedom.json` | Freedom House aggregate scores | Freedom House (non-commercial) |
| `conflicts.json` | ACLED + ReliefWeb + GDELT merged | ACLED / ReliefWeb / GDELT / UCDP |
| `inequality.json` | Gini + Wealth-Share Historie | World Bank + WID |
| `poverty.json` | WB Extreme-Poverty Historie | World Bank (SI.POV.DDAY) |
| `currencies.json` | FX rates + crypto Fear & Greed | Open ER API + alternative.me |
| `crypto_sentiment.json` | 30-Tage Fear-&-Greed-Serie | alternative.me |
| `science.json` | arXiv AI/ML papers + total count | arXiv (cs.AI + cs.LG) |
| `arxiv-ai.json` | arXiv Paper-Liste (neuer-first) | arXiv |
| `space.json` | Spaceflight News + ISS | Spaceflight News API + NASA |
| `space-news.json` | Nur Spaceflight News Liste | Spaceflight News API |
| `internet.json` | WB Internet + Mobile Historie | World Bank (IT.NET.USER.ZS) |
| `fred.json` | Optional: FRED ökonomische Indikatoren | St. Louis Fed (FRED, Token) |
| `news.json` | Optional: NewsAPI Headlines (world/climate/conflict/economy) | NewsAPI (Token, **nur Headlines + URLs!**) |

---

## 7. Datenquellen & Lizenzen

Alle von World.One aggregierten Werte sind **Zahlen (Fakten)**, die
als solche in der Regel **nicht urheberrechtlich geschützt** sind.
Die zugrundeliegenden Quellen verlangen aber teilweise Attribution
oder Einschränkungen bei Wiederverwendung. Zusammenfassung:

### 7.1 Public Domain / unbeschränkt

| Quelle | Typ | Anwendung |
|---|---|---|
| NASA GISTEMP, NASA APIs (ISS) | US Federal → **Public Domain** | Freie Wiederverwendung |
| NOAA (CO2 Mauna Loa, SWPC Solar, NCEI, STAR Sea Level) | US Federal → **Public Domain** | Freie Wiederverwendung |
| USGS (Earthquakes) | US Federal → **Public Domain** | Freie Wiederverwendung |
| FRED (St. Louis Fed) | US Federal → **Public Domain** | Freie Wiederverwendung |

### 7.2 Creative Commons (Attribution erforderlich)

| Quelle | Lizenz | Attribution-Text-Beispiel |
|---|---|---|
| World Bank Open Data | **CC BY 4.0** | "Data: World Bank (CC BY 4.0)" |
| GBIF | **CC0 / CC BY** (variiert) | "Data via GBIF.org" |
| GDACS (JRC/EU) | **CC BY 4.0** | "Data: GDACS, © European Union" |
| Open-Meteo | **CC BY 4.0** | "Weather data by Open-Meteo.com" |
| GDELT Project | **CC BY 4.0** | "News data from GDELT Project" |
| arXiv (Metadata) | **CC0** (Metadata) | "Paper data via arXiv.org" |

### 7.3 Frei mit Attribution (nicht formell CC)

| Quelle | Bedingung |
|---|---|
| ACLED | Attribution + Non-commercial academic OK; Zitat-Pflicht |
| alternative.me (F&G Index) | Attribution erwähnt |
| Spaceflight News API | Attribution erwähnt |
| Open ER API | Attribution erwähnt |
| CoinGecko (public) | Attribution; Commercial braucht Key |
| ReliefWeb (OCHA) | Attribution; appname-Registrierung erforderlich |

### 7.4 Non-Commercial / eingeschränkt

| Quelle | Einschränkung |
|---|---|
| **WAQI (World Air Quality Index)** | Kostenlos für **non-commercial**; für kommerzielle Nutzung lizenzpflichtig |
| **Freedom House (Freedom in the World)** | Non-commercial use; kommerzielle Nutzung lizenzpflichtig |
| **IRENA** | CC BY-NC (meist); Non-commercial |
| **NewsAPI** | Nur Headlines + URLs weiterreichen; Artikel-Inhalte sind urheberrechtlich geschützt |
| **RSS-Feeds (BBC/Guardian/DW/Al Jazeera etc.)** | Urheberrecht bleibt bei Publisher; nur Titel + Link zitierbar |

### 7.5 Fazit

**Die Haupt-API (`world-state.json`)** besteht aus aggregierten
Zahlen, die bereits eine Attributions-Zeile (`source:` auf jedem
Indikator) mitliefern. Wer sie in eigenen Produkten nutzt:

- **Muss**: Attribution des World.One Aggregators + der Originalquellen.
- **Darf** aggregierte Werte in commercial Produkten zeigen, wenn die
  zitierten Original-Quellen commercial erlauben (siehe 7.4 für
  Ausnahmen: WAQI, Freedom House, IRENA, NewsAPI, RSS-Feeds).
- **Darf nicht** NewsAPI-Artikel-Inhalte oder RSS-Feed-Bodies
  redistributen (diese werden im World.One API auch NICHT ausgeliefert
  — wir geben nur Headlines + URLs weiter, was nach deren ToS erlaubt ist).

Empfohlene Attribution-Zeile:

> _Source: World.One Aggregated Data API
> (https://beko2210.github.io/World.One_v2.0/), built from public
> sources — see `.dataSources[]` in the API response for full citations._

---

## 8. Versioning-Policy

- **Additive Changes** (neue Felder): jederzeit, keine Breaking-
  Change-Ankündigung.
- **Feld-Umbenennungen / Entfernungen**: gelten als Breaking und
  werden mindestens 30 Tage vorher im Repo-CHANGELOG annotiert.
  Konsumenten sollten `data.meta.version` prüfen.
- **Schema-Major-Version** steht in `data.meta.version`. Aktuell
  `"2.0.0"`. Ein Sprung auf `3.0.0` signalisiert Breaking Changes.

## 9. Freshness & Caching

- **World-State**: Pipeline läuft alle 6 h (00:00, 06:00, 12:00,
  18:00 UTC). `data.meta.generated` ist der tatsächliche Build-
  Zeitstempel, `data.meta.next_update` ein Hinweis.
- **Topic-Caches**: gestaffelt über die 03:00-06:30 UTC Slots
  (siehe `.github/workflows/cache-pipeline.yml`). Jede Cache-Datei
  trägt `_meta.fetched_at`.
- **Frischeangaben per Indikator**: in `world-state.subScores.*.indicators[]`
  tragen cache-backed Werte `fetchedAt` + `ageHours`. Run-3-Feature.

Empfohlenes Client-Polling:

- Für UI-Dashboards: alle 15–60 Minuten `world-state.json` re-fetchen.
- Für Bots/Alerts: Cron alle 6-12 h. `If-Modified-Since` / `ETag`
  werden von GitHub Pages unterstützt → bandwidth-sparend.

## 10. Rate-Limits & Fair Use

GitHub Pages hat **kein hartes Rate-Limit per IP**, aber ein Soft-
Limit von ca. **100 GB Traffic/Monat**. Die World-State-Datei ist
~85 KB → das erlaubt etwa 1 Mio Fetches/Monat bevor der Repo-
Owner eine Warnung sieht.

**Fair-Use-Richtlinien:**

1. Nicht öfter als 1× alle 5 Minuten pollen. Die Daten werden
   ohnehin nur alle 6 h neu berechnet.
2. Bei Integration in eine Public-App: eigenes Caching (z.B.
   Cloudflare KV, Redis) zwischen deinem User und unserem Endpoint
   einziehen.
3. Bei sehr hoher Last: fork den öffentlichen Repo und hoste den
   eigenen Mirror via GitHub Pages / Vercel / Netlify.

## 11. Supportstatus & Kontakt

- **Repository**: https://github.com/BEKO2210/World.One_v2.0
- **Issues**: über das Repo ("Issues" Tab) für Bug-Reports oder
  Schema-Fragen.
- **Keine SLA**: best-effort; jeder Consumer sollte einen Offline-
  Fallback haben (die JSON-Datei kann aus verschiedensten Gründen
  404en: CDN-Cache-Miss, Deploy-Down, Repo-Umzug, …).

## 12. Changelog-Anker für Konsumenten

Wenn sich das Schema signifikant ändert, erscheint es hier:

| Datum | Version | Änderung |
|---|---|---|
| 2026-04-15 | 2.0.0 | Run 3 fügt `meta.cacheFreshness`, `environment.biodiversity`, `society.population.totalMillions`, pro-Indikator `fetchedAt`/`ageHours` hinzu (additiv, nicht breaking). |

---

_Letzte Aktualisierung dieser Dokumentation: siehe git log._
