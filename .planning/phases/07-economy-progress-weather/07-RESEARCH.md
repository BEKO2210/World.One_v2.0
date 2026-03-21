# Phase 7: Economy, Progress & Weather - Research

**Researched:** 2026-03-21
**Domain:** Detail page topic modules (currencies, science, internet, space, weather) + live data feeds + interactive elements
**Confidence:** HIGH

## Summary

Phase 7 implements five new detail page topic modules spanning three categories: economy (currencies), progress (science, internet, space), and realtime (weather). This is the most API-diverse phase in the project -- four of five topics require live browser-side API calls (currencies from Open ER API, ISS position from open-notify/wheretheiss, weather from Open-Meteo, arXiv is cache-only) while one (internet) uses pure calculation-based counters similar to population.js's births/deaths clock.

The codebase now has 14 working topic modules that establish every pattern needed. All five Phase 7 topic IDs are already in the VALID_TOPICS allowlist in detail-app.js, so no router changes are needed. Cache files already exist for currencies.json (12 exchange rates), arxiv-ai.json (20 papers with titles/dates/categories), and space-news.json (10 articles). No cache files exist for internet or weather -- internet uses World Bank IT.NET.USER.ZS (already collected in pipeline but not cached for detail), and weather will fetch live from Open-Meteo with no cache fallback needed. Static fallback values in static-values.json are null for currencies, science, internet, space, and weather -- these must be populated.

The phase introduces two technically distinctive features: (1) a 10-second auto-refresh ISS position tracker with SVG orbit trail, requiring setInterval-based polling and proper cleanup in the module lifecycle, and (2) hourly weather sparklines using pure SVG polylines (no Chart.js) for 24 cities. These patterns have precedent: earthquakes.js already fetches live USGS data, and population.js already manages multiple setInterval calls with cleanup.

**Primary recommendation:** Follow the Phase 5/6 pattern: Plan 01 adds all i18n keys + static fallback values + currencies topic (simplest, uses existing cache). Plan 02 implements science + internet (both use hardcoded/calculated data, no live API complexity). Plan 03 implements space + weather (both need live API calls with refresh intervals and SVG map rendering).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ECON-03 | Topic currencies: key exchange rates hero (Open ER API), currency converter (client-side from cache), 12-month EUR/USD + USD/CNY charts, hyperinflation countries highlighted | currencies.json cache has 12 rates (EUR, GBP, JPY, CNY, etc.) with base USD; Open ER API (https://open.er-api.com/v6/latest/USD) is CORS-friendly, free, no key; converter uses cached rates for client-side math; 12-month chart data hardcoded (no historical cache); hyperinflation countries hardcoded list (Venezuela, Zimbabwe, Argentina, Turkey, Lebanon) |
| PROG-01 | Topic science: total arXiv papers hero, exponential growth curve animated, hot research fields bar chart (daily cached), Nobel prizes by country bubble chart | arxiv-ai.json cache has 20 recent papers with categories; total papers ~2.99M (arXiv stats 2026); growth curve hardcoded (annual submissions 1991-2025); hot fields extracted from cached paper categories; Nobel API (https://api.nobelprize.org/2.1/laureates) is free, no key, but hardcode top-15 countries to avoid live dependency |
| PROG-02 | Topic internet: internet users % hero (World Bank), real-time calculated counters (emails/YouTube/Google today), digital divide SVG choropleth | No internet.json cache exists -- use hardcoded World Bank IT.NET.USER.ZS data (~67% global, 2024); real-time counters are pure JS calculation from known daily rates (332B emails, 5B Google searches, 500h YouTube uploaded/min); choropleth uses renderChoropleth with internet penetration by country data |
| PROG-03 | Topic space: ISS position live (10s refresh), SVG map with moving ISS dot + orbit trail, crew list, spaceflight news feed (cached), satellite count | ISS position via open-notify API (http://api.open-notify.org/iss-now.json) or wheretheiss.at API (https://api.wheretheiss.at/v1/satellites/25544); space-news.json cache has 10 articles; crew list hardcoded (changes rarely); satellite count ~13,000 (UCS 2025 data); orbit trail stores last N positions as SVG polyline |
| RT-02 | Topic weather: 24 cities (all continents), hourly sparklines, extreme weather warnings (code>65 rain, >75 blizzard, >95 thunderstorm) | Open-Meteo forecast API (https://api.open-meteo.com/v1/forecast) free, CORS-friendly, no key; request hourly=temperature_2m,weather_code&forecast_hours=24 per city; WMO weather codes map to severity levels; SVG sparklines (polyline) for temperature; warning badges color-coded by WMO code thresholds |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.5.x (CDN) | Line/bar/bubble charts | Already loaded via chart-manager.js ensureChartJs() singleton |
| DOMUtils | Project util | DOM element creation (no innerHTML) | Security pattern established Phase 2, used in all 14 topics |
| DOMUtils.createSVG | Project util | SVG element creation (xmlns aware) | Used in earthquakes.js for SVG map, needed for ISS map + sparklines |
| i18n.js | Project util | DE/EN translation keys | Bilingual requirement, all topics follow this pattern |
| data-loader.js | Project util | 3-tier fallback (live/cache/static) | fetchTopicData() + fetchWithTimeout() proven in 14 topics |
| badge.js | Project util | Data freshness badge (LIVE/Cache/Static) | createTierBadge() in every topic hero block |
| choropleth.js | detail/utils | Reusable SVG choropleth component | Built Phase 5, needed for internet digital divide map |
| MathUtils | Project util | geoToSVG(), formatNumber(), formatCompact(), remap() | Needed for ISS position mapping and number formatting |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CHART_COLORS | chart-manager.js | Category color palette (economy/progress/realtime) | Category-specific accent colors for each topic |
| toRgba() | chart-manager.js | RGBA string from RGB color object | All chart and UI accent colors |
| MathUtils.geoToSVG() | math.js | Lat/lng to SVG coordinate mapping | ISS position on SVG world map |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG sparklines | Chart.js mini charts | SVG polylines are lighter for 24 cities x 24 points; Chart.js adds canvas overhead per city |
| open-notify.org ISS API | wheretheiss.at API | open-notify is simpler (lat/lng only), wheretheiss returns more fields; open-notify may lack CORS -- use wheretheiss.at as primary with open-notify fallback |
| Nobel Prize API live | Hardcoded top-15 countries | Live API adds latency for data that changes once/year; hardcode is faster and more reliable |
| Live internet percentage | Hardcoded World Bank data | World Bank API could fail; internet percentage changes slowly (yearly), hardcoded is safer |

**Installation:**
```bash
# No new dependencies -- all existing project utilities
# All external APIs are free, CORS-friendly, no authentication required
```

## Architecture Patterns

### Recommended Project Structure
```
detail/topics/
  currencies.js     # ECON-03 -- economy category
  science.js        # PROG-01 -- progress category
  internet.js       # PROG-02 -- progress category
  space.js          # PROG-03 -- progress category
  weather.js        # RT-02   -- realtime category
data/fallback/
  static-values.json  # Update null entries for currencies/science/internet/space/weather
js/i18n.js           # Add DE/EN keys for all 5 topics
```

### Pattern 1: Live API with Interval Refresh (Space/Weather)
**What:** Some topics need periodic live data updates after initial render
**When to use:** ISS position (10s refresh), weather warnings
**Example:**
```javascript
// Proven pattern from population.js -- store interval IDs for cleanup
let _intervals = [];

function startISSTracking(svgEl) {
  const update = async () => {
    try {
      const res = await fetchWithTimeout(
        'https://api.wheretheiss.at/v1/satellites/25544', 8000
      );
      if (res.ok) {
        const data = await res.json();
        updateISSPosition(svgEl, data.latitude, data.longitude);
      }
    } catch (err) {
      console.warn('[Space] ISS fetch failed:', err.message);
    }
  };
  update(); // Initial fetch
  _intervals.push(setInterval(update, 10000)); // 10s refresh
}

export function cleanup() {
  _intervals.forEach(id => clearInterval(id));
  _intervals = [];
}
```

### Pattern 2: Client-Side Currency Converter (Currencies)
**What:** Converter uses cached exchange rates for instant calculation -- no API call per conversion
**When to use:** Currency converter in currencies topic
**Example:**
```javascript
// Use rates from currencies.json cache
function convert(amount, fromRate, toRate) {
  // All rates are relative to USD base
  const inUSD = amount / fromRate;
  return inUSD * toRate;
}
// e.g., EUR->JPY: convert(100, rates.EUR, rates.JPY)
```

### Pattern 3: Calculated Real-Time Counters (Internet)
**What:** Display counters that calculate from known daily rates, not live APIs
**When to use:** Emails sent today, Google searches today, YouTube uploads today
**Example:**
```javascript
// Same pattern as population.js births/deaths clock
const EMAILS_PER_DAY = 332_000_000_000; // Statista 2025
const perSecond = EMAILS_PER_DAY / 86400;
const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

const update = () => {
  const elapsed = (Date.now() - startOfDay.getTime()) / 1000;
  counterEl.textContent = MathUtils.formatCompact(Math.round(elapsed * perSecond));
};
_intervals.push(setInterval(update, 1000));
```

### Pattern 4: SVG Sparklines (Weather)
**What:** Lightweight temperature sparklines using SVG polyline instead of Chart.js
**When to use:** 24 cities each need a small chart -- 24 Chart.js instances would be heavy
**Example:**
```javascript
function createSparkline(hourlyTemps, width = 120, height = 40) {
  const svg = DOMUtils.createSVG('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    height: String(height),
  });
  const min = Math.min(...hourlyTemps);
  const max = Math.max(...hourlyTemps);
  const range = max - min || 1;
  const points = hourlyTemps.map((t, i) => {
    const x = (i / (hourlyTemps.length - 1)) * width;
    const y = height - ((t - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  svg.appendChild(DOMUtils.createSVG('polyline', {
    points,
    fill: 'none',
    stroke: 'rgba(255,59,48,0.8)',
    'stroke-width': '1.5',
  }));
  return svg;
}
```

### Pattern 5: ISS Orbit Trail (Space)
**What:** Store last N positions in an array, render as SVG polyline on world map
**When to use:** ISS tracking with visible orbit path
**Example:**
```javascript
const MAX_TRAIL = 30; // ~5 minutes of positions at 10s intervals
let _trail = [];

function updateISSPosition(svgEl, lat, lng) {
  const { x, y } = MathUtils.geoToSVG(lat, lng, 900, 450);
  _trail.push({ x, y });
  if (_trail.length > MAX_TRAIL) _trail.shift();

  // Update trail polyline
  const trailPoints = _trail.map(p => `${p.x},${p.y}`).join(' ');
  trailEl.setAttribute('points', trailPoints);

  // Update ISS dot position
  dotEl.setAttribute('cx', String(x));
  dotEl.setAttribute('cy', String(y));
}
```

### Anti-Patterns to Avoid
- **24 Chart.js instances for weather sparklines:** Use SVG polylines instead -- Chart.js canvas per city is too heavy for 24 small charts
- **Live Nobel Prize API calls:** Data changes once per year -- hardcode top-15 countries with counts
- **Storing ISS orbit trail indefinitely:** Cap at 30 points and shift oldest; unlimited array growth causes memory leak
- **Fetching Open-Meteo for all 24 cities sequentially:** Use Promise.allSettled for parallel fetches with individual error handling
- **Missing cleanup for intervals:** Space and weather modules MUST clear all setInterval IDs in cleanup() -- population.js pattern proves this works

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG world map for ISS | Custom continent paths | Earthquake.js CONTINENT_PATHS + grid lines | Exact same SVG map structure with simplified continents is proven |
| Geo coordinate to SVG | Custom projection math | MathUtils.geoToSVG(lat, lng, 900, 450) | Already exists, tested in earthquakes.js |
| Currency conversion | Custom rate calculation | Simple division/multiplication with USD base | All rates in cache are USD-based, trivial math |
| Weather code interpretation | Complex WMO lookup | Static mapping object (code -> description + severity) | WMO codes are standardized, finite set (~20 used codes) |
| Data freshness badge | Custom badge UI | createTierBadge(tier, { age }) | Every topic uses this, proven pattern |
| Choropleth map | Custom SVG coloring | renderChoropleth() from detail/utils/choropleth.js | Handles world.svg fetch, ISO-2 mapping, tooltips, legend |
| Number formatting | Intl.NumberFormat wrapper | MathUtils.formatNumber() / formatCompact() | Already handles DE locale and compact notation (K/Mio/Mrd) |

**Key insight:** Phase 7 introduces no fundamentally new visualization patterns. ISS tracking is earthquake map + setInterval. Weather sparklines are SVG polylines. Currency converter is simple math. The complexity is in orchestrating multiple live API calls with proper fallback and cleanup.

## Common Pitfalls

### Pitfall 1: ISS API CORS Failure
**What goes wrong:** open-notify.org may not send CORS headers, blocking browser fetch
**Why it happens:** The API was designed for server-side use; browser support is uncertain
**How to avoid:** Use wheretheiss.at as primary (documented browser support, no auth). Fallback to hardcoded position + "CORS blocked" message. Test both APIs in browser before committing to one.
**Warning signs:** Console shows "Access-Control-Allow-Origin" error; ISS dot never moves

### Pitfall 2: Weather API Rate Limiting (24 Parallel Requests)
**What goes wrong:** Open-Meteo rejects requests when 24 cities are fetched simultaneously
**Why it happens:** Free tier may throttle burst requests from single origin
**How to avoid:** Use Promise.allSettled (not Promise.all) so individual city failures don't break the page. Add small stagger (50ms between requests) if needed. Show available cities immediately, load remaining progressively.
**Warning signs:** Many cities show "--" or fallback values despite API being online

### Pitfall 3: ISS Trail Wrapping at Date Line
**What goes wrong:** Orbit trail draws a line across the entire map when ISS crosses 180/-180 longitude
**Why it happens:** SVG polyline connects points linearly; crossing date line jumps x from ~900 to ~0
**How to avoid:** Detect when consecutive points have |dx| > 400 (half map width) and break into separate polyline segments. Or simply clear trail on date line crossing.
**Warning signs:** Horizontal line artifact across the middle of the SVG map

### Pitfall 4: Memory Leak from Unfired Cleanup
**What goes wrong:** setInterval calls keep running after navigating away from topic
**Why it happens:** cleanup() not called, or interval IDs not stored in module-level array
**How to avoid:** Follow population.js pattern exactly: store ALL interval IDs in _intervals array, clear ALL in cleanup(). Space module may have 1 interval (ISS refresh), weather may have 0 (one-shot fetch).
**Warning signs:** Console shows "[Space] ISS fetch" messages after navigating to different topic

### Pitfall 5: Currency Converter Input Validation
**What goes wrong:** User enters non-numeric input, gets NaN result
**Why it happens:** Input field accepts any text, parseFloat returns NaN for non-numbers
**How to avoid:** Use input type="number" with min="0" step="any". Check isNaN before displaying result. Show placeholder like "0.00" for invalid input.
**Warning signs:** Converter displays "NaN" or "undefined" in result

### Pitfall 6: Empty arXiv Category Data
**What goes wrong:** Hot research fields bar chart shows no data
**Why it happens:** arxiv-ai.json papers may not have category field, or categories are too granular (cs.AI vs cs.LG)
**How to avoid:** Map granular arXiv categories to broader field names (cs.AI/cs.LG/cs.CL -> "AI & ML", physics.* -> "Physics", math.* -> "Mathematics"). Fall back to hardcoded field distribution if cache has < 5 papers with categories.
**Warning signs:** Bar chart has only 1-2 bars, or all papers map to "Unknown"

## Code Examples

### Currency Converter DOM Structure
```javascript
// Source: Project pattern from population.js year selector
function _renderConverter(container, rates) {
  const amountInput = DOMUtils.create('input', {
    type: 'number',
    value: '100',
    min: '0',
    step: 'any',
    style: { /* glass-morphism input styling */ },
  });

  const fromSelect = _buildCurrencySelect(rates, 'EUR');
  const toSelect = _buildCurrencySelect(rates, 'USD');
  const resultEl = DOMUtils.create('div', { /* result display */ });

  const doConvert = () => {
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount < 0) { resultEl.textContent = '--'; return; }
    const fromRate = rates[fromSelect.value] || 1;
    const toRate = rates[toSelect.value] || 1;
    const result = (amount / fromRate) * toRate;
    resultEl.textContent = result.toFixed(2) + ' ' + toSelect.value;
  };

  amountInput.addEventListener('input', doConvert);
  fromSelect.addEventListener('change', doConvert);
  toSelect.addEventListener('change', doConvert);
  doConvert(); // Initial calculation
}
```

### WMO Weather Code Mapping
```javascript
// Source: WMO Code Table 4677 (NOAA/WMO standard)
const WMO_CODES = {
  0: { desc: 'Clear sky', icon: 'sun', severity: 0 },
  1: { desc: 'Mainly clear', icon: 'sun', severity: 0 },
  2: { desc: 'Partly cloudy', icon: 'cloud-sun', severity: 0 },
  3: { desc: 'Overcast', icon: 'cloud', severity: 0 },
  45: { desc: 'Fog', icon: 'fog', severity: 1 },
  48: { desc: 'Rime fog', icon: 'fog', severity: 1 },
  51: { desc: 'Light drizzle', icon: 'drizzle', severity: 1 },
  53: { desc: 'Moderate drizzle', icon: 'drizzle', severity: 1 },
  55: { desc: 'Dense drizzle', icon: 'drizzle', severity: 2 },
  61: { desc: 'Slight rain', icon: 'rain', severity: 1 },
  63: { desc: 'Moderate rain', icon: 'rain', severity: 2 },
  65: { desc: 'Heavy rain', icon: 'rain', severity: 3 },        // code > 65 threshold
  71: { desc: 'Slight snow', icon: 'snow', severity: 1 },
  73: { desc: 'Moderate snow', icon: 'snow', severity: 2 },
  75: { desc: 'Heavy snow', icon: 'snow', severity: 3 },        // code > 75 threshold
  77: { desc: 'Snow grains', icon: 'snow', severity: 1 },
  80: { desc: 'Slight showers', icon: 'showers', severity: 1 },
  81: { desc: 'Moderate showers', icon: 'showers', severity: 2 },
  82: { desc: 'Violent showers', icon: 'showers', severity: 3 },
  85: { desc: 'Slight snow showers', icon: 'snow', severity: 2 },
  86: { desc: 'Heavy snow showers', icon: 'snow', severity: 3 },
  95: { desc: 'Thunderstorm', icon: 'thunder', severity: 3 },   // code > 95 threshold
  96: { desc: 'Thunderstorm + hail', icon: 'thunder', severity: 4 },
  99: { desc: 'Severe thunderstorm', icon: 'thunder', severity: 4 },
};

// Severity color mapping for extreme weather warnings
function severityColor(severity) {
  if (severity >= 4) return '#ff3b30';   // Red -- severe
  if (severity >= 3) return '#ff9500';   // Orange -- heavy
  if (severity >= 2) return '#ffcc00';   // Yellow -- moderate
  return 'var(--text-secondary)';        // Gray -- normal
}
```

### 24 Weather Cities (All Continents)
```javascript
// Source: Requirement RT-02 -- 24 cities across all continents
const WEATHER_CITIES = [
  // Europe (5)
  { name: 'Berlin', lat: 52.52, lng: 13.41 },
  { name: 'London', lat: 51.51, lng: -0.13 },
  { name: 'Paris', lat: 48.86, lng: 2.35 },
  { name: 'Moscow', lat: 55.76, lng: 37.62 },
  { name: 'Rome', lat: 41.90, lng: 12.50 },
  // North America (4)
  { name: 'New York', lat: 40.71, lng: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Mexico City', lat: 19.43, lng: -99.13 },
  { name: 'Toronto', lat: 43.65, lng: -79.38 },
  // South America (3)
  { name: 'Sao Paulo', lat: -23.55, lng: -46.63 },
  { name: 'Buenos Aires', lat: -34.60, lng: -58.38 },
  { name: 'Lima', lat: -12.05, lng: -77.04 },
  // Asia (5)
  { name: 'Tokyo', lat: 35.68, lng: 139.69 },
  { name: 'Beijing', lat: 39.90, lng: 116.40 },
  { name: 'Mumbai', lat: 19.08, lng: 72.88 },
  { name: 'Dubai', lat: 25.20, lng: 55.27 },
  { name: 'Seoul', lat: 37.57, lng: 126.98 },
  // Africa (4)
  { name: 'Lagos', lat: 6.45, lng: 3.40 },
  { name: 'Cairo', lat: 30.04, lng: 31.24 },
  { name: 'Nairobi', lat: -1.29, lng: 36.82 },
  { name: 'Cape Town', lat: -33.93, lng: 18.42 },
  // Oceania (2)
  { name: 'Sydney', lat: -33.87, lng: 151.21 },
  { name: 'Auckland', lat: -36.85, lng: 174.76 },
  // Antarctica (1)
  { name: 'McMurdo', lat: -77.85, lng: 166.67 },
];
```

### ISS SVG Map Structure
```javascript
// Source: earthquakes.js SVG map pattern + ISS tracking
function _buildISSMap() {
  const svg = DOMUtils.createSVG('svg', {
    viewBox: '0 0 900 450',
    width: '100%',
    height: 'auto',
    style: 'display:block; background: rgba(255,255,255,0.02); border-radius: 8px;',
  });

  // Reuse CONTINENT_PATHS from earthquakes.js pattern
  for (const pathData of CONTINENT_PATHS) {
    svg.appendChild(DOMUtils.createSVG('path', {
      d: pathData,
      fill: 'rgba(255,255,255,0.05)',
      stroke: 'rgba(255,255,255,0.15)',
      'stroke-width': '0.5',
    }));
  }

  // Orbit trail polyline (updated every 10s)
  const trail = DOMUtils.createSVG('polyline', {
    points: '',
    fill: 'none',
    stroke: 'rgba(0, 255, 204, 0.4)',  // progress color
    'stroke-width': '1.5',
    'stroke-dasharray': '4,2',
  });
  svg.appendChild(trail);

  // ISS dot (pulsing)
  const dot = DOMUtils.createSVG('circle', {
    cx: '450', cy: '225', r: '6',
    fill: 'rgba(0, 255, 204, 0.9)',
    stroke: 'rgba(0, 255, 204, 0.3)',
    'stroke-width': '3',
  });
  svg.appendChild(dot);

  return { svg, trail, dot };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAQ for air quality | Open-Meteo Air Quality API | Jan 2025 (OpenAQ v2 HTTP 410) | Already handled in Phase 5 airquality.js |
| UCDP API for conflicts | Static fallback (token required since Feb 2026) | Phase 3 decision | Pattern: hardcode when API requires auth |
| open-notify.org ISS API | wheretheiss.at API (better CORS support) | 2024-2025 | Use wheretheiss.at as primary; open-notify as fallback |
| D3.js for maps | Pure SVG + DOMUtils.createSVG | Project architecture decision | Out of scope (REQUIREMENTS.md) |
| Leaflet/Mapbox for ISS | Simplified SVG world map | Project architecture decision | Out of scope (REQUIREMENTS.md) |

**Deprecated/outdated:**
- OpenAQ v2 API: returned HTTP 410 since Jan 2025, replaced by Open-Meteo
- UCDP API without token: requires authentication since Feb 2026

## Data Source Details

### Currencies (ECON-03)
| Data | Source | Type | CORS | Notes |
|------|--------|------|------|-------|
| Exchange rates | Open ER API (open.er-api.com) | Live + Cache | Yes | Free, no key, rate limited ~1/hour for free |
| 12-month historical | Hardcoded | Static | N/A | No free historical API without key; hardcode 12 monthly EUR/USD + USD/CNY |
| Hyperinflation list | Hardcoded | Static | N/A | Venezuela (VES), Zimbabwe (ZWL), Argentina (ARS), Turkey (TRY), Lebanon (LBP) |

### Science (PROG-01)
| Data | Source | Type | CORS | Notes |
|------|--------|------|------|-------|
| Recent papers | arxiv-ai.json cache | Cache | N/A | 20 papers with title, published, summary, category |
| Total papers | Hardcoded ~2.99M | Static | N/A | From arXiv stats page; updates slowly |
| Growth curve | Hardcoded annual submissions | Static | N/A | 1991-2025 annual submission counts from arXiv stats |
| Nobel prizes | Hardcoded top-15 countries | Static | N/A | Nobel API exists but adds latency for yearly-changing data |
| Hot fields | Extracted from cache | Cache | N/A | Map arXiv primary_category to broad field names |

### Internet (PROG-02)
| Data | Source | Type | CORS | Notes |
|------|--------|------|------|-------|
| Internet users % | Hardcoded World Bank | Static | N/A | IT.NET.USER.ZS global ~67% (2024); collected in pipeline but not cached separately |
| Daily email count | Calculated | Realtime | N/A | 332B/day (Statista 2025), calculated from time-of-day |
| Daily Google searches | Calculated | Realtime | N/A | ~8.5B/day (Internet Live Stats estimate) |
| YouTube uploads | Calculated | Realtime | N/A | ~500 hours/min (YouTube official) |
| Internet penetration by country | Hardcoded | Static | N/A | For choropleth: ~40 countries with internet % |

### Space (PROG-03)
| Data | Source | Type | CORS | Notes |
|------|--------|------|------|-------|
| ISS position | wheretheiss.at API | Live (10s) | Likely yes | No auth, ~1 req/s limit; test CORS in browser |
| ISS position fallback | open-notify.org | Live | Uncertain | May lack CORS headers; use as fallback |
| Crew list | Hardcoded | Static | N/A | Changes every ~6 months; hardcode current Expedition 74 crew |
| Spaceflight news | space-news.json cache | Cache | N/A | 10 articles from Spaceflight News API v4 |
| Satellite count | Hardcoded ~13,000 | Static | N/A | UCS Satellite Database 2025 estimate |

### Weather (RT-02)
| Data | Source | Type | CORS | Notes |
|------|--------|------|------|-------|
| Hourly forecasts | Open-Meteo /v1/forecast | Live | Yes | Free, no key, CORS-friendly; hourly=temperature_2m,weather_code&forecast_hours=24 |
| 24 cities | Hardcoded coordinates | Static | N/A | See WEATHER_CITIES array above |
| Weather codes | WMO Code Table 4677 | Static | N/A | Standardized; ~20 codes used in practice |
| Extreme warnings | Derived from weather_code | Calculated | N/A | Thresholds: >65 rain, >75 blizzard, >95 thunderstorm per REQUIREMENTS.md |

## Open Questions

1. **ISS API CORS in browser**
   - What we know: wheretheiss.at documentation doesn't explicitly confirm CORS headers. open-notify.org is even less clear.
   - What's unclear: Whether either API sends Access-Control-Allow-Origin: * in responses
   - Recommendation: Test both APIs with a browser fetch during implementation. If both fail, hardcode a sample ISS position and show "Live tracking unavailable" with static badge. The earthquakes.js pattern (live fetch with fallback) handles this gracefully.

2. **Open-Meteo burst request limit for 24 cities**
   - What we know: Open-Meteo is free for non-commercial use with no documented per-second limit for forecast endpoint
   - What's unclear: Whether 24 simultaneous requests trigger rate limiting
   - Recommendation: Use Promise.allSettled with 50ms stagger between city requests. Display cities progressively as data arrives.

3. **12-month historical exchange rate data**
   - What we know: currencies.json cache only has current rates (no historical). Free historical exchange rate APIs require API keys.
   - What's unclear: Whether to hardcode 12 monthly values or skip the chart
   - Recommendation: Hardcode 12 monthly EUR/USD and USD/CNY values from publicly available historical data. The chart is a requirement (ECON-03). Data is readily available from public sources and only needs 12 data points per pair.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework configured) |
| Config file | none |
| Quick run command | Open `detail/?topic=currencies` in browser |
| Full suite command | Open all 5 topic URLs sequentially |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ECON-03 | Currencies: rates hero, converter, 12mo charts, hyperinflation | manual | Open `detail/?topic=currencies`, test converter inputs, verify charts render | N/A |
| PROG-01 | Science: arXiv count, growth curve, fields bar, Nobel bubble | manual | Open `detail/?topic=science`, verify 4 visualization blocks render | N/A |
| PROG-02 | Internet: users %, counters increment, choropleth colors | manual | Open `detail/?topic=internet`, verify counters tick up, map has colored countries | N/A |
| PROG-03 | Space: ISS dot moves on map, trail visible, crew list, news feed | manual | Open `detail/?topic=space`, wait 30s, verify ISS dot moved 3+ times | N/A |
| RT-02 | Weather: 24 cities show temp + sparkline, warnings color-coded | manual | Open `detail/?topic=weather`, count city cards, check sparkline SVGs exist | N/A |

### Sampling Rate
- **Per task commit:** Open the implemented topic URL in browser, verify renders without console errors
- **Per wave merge:** Open all 5 topic URLs, verify interactivity (converter, counters, ISS tracking)
- **Phase gate:** All 5 topic URLs render successfully with correct data and no console errors

### Wave 0 Gaps
None -- no automated test infrastructure exists for the project. All validation is manual browser testing following the pattern established in Phases 4-6.

## Sources

### Primary (HIGH confidence)
- Existing codebase: 14 topic modules (co2, temperature, biodiversity, airquality, forests, renewables, population, conflicts, health, freedom, inequality, poverty, earthquakes, _stub) -- all patterns verified by reading source code
- currencies.json cache -- verified structure: base USD, 12 rates, _meta.fetched_at
- arxiv-ai.json cache -- verified structure: papers array with title/published/summary/url
- space-news.json cache -- verified structure: articles array with title/url/image_url/news_site/published_at/summary
- data-loader.js -- verified fetchTopicData() and fetchWithTimeout() signatures
- chart-manager.js -- verified ensureChartJs(), createChart(), CHART_COLORS, toRgba()
- choropleth.js -- verified renderChoropleth() with dataMap/colorFn/tooltipFn/legendItems
- detail-app.js -- verified VALID_TOPICS includes all 5 Phase 7 topics
- collect-data.js -- verified data source URLs: Open ER API, World Bank IT.NET.USER.ZS, arXiv, Spaceflight News API v4, Open-Meteo

### Secondary (MEDIUM confidence)
- [Open-Meteo API docs](https://open-meteo.com/en/docs) -- hourly=temperature_2m,weather_code&forecast_hours=24 parameter verified
- [Where The ISS At API docs](https://wheretheiss.at/w/developer) -- endpoint /v1/satellites/25544, no auth required, ~1 req/s limit
- [Nobel Prize API](https://www.nobelprize.org/about/developer-zone-2/) -- free, no key, JSON format confirmed
- [WMO Code Table 4677](https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM) -- weather code descriptions verified
- [arXiv stats](https://arxiv.org/stats/monthly_submissions) -- ~2.99M total papers as of March 2026
- [ExchangeRate-API docs](https://www.exchangerate-api.com/docs/free) -- free open access, CORS supported

### Tertiary (LOW confidence)
- ISS CORS support: Not explicitly documented for either open-notify.org or wheretheiss.at -- needs browser testing
- Open-Meteo burst rate limits: No documented per-second limit found -- needs empirical testing with 24 simultaneous requests
- Historical exchange rate availability: No free API confirmed for 12-month historical without API key -- hardcoding recommended

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- identical to Phase 6, all utilities proven in 14 modules
- Architecture: HIGH -- all patterns have precedent (SVG map from earthquakes, intervals from population, choropleth from biodiversity)
- Data sources: HIGH for cache-based (currencies, arXiv, space-news), MEDIUM for live APIs (ISS CORS uncertain, Open-Meteo burst limits unknown)
- Pitfalls: HIGH -- identified from codebase patterns and API documentation

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- APIs are free public services, unlikely to change rapidly)
