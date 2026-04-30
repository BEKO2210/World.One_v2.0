# World.One 2.0

> **Der Zustand der Welt in einem einzigen Scroll-Erlebnis.**
> Ein Vermächtnis aus Daten, Code und der Überzeugung, dass Transparenz die Welt verbessert.

---

## 🌍 Welt-Indikator: 63.4 / 100 🟢 POSITIV

```
█████████████░░░░░░░  63.4/100  ↑ +0
```

> Berechnet aus hunderten Datenpunkten. Kein KI-Modell — reiner Code, reale Daten.
> **Letzte Aktualisierung:** 30.04.2026 08:37 UTC

### Sub-Scores

| Kategorie | Score | Trend | Gewichtung |
|-----------|-------|-------|------------|
| 🟠 Umwelt | **34.9**/100 | → +0 | 25% |
| 🟡 Gesellschaft | **55.8**/100 | → +0.1 | 25% |
| 🟢 Wirtschaft | **70.7**/100 | → +0 | 20% |
| 🟢 Fortschritt | **78.1**/100 | → +0 | 20% |
| 🟢 Momentum | **80**/100 | → +0 | 10% |

---

## 📊 Live-Daten Snapshot

### 🌡️ Umwelt
| Indikator | Wert | Quelle |
|-----------|------|--------|
| Temperaturanomalie | **+1.19°C** | NASA GISTEMP |
| CO2-Konzentration | **429 ppm** | NOAA |
| Arktis-Eisfläche | **4.2 Mio km²** (46.2% verloren) | NSIDC |
| Luftqualität (Ø) | AQI **58** | WAQI |

### 👥 Gesellschaft
| Indikator | Wert | Quelle |
|-----------|------|--------|
| Aktive Konflikte | **59** | ACLED |
| Menschen auf der Flucht | **108.4 Mio** | UNHCR |
| Lebenserwartung | **73.48 Jahre** | WHO |
| Freiheitsindex | 84 frei / 56 teilw. / 55 unfrei | Freedom House |

### 💰 Wirtschaft
| Indikator | Wert | Quelle |
|-----------|------|--------|
| BIP-Wachstum | **2.87%** | IMF |
| Gini-Index | **42** | World Bank |
| Extreme Armut | **648.0 Mio** | World Bank |
| Milliardäre | **2.8K** (45.8% Vermögen) | Oxfam |

### 🚀 Fortschritt
| Indikator | Wert | Quelle |
|-----------|------|--------|
| Internet-Nutzer | **73.6%** (5.4 Mrd) | ITU |
| Alphabetisierung | **87.7%** | UNESCO |
| Wiss. Publikationen | **3.2 Mio/Jahr** | arXiv/Scopus |
| GitHub Commits | **142.0 Mio/Tag** | GitHub |

### ⚡ Echtzeit
| Indikator | Wert | Quelle |
|-----------|------|--------|
| Erdbeben (24h) | **8** Beben M2.5+ | USGS |
| Nachrichten-Sentiment | **-0.42** (Leicht Negativ) | GDELT |
| Crypto Fear & Greed | **29/100** (Fear) | Alternative.me |

---

## 📈 Momentum: 16/20 Trends positiv

<details>
<summary>Alle 20 Indikatoren anzeigen</summary>

#### ✅ Verbessert sich (16)
- **Lebenserwartung**: +1.6%
- **Kindersterblichkeit**: -2.3%
- **Erneuerbare Energie**: +6.7%
- **Internet-Zugang**: +12.1%
- **BIP-Wachstum**: +48.9%
- **Arbeitslosigkeit**: -19.1%
- **BIP pro Kopf**: +14.3%
- **Globaler Handel**: +7.8%
- **Alphabetisierung**: +0.7%
- **Mobilfunk**: +3.8%
- **F&E Ausgaben**: +10.8%
- **Elektrizitätszugang**: +1.4%
- **Trinkwasser**: +2.7%
- **Gesundheitsausgaben**: +1.0%
- **Urbanisierung**: +1.6%
- **Patentanmeldungen**: +1.2%

#### ❌ Verschlechtert sich (4)
- **CO2-Konzentration**: +2.0%
- **Waldfläche**: -0.3%
- **CO2 pro Kopf**: +1.4%
- **Militärausgaben (% BIP)**: +5.6%

</details>

---

## 🔮 Drei Szenarien bis 2050

| Pfad | 2030 | 2050 | Beschreibung |
|------|------|------|-------------|
| 🟠 Weiter so | 45.1 | 38.7 | Temperatur +2.1°C bis 2050 |
| 🔴 Worst Case | 35.2 | 22.8 | Temperatur +3.5°C bis 2050 |
| 🔵 Best Case | 58.4 | 72.1 | Temperatur stabilisiert bei +1.8°C |

---

## 🏗️ Architektur

```
world-one/
├── index.html                    # Entry Point — 12 Scroll-Sektionen
├── css/
│   ├── core.css                  # Design System, Custom Properties, Reset
│   ├── sections.css              # Bento Grid & Section Styles
│   ├── components.css            # Data Cards, AQI, Exchange Rates, Gauges
│   └── animations.css            # 40+ Keyframes & Transitions
├── js/
│   ├── app.js                    # Main Controller — Data Binding
│   ├── data-loader.js            # Fetch & LocalStorage Cache
│   ├── scroll-engine.js          # IntersectionObserver + RAF Loop
│   └── visualizations/
│       ├── world-indicator.js    # Der Haupt-Schieberegler
│       ├── charts.js             # SVG Charts (Line, Bar, Gauge, Sparklines)
│       ├── maps.js               # SVG-Weltkarten mit Overlays
│       ├── particles.js          # Canvas Partikel-System
│       ├── counters.js           # Animierte Counter & Typewriter
│       └── cinematic.js          # Scroll-driven Cinematics
├── scripts/
│   ├── collect-data.js           # 40+ API Datensammler
│   ├── process-data.js           # Raw → world-state.json Transformer
│   └── generate-readme.js        # Auto-README Generator
├── data/processed/
│   └── world-state.json          # Alle verarbeiteten Daten
└── .github/workflows/
    └── data-pipeline.yml         # Automatische Pipeline (alle 6h)
```

## ⚙️ Tech Stack

- **Vanilla JS** (ES Modules) — keine Frameworks, keine Build-Tools
- **CSS Custom Properties** — dynamisches Farbsystem pro Sektion
- **Canvas API** — Partikel-System mit Physik-Simulation
- **SVG** — Alle Charts, Sparklines und Karten
- **IntersectionObserver** — Scroll-driven Animations
- **GitHub Actions** — Automatisierte Daten-Pipeline mit Self-Healing

## 📡 Datenquellen (65)

| Quelle | Vertrauen | Letztes Update |
|--------|-----------|----------------|
| [NASA GISTEMP](https://data.giss.nasa.gov/gistemp/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA (CO2)](https://gml.noaa.gov/ccgg/trends/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA Mauna Loa CO2 Monthly](https://gml.noaa.gov/webdata/ccgg/trends/co2/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA NCEI (Ocean SST)](https://www.ncei.noaa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA NCEI (Monthly Temp)](https://www.ncei.noaa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA STAR (Sea Level)](https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/) | ⭐⭐⭐ | 2026-04-30 |
| [NASA Sea Level](https://sealevel.nasa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA Coral Reef Watch](https://coralreefwatch.noaa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [Open-Meteo](https://open-meteo.com/) | ⭐⭐ | 2026-04-30 |
| [Open-Meteo (Air Quality)](https://air-quality-api.open-meteo.com/) | ⭐⭐ | 2026-04-30 |
| [WAQI (Air Quality)](https://aqicn.org/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Environment)](https://data.worldbank.org/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Forest Area)](https://data.worldbank.org/indicator/AG.LND.FRST.ZS) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Renewable Energy)](https://data.worldbank.org/indicator/EG.FEC.RNEW.ZS) | ⭐⭐⭐ | 2026-04-30 |
| [NSIDC (Arktis)](https://nsidc.org/) | ⭐⭐⭐ | 2026-04-30 |
| [Our World in Data (CO2 backup)](https://ourworldindata.org/co2-emissions) | ⭐⭐⭐ | 2026-04-30 |
| [GBIF (Biodiversity)](https://www.gbif.org/) | ⭐⭐⭐ | 2026-04-30 |
| [IUCN Red List](https://www.iucnredlist.org/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Society)](https://data.worldbank.org/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Health: Life Exp/DTP3)](https://data.worldbank.org/topic/health) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Hunger)](https://data.worldbank.org/indicator/SN.ITK.DEFC.ZS) | ⭐⭐⭐ | 2026-04-30 |
| [ACLED (Konflikte)](https://acleddata.com/) | ⭐⭐⭐ | 2026-04-30 |
| [UCDP (Uppsala Conflict)](https://ucdp.uu.se/) | ⭐⭐⭐ | 2026-04-30 |
| [ReliefWeb (Conflicts)](https://reliefweb.int/) | ⭐⭐⭐ | 2026-04-30 |
| [UNHCR](https://data.unhcr.org/) | ⭐⭐⭐ | 2026-04-30 |
| [Freedom House](https://freedomhouse.org/) | ⭐⭐⭐ | 2026-04-30 |
| [GDELT (Conflicts)](https://www.gdeltproject.org/) | ⭐⭐ | 2026-04-30 |
| [disease.sh (COVID)](https://disease.sh/) | ⭐⭐ | 2026-04-30 |
| [disease.sh (Global Outbreaks)](https://disease.sh/) | ⭐⭐ | 2026-04-30 |
| [World Bank (Economy)](https://data.worldbank.org/) | ⭐⭐⭐ | 2026-04-30 |
| [IMF WEO](https://www.imf.org/en/Publications/WEO) | ⭐⭐⭐ | 2026-04-30 |
| [FRED (St. Louis Fed)](https://fred.stlouisfed.org/) | ⭐⭐⭐ | 2026-04-30 |
| [Alternative.me (Fear & Greed)](https://alternative.me/crypto/) | ⭐⭐ | 2026-04-30 |
| [CoinGecko (Crypto)](https://www.coingecko.com/) | ⭐⭐ | 2026-04-30 |
| [Exchange Rate API (USD)](https://open.er-api.com/) | ⭐⭐ | 2026-04-30 |
| [Exchange Rate API (EUR)](https://open.er-api.com/) | ⭐⭐ | 2026-04-30 |
| [Forbes / Oxfam (Wealth)](https://www.forbes.com/billionaires/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Tech)](https://data.worldbank.org/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (Internet/Mobile)](https://data.worldbank.org/indicator/IT.NET.USER.ZS) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank (R&D Spending)](https://data.worldbank.org/indicator/GB.XPD.RSDV.GD.ZS) | ⭐⭐⭐ | 2026-04-30 |
| [GitHub API](https://api.github.com/) | ⭐⭐ | 2026-04-30 |
| [arXiv](https://arxiv.org/) | ⭐⭐⭐ | 2026-04-30 |
| [Spaceflight News](https://spaceflightnewsapi.net/) | ⭐⭐ | 2026-04-30 |
| [ISS Tracker (Open Notify)](http://api.open-notify.org/) | ⭐⭐ | 2026-04-30 |
| [USGS Earthquakes](https://earthquake.usgs.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [USGS Volcanoes](https://volcanoes.usgs.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [GDACS (Disaster Alert EU)](https://www.gdacs.org/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA Space Weather](https://www.swpc.noaa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [GDELT Project](https://www.gdeltproject.org/) | ⭐⭐ | 2026-04-30 |
| [NewsAPI (world/climate/conflict)](https://newsapi.org/) | ⭐⭐ | 2026-04-30 |
| [UN News (RSS)](https://news.un.org/) | ⭐⭐⭐ | 2026-04-30 |
| [WHO News (RSS)](https://www.who.int/) | ⭐⭐⭐ | 2026-04-30 |
| [UNHCR (RSS)](https://www.unhcr.org/) | ⭐⭐⭐ | 2026-04-30 |
| [ReliefWeb (RSS)](https://reliefweb.int/) | ⭐⭐⭐ | 2026-04-30 |
| [NASA (RSS)](https://www.nasa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [NASA Earth Observatory](https://earthobservatory.nasa.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [ESA (RSS)](https://www.esa.int/) | ⭐⭐⭐ | 2026-04-30 |
| [NOAA Climate.gov (RSS)](https://www.climate.gov/) | ⭐⭐⭐ | 2026-04-30 |
| [BBC World (RSS)](https://www.bbc.com/news/world) | ⭐⭐⭐ | 2026-04-30 |
| [DW News (RSS)](https://www.dw.com/) | ⭐⭐⭐ | 2026-04-30 |
| [Al Jazeera (RSS)](https://www.aljazeera.com/) | ⭐⭐⭐ | 2026-04-30 |
| [Guardian World (RSS)](https://www.theguardian.com/world) | ⭐⭐⭐ | 2026-04-30 |
| [France24 (RSS)](https://www.france24.com/) | ⭐⭐⭐ | 2026-04-30 |
| [World Bank News (Google News)](https://news.google.com/) | ⭐⭐ | 2026-04-30 |
| [IMF News (Google News)](https://news.google.com/) | ⭐⭐ | 2026-04-30 |

## 🚀 Setup

### Lokal starten

```bash
git clone https://github.com/BEKO2210/World_report.git
cd World_report
npx serve .
# → http://localhost:3000
```

### GitHub Pages

1. Repository-Settings → Pages → Source: **GitHub Actions**
2. Die Pipeline läuft automatisch alle 6 Stunden
3. Manuell: Actions → World.One → Run workflow

## 🧬 Das Vermächtnis

Dieses Projekt wurde gebaut um zu überdauern. Die GitHub Actions Pipeline:
- **Sammelt Daten** aus 40+ freien APIs — alle 6 Stunden, automatisch
- **Aktualisiert diese README** mit Live-Daten bei jedem Pipeline-Lauf
- **Erkennt Fehler** und erstellt automatisch Issues bei Problemen
- **Heilt sich selbst** — schließt Issues wenn Quellen wieder verfügbar sind
- **Läuft unendlich** — solange GitHub existiert, lebt dieses Projekt

> *Die Daten hören nie auf zu fließen. Der Code repariert sich selbst.*
> *Ein Vermächtnis aus Transparenz, gebaut um die Menschheit zu überdauern.*

---

<sub>
Auto-generiert von der World.One Pipeline | 30.04.2026 08:37 UTC | 65/65 Quellen aktiv
</sub>
