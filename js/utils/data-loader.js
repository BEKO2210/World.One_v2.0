/* ═══════════════════════════════════════════════════════════
   World.One 1.0 — Data Loader (3-Tier Fallback)
   ═══════════════════════════════════════════════════════════ */

/**
 * Standalone data fetcher for detail pages.
 * NOT related to js/data-loader.js (main page world-state.json).
 *
 * 3-tier fallback: Live API -> Cached JSON -> Static fallback
 * Returns { data, tier: 'live'|'cache'|'static', age } so the
 * badge renderer knows which tier served the data.
 */

// ─── Module-level cache for static fallback ───
let _staticCache = null;

// ─── Fetch with timeout ───

/**
 * Fetch a URL with an automatic abort after `timeoutMs` milliseconds.
 * Uses AbortSignal.timeout() (supported since April 2024).
 *
 * @param {string} url - URL to fetch
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @returns {Promise<Response>} The fetch Response object
 * @throws On timeout or network error
 */
export async function fetchWithTimeout(url, timeoutMs = 5000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs)
  });
  return response;
}

// ─── 3-Tier fallback data fetcher ───

/**
 * Fetch topic data using a 3-tier fallback strategy:
 *   Tier 1 (live):   apiUrl with 5s timeout
 *   Tier 2 (cache):  data/cache/{topic}.json
 *   Tier 3 (static): data/fallback/static-values.json[topic]
 *
 * @param {string} topic - Topic key (e.g. 'co2', 'temperature')
 * @param {string|null} [apiUrl=null] - Live API URL (skipped if null)
 * @returns {Promise<{data: any, tier: string, age: number|null}>}
 */
export async function fetchTopicData(topic, apiUrl = null) {
  // ─── Tier 1: Live API ───
  if (apiUrl) {
    try {
      const response = await fetchWithTimeout(apiUrl, 5000);
      if (response.ok) {
        const data = await response.json();
        console.log(`[DataLoader] Live data for ${topic}`);
        return { data, tier: 'live', age: 0 };
      }
    } catch (err) {
      console.warn(`[DataLoader] Live failed for ${topic}:`, err.message);
    }
  }

  // ─── Tier 2: Cached JSON file ───
  try {
    const cacheUrl = `data/cache/${topic}.json`;
    const response = await fetch(cacheUrl);
    if (response.ok) {
      const data = await response.json();
      const age = _getCacheAge(data);
      console.log(`[DataLoader] Cache hit for ${topic}`);
      return { data, tier: 'cache', age };
    }
  } catch (err) {
    console.warn(`[DataLoader] Cache failed for ${topic}:`, err.message);
  }

  // ─── Tier 3: Static fallback ───
  try {
    const staticData = await _getStaticFallback(topic);
    console.log(`[DataLoader] Static fallback for ${topic}`);
    return { data: staticData, tier: 'static', age: null };
  } catch (err) {
    console.warn(`[DataLoader] Static failed for ${topic}:`, err.message);
    return { data: null, tier: 'static', age: null };
  }
}

// ─── Private helpers ───

/**
 * Calculate cache age from _meta.fetched_at timestamp.
 * @param {object} data - Cached JSON data
 * @returns {number|null} Age in milliseconds, or null if no timestamp
 */
function _getCacheAge(data) {
  if (data && data._meta && data._meta.fetched_at) {
    const fetchedAt = new Date(data._meta.fetched_at).getTime();
    if (!isNaN(fetchedAt)) {
      return Date.now() - fetchedAt;
    }
  }
  return null;
}

/**
 * Load and cache the static fallback file, then return the topic value.
 * The full JSON is fetched only once and stored in `_staticCache`.
 *
 * @param {string} topic - Topic key to extract
 * @returns {Promise<any>} The topic's fallback data, or null
 */
async function _getStaticFallback(topic) {
  if (!_staticCache) {
    const response = await fetch('data/fallback/static-values.json');
    if (!response.ok) {
      throw new Error(`Static fallback fetch failed: ${response.status}`);
    }
    _staticCache = await response.json();
  }

  const topicData = _staticCache[topic];
  return topicData !== undefined ? topicData : null;
}
