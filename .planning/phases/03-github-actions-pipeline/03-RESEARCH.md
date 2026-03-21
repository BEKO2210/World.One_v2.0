# Phase 3: GitHub Actions Pipeline - Research

**Researched:** 2026-03-21
**Domain:** GitHub Actions CI/CD, Staggered Cron Scheduling, Cache File Generation, Service Worker Versioning
**Confidence:** HIGH

## Summary

Phase 3 extends the existing data-pipeline.yml workflow (which already runs every 6 hours collecting 40+ sources into data/raw/ for world-state.json) with six new staggered cron jobs that produce per-group cache JSON files under data/cache/. These cache files feed the detail page data-loader's Tier 2 fallback (see js/utils/data-loader.js: `data/cache/${topic}.json`). The service worker must also be updated with versioned cache name and routing for data/cache/ paths.

The existing collect-data.js already fetches many of the needed APIs (World Bank, NOAA, USGS, etc.) but writes to data/raw/ for processing into world-state.json. The new cache jobs produce separate per-topic JSON files in data/cache/ with a `_meta.fetched_at` timestamp that the detail data-loader uses to calculate cache age for badge rendering.

**Primary recommendation:** Use a single workflow file with multiple cron triggers and `github.event.schedule`-based conditional job execution. Each of the 6 jobs writes its cache files independently, and a final meta-update step runs after all jobs to produce data/cache/meta.json. All jobs use `timeout-minutes: 10` and `continue-on-error: true`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACTIONS-01 | Extended workflow with staggered cron jobs (30min gaps) for new cache files | Single workflow with 6 cron triggers (03:00-05:30 UTC), `github.event.schedule` conditional execution. See Architecture section. |
| ACTIONS-02 | Job: update-biodiversity (03:00 UTC) -> data/cache/biodiversity.json | GBIF Species API (free, no key). See API mapping below. |
| ACTIONS-03 | Job: update-environment-ext (03:30 UTC) -> co2-history.json, ocean.json, solar.json | NOAA CO2 CSV, NOAA SST, NOAA SWPC. All free, no key needed. Existing patterns in collect-data.js. |
| ACTIONS-04 | Job: update-society-ext (04:00 UTC) -> population.json, freedom.json, conflicts.json | World Bank API (free), Freedom House XLS cached/pre-processed, UCDP API (now requires token since Feb 2026). |
| ACTIONS-05 | Job: update-economy-ext (04:30 UTC) -> currencies.json, inequality.json, poverty.json | Open ER API (free), World Bank Gini/Poverty (free). Existing patterns in collect-data.js. |
| ACTIONS-06 | Job: update-progress-ext (05:00 UTC) -> arxiv-ai.json, space-news.json | arXiv API (free), Spaceflight News API v4 (free). Existing patterns in collect-data.js. |
| ACTIONS-07 | Job: update-disasters (05:30 UTC) -> disasters.json, hunger.json | ReliefWeb API (free, 1000 calls/day limit), World Bank hunger indicators (free). |
| ACTIONS-08 | All jobs: timeout 10min, continue-on-error: true, never block deployment | GitHub Actions native `timeout-minutes` and `continue-on-error` at job level. See Patterns section. |
| ACTIONS-09 | data/cache/meta.json with last_full_update, jobs_ok, jobs_failed, total_cache_files, total_data_points | Post-run meta aggregation step counting files in data/cache/ and parsing job outcomes. |
| INFRA-07 | Service worker updated with versioned cache name and data/cache/ route handling | Update CACHE_NAME to 'worldone-v2', add 'data/cache/' to DATA_PATHS array, ensure network-first strategy for cache files. |
</phase_requirements>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GitHub Actions | N/A | CI/CD workflow engine | Already in use; data-pipeline.yml is the foundation |
| actions/checkout | v4 | Repository checkout | Already used in existing workflows |
| actions/setup-node | v4 | Node.js 20 setup with npm cache | Already used in existing workflows |
| Node.js | 20 | Script runtime for cache generation | Matches existing `env.NODE_VERSION: '20'` in data-pipeline.yml |

### Supporting
| Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/upload-artifact | v4 | Share data between jobs if needed | Only if meta aggregation job needs cache file manifests |
| actions/github-script | v7 | In-workflow JavaScript for meta.json generation | Alternative to separate Node script for meta aggregation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single workflow + conditionals | 6 separate workflow files | Separate files = cleaner per-job isolation but 6x YAML duplication, harder to maintain shared config, no cross-job meta aggregation |
| Node.js cache scripts | Shell-only fetch+jq | Shell is simpler but lacks retry logic, JSON validation, and the established fetchJSON/extractWorldBankEntries patterns |
| Inline workflow steps | Dedicated scripts/cache-*.js files | Separate scripts = testable, reusable, but adds file count; inline = self-contained but harder to debug |

**Installation:** No new dependencies needed. The existing `rss-parser` and `xml2js` in package.json cover RSS/XML parsing. All other APIs return JSON.

## Architecture Patterns

### Recommended Project Structure
```
.github/workflows/
  data-pipeline.yml          # EXISTING - main pipeline (unchanged)
  deploy-only.yml            # EXISTING - manual deploy (unchanged)
  cache-pipeline.yml         # NEW - staggered cache jobs for detail pages

scripts/
  collect-data.js            # EXISTING - main data collection (unchanged)
  cache-biodiversity.js      # NEW - biodiversity cache generator
  cache-environment-ext.js   # NEW - co2-history, ocean, solar
  cache-society-ext.js       # NEW - population, freedom, conflicts
  cache-economy-ext.js       # NEW - currencies, inequality, poverty
  cache-progress-ext.js      # NEW - arxiv-ai, space-news
  cache-disasters.js         # NEW - disasters, hunger

data/cache/                  # NEW directory - all cache files
  biodiversity.json
  co2-history.json
  ocean.json
  solar.json
  population.json
  freedom.json
  conflicts.json
  currencies.json
  inequality.json
  poverty.json
  arxiv-ai.json
  space-news.json
  disasters.json
  hunger.json
  meta.json                  # Pipeline health metadata
```

### Pattern 1: Single Workflow with Conditional Job Execution
**What:** One workflow file with 6 cron triggers; `github.event.schedule` used in `if:` conditions to determine which job runs.
**When to use:** When staggered jobs share infrastructure (checkout, node setup, commit pattern) and need coordinated meta tracking.
**Example:**
```yaml
# Source: GitHub Actions Docs - events-that-trigger-workflows
name: Cache Pipeline

on:
  schedule:
    - cron: '0 3 * * *'     # 03:00 UTC - biodiversity
    - cron: '30 3 * * *'    # 03:30 UTC - environment-ext
    - cron: '0 4 * * *'     # 04:00 UTC - society-ext
    - cron: '30 4 * * *'    # 04:30 UTC - economy-ext
    - cron: '0 5 * * *'     # 05:00 UTC - progress-ext
    - cron: '30 5 * * *'    # 05:30 UTC - disasters
  workflow_dispatch:
    inputs:
      job_group:
        description: 'Which cache group to update (or "all")'
        required: false
        default: 'all'
        type: choice
        options: [all, biodiversity, environment-ext, society-ext, economy-ext, progress-ext, disasters]

jobs:
  update-biodiversity:
    if: >-
      github.event.schedule == '0 3 * * *' ||
      github.event_name == 'workflow_dispatch' && (github.event.inputs.job_group == 'all' || github.event.inputs.job_group == 'biodiversity')
    runs-on: ubuntu-latest
    timeout-minutes: 10
    continue-on-error: true
    steps:
      # ... checkout, setup-node, run script, commit
```

### Pattern 2: Cache File Schema (Tier 2 Contract)
**What:** Every cache JSON file MUST include `_meta.fetched_at` ISO timestamp so the data-loader can compute cache age for badge rendering.
**When to use:** Every cache file written by every job.
**Example:**
```javascript
// Source: js/utils/data-loader.js lines 94-102
// The detail page data-loader reads _meta.fetched_at to determine age:
//   if (data && data._meta && data._meta.fetched_at) {
//     const fetchedAt = new Date(data._meta.fetched_at).getTime();
//     return Date.now() - fetchedAt;
//   }

// Cache file output schema:
const cacheOutput = {
  _meta: {
    fetched_at: new Date().toISOString(),  // REQUIRED - data-loader uses this
    source: 'cache-pipeline',
    version: '1.0'
  },
  // ... topic-specific data fields
};
```

### Pattern 3: Resilient Git Commit per Job
**What:** Each job independently commits its cache files and pushes. Pull-rebase handles concurrent pushes.
**When to use:** Every job's final step.
**Example:**
```yaml
# Source: existing data-pipeline.yml commit pattern (lines 192-206)
- name: Commit cache files
  run: |
    git config user.name "World.One Pipeline"
    git config user.email "pipeline@world.one"
    git add data/cache/*.json
    if git diff --staged --quiet; then
      echo "No changes to commit"
    else
      git commit -m "chore(cache): update ${{ matrix.group || 'data' }} cache $(date -u '+%Y-%m-%d %H:%M UTC')"
      git push || {
        git pull --rebase origin $(git branch --show-current) && git push
      }
    fi
```

### Pattern 4: meta.json Aggregation
**What:** After each job commits, a separate step (or the commit step itself) updates data/cache/meta.json with pipeline health stats.
**When to use:** After every cache job.
**Example:**
```javascript
// meta.json schema matching ACTIONS-09:
{
  "last_full_update": "2026-03-21T05:30:00.000Z",
  "jobs_ok": 5,
  "jobs_failed": 1,
  "total_cache_files": 14,
  "total_data_points": 847,
  "job_details": {
    "biodiversity": { "status": "ok", "updated_at": "...", "files": ["biodiversity.json"] },
    "environment-ext": { "status": "ok", "updated_at": "...", "files": ["co2-history.json", "ocean.json", "solar.json"] }
    // ... etc
  }
}
```

### Anti-Patterns to Avoid
- **Single monolithic cache job:** Running all API calls in one job means one timeout kills everything. Split by domain group.
- **Shared mutable state between jobs:** Jobs run on separate runners. Do NOT rely on filesystem state from a previous job. Each job must checkout fresh.
- **cancel-in-progress: true on cache pipeline:** Unlike the main pipeline, cache jobs are independent. Canceling a running biodiversity job because economy-ext triggered would lose biodiversity data. Use `cancel-in-progress: false` (or omit).
- **Hard-coding cache file paths in service worker PRECACHE_ASSETS:** Cache files change frequently. They belong in DATA_PATHS (network-first), not PRECACHE_ASSETS (install-time cache).
- **Committing without pull-rebase:** When jobs run 30 minutes apart, the repo state may have changed. Always `git pull --rebase` before push.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetch with retry | Custom retry loop per script | Reuse existing `fetchJSON`/`fetchText` patterns from collect-data.js | 15s timeout, 2 retries, User-Agent header already proven across 40+ APIs |
| World Bank data extraction | Manual JSON parsing per indicator | Reuse `extractWorldBankEntries()` from collect-data.js | Handles nulls, sorts, rounds, filters -- 30+ World Bank calls already validated |
| Git commit in Actions | Custom shell logic | Adapt existing commit pattern from data-pipeline.yml lines 192-206 | Handles no-changes case, pull-rebase retry, proper user config |
| meta.json data point counting | Complex per-file parsing | Simple `fs.readdirSync` + JSON.parse for each file counting top-level array lengths | Over-engineering meta counting adds fragility |
| Cron scheduling | External cron service or GitHub App | GitHub Actions native `schedule` trigger | Already works reliably for the existing 6-hour pipeline |

**Key insight:** The existing collect-data.js has battle-tested HTTP fetch utilities (`fetchJSON`, `fetchText`, `extractWorldBankEntries`) and the data-pipeline.yml has a proven commit-push pattern. Extract and reuse these patterns rather than writing new ones.

## Common Pitfalls

### Pitfall 1: Cron Schedule Drift and Delays
**What goes wrong:** GitHub Actions scheduled workflows can be delayed by 5-30 minutes during peak load. Cron times are not guaranteed exact.
**Why it happens:** GitHub queues scheduled workflow runs; high-demand periods cause delays.
**How to avoid:** Don't design logic that depends on exact execution times. Use 30-minute gaps (not 5-minute). Each job is self-contained and idempotent.
**Warning signs:** meta.json timestamps showing >45 minute gaps between jobs.

### Pitfall 2: Concurrent Git Push Race Conditions
**What goes wrong:** Two jobs running near-simultaneously both try to push, one fails because HEAD has moved.
**Why it happens:** Jobs that overlap in execution both checkout at the same commit, then push sequentially.
**How to avoid:** Always `git pull --rebase` before push. The 30-minute stagger makes this unlikely but not impossible (drift + retries can cause overlap).
**Warning signs:** Push failures in workflow logs.

### Pitfall 3: Missing _meta.fetched_at in Cache Files
**What goes wrong:** Detail page badges show "Static" instead of "Cache" because data-loader can't compute cache age.
**Why it happens:** Cache script writes data without the `_meta` object.
**How to avoid:** Every cache script MUST include `_meta: { fetched_at: new Date().toISOString() }` in output JSON. Add validation in meta aggregation step.
**Warning signs:** Badge renderer showing gray "Static" badges when cache files exist.

### Pitfall 4: UCDP API Now Requires Token (Feb 2026)
**What goes wrong:** UCDP conflict data fetch fails with 401/403.
**Why it happens:** UCDP introduced mandatory API tokens in February 2026 for all API access.
**How to avoid:** Either request a UCDP token and store as GitHub Secret, or use a pre-processed static conflicts dataset (updated periodically) as the cache source. The data-loader already has Tier 3 static fallback.
**Warning signs:** conflicts.json consistently failing in meta.json.

### Pitfall 5: Service Worker Cache Name Not Bumped
**What goes wrong:** Browsers keep serving old cached data after service worker update because cache name didn't change.
**Why it happens:** Updating DATA_PATHS without bumping CACHE_NAME means old service worker's activate handler doesn't purge old cache.
**How to avoid:** Change CACHE_NAME from 'worldone-v1' to 'worldone-v2' (or use a hash/date). The existing activate handler already purges caches that don't match CACHE_NAME.
**Warning signs:** Users report stale data after deployment.

### Pitfall 6: Cache File Naming Mismatch
**What goes wrong:** data-loader fetches `data/cache/co2.json` but the cache pipeline writes `data/cache/co2-history.json`.
**Why it happens:** Topic name in detail-app.js VALID_TOPICS doesn't match the cache filename.
**How to avoid:** Document the exact filename-to-topic mapping. The data-loader uses `data/cache/${topic}.json` where topic comes from the URL parameter. For topics like "co2" the cache file MUST be `co2.json` (or the topic module must override the default cache path).
**Warning signs:** 404s in browser network tab for cache files.

## Code Examples

### Cache Script Template (Reusing Existing Patterns)
```javascript
// Source: Pattern derived from scripts/collect-data.js
#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'data', 'cache');
const TIMEOUT = 15000;

// Reuse fetchJSON pattern from collect-data.js
async function fetchJSON(url, options = {}) {
  const { retries = 2, timeout = TIMEOUT, headers = {} } = options;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'BelkisOne/1.0 CachePipeline', ...headers }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

function saveCache(filename, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const output = {
    _meta: {
      fetched_at: new Date().toISOString(),
      source: 'cache-pipeline',
      version: '1.0'
    },
    ...data
  };
  writeFileSync(join(CACHE_DIR, filename), JSON.stringify(output, null, 2));
  console.log(`  OK ${filename}`);
}

// ... topic-specific fetch functions
```

### Service Worker Update (INFRA-07)
```javascript
// Source: Existing service-worker.js + INFRA-07 requirement
const CACHE_NAME = 'worldone-v2';  // BUMPED from v1

// Add data/cache/ to data paths for network-first strategy
const DATA_PATHS = [
  '/world-state.json',
  '/manifest.json',
  '/data/',          // Already covers data/cache/ via includes() check
];
// Note: The existing includes() check on line 58 of service-worker.js
// already matches 'data/cache/' because '/data/' is in DATA_PATHS.
// Verify this works correctly; if not, add explicit '/data/cache/' entry.
```

### meta.json Generation Script
```javascript
// Source: ACTIONS-09 requirement
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'data', 'cache');

function generateMeta(jobResults) {
  const cacheFiles = readdirSync(CACHE_DIR)
    .filter(f => f.endsWith('.json') && f !== 'meta.json');

  let totalDataPoints = 0;
  for (const file of cacheFiles) {
    try {
      const data = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8'));
      // Count data points: array lengths or object key counts
      totalDataPoints += countDataPoints(data);
    } catch { /* skip corrupted files */ }
  }

  const meta = {
    last_full_update: new Date().toISOString(),
    jobs_ok: jobResults.filter(j => j.status === 'ok').length,
    jobs_failed: jobResults.filter(j => j.status === 'failed').length,
    total_cache_files: cacheFiles.length,
    total_data_points: totalDataPoints,
  };

  writeFileSync(join(CACHE_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAQ API v2 for air quality | Open-Meteo Air Quality API | Jan 2025 (OpenAQ v2 sunset HTTP 410) | collect-data.js already migrated; cache scripts should use same approach |
| UCDP API open access | UCDP API requires x-ucdp-access-token | Feb 2026 | Conflicts cache must handle auth or use static data |
| actions/cache v2 | actions/cache v5 (Node 24 runtime) | Feb 2025 | Use v5 if adding npm caching to cache pipeline |
| Freedom House CSV/API | Excel download only | Ongoing | No API available; pre-process XLS to JSON manually or use static data |

**Deprecated/outdated:**
- OpenAQ v2 API: Returns HTTP 410 since Jan 2025; use Open-Meteo Air Quality instead
- actions/cache v1-v2: Sunset Feb 2025; use v4+ if caching npm dependencies
- UCDP open API: Requires token since Feb 2026; plan accordingly

## API Mapping for Cache Jobs

### ACTIONS-02: update-biodiversity (03:00 UTC)
| Cache File | API | Auth | Notes |
|------------|-----|------|-------|
| biodiversity.json | GBIF Species API (`api.gbif.org/v1/species/search`) | None | Free, no key. Query threatened species counts by IUCN status. |

### ACTIONS-03: update-environment-ext (03:30 UTC)
| Cache File | API | Auth | Notes |
|------------|-----|------|-------|
| co2-history.json | NOAA Mauna Loa CSV | None | Same source as collect-data.js `fetchNOAACO2()`. Extended monthly data for Keeling Curve. |
| ocean.json | NOAA OISST / Coral Reef Watch | None | SST anomaly data. `https://coralreefwatch.noaa.gov/product/vs/data/` |
| solar.json | NOAA SWPC Solar Indices | None | Same as collect-data.js `fetchSolarActivity()`. |

### ACTIONS-04: update-society-ext (04:00 UTC)
| Cache File | API | Auth | Notes |
|------------|-----|------|-------|
| population.json | World Bank SP.POP.TOTL | None | Same pattern as collect-data.js. Extended with regional breakdowns. |
| freedom.json | Static pre-processed data | None | Freedom House has no API. Use pre-processed JSON from their annual Excel release. |
| conflicts.json | UCDP API or static | Token (since Feb 2026) | Consider static fallback if token not available. Store token as `UCDP_API_TOKEN` secret. |

### ACTIONS-05: update-economy-ext (04:30 UTC)
| Cache File | API | Auth | Notes |
|------------|-----|------|-------|
| currencies.json | Open ER API (`open.er-api.com/v6/latest/USD`) | None | Same as collect-data.js `fetchExchangeRates()`. |
| inequality.json | World Bank SI.POV.GINI | None | Same pattern as collect-data.js. |
| poverty.json | World Bank SI.POV.DDAY | None | Same pattern as collect-data.js. |

### ACTIONS-06: update-progress-ext (05:00 UTC)
| Cache File | API | Auth | Notes |
|------------|-----|------|-------|
| arxiv-ai.json | arXiv API (export.arxiv.org) | None | Same as collect-data.js. Filter for AI/ML categories. |
| space-news.json | Spaceflight News API v4 | None | Same as collect-data.js `fetchSpaceflightNews()`. |

### ACTIONS-07: update-disasters (05:30 UTC)
| Cache File | API | Auth | Notes |
|------------|-----|------|-------|
| disasters.json | ReliefWeb API (`api.reliefweb.int/v1/disasters`) | None | Free, max 1000 calls/day. Query recent disasters with country/type/affected. |
| hunger.json | World Bank SN.ITK.DEFC.ZS (undernourishment) | None | Standard World Bank pattern. |

## Critical Design Decision: Shared Utility Module

The six cache scripts (`cache-biodiversity.js`, etc.) share common patterns: `fetchJSON`, `fetchText`, `extractWorldBankEntries`, `saveCache`. Rather than duplicating these in each file:

**Recommendation:** Extract shared utilities into `scripts/cache-utils.js` that all cache scripts import.

```
scripts/
  cache-utils.js             # fetchJSON, fetchText, extractWorldBankEntries, saveCache
  cache-biodiversity.js      # imports from cache-utils.js
  cache-environment-ext.js   # imports from cache-utils.js
  ...
```

This avoids code duplication while keeping each cache script focused on its domain-specific API calls.

## Open Questions

1. **UCDP API Token Availability**
   - What we know: UCDP introduced mandatory tokens in Feb 2026. Token can be requested from UCDP team.
   - What's unclear: Whether the project has already requested a token or plans to.
   - Recommendation: Plan for both paths -- try token-based API, fall back to static conflicts data from last UCDP annual release. Store token as GitHub Secret if available.

2. **Cache File Naming vs Topic Module Names**
   - What we know: The data-loader fetches `data/cache/${topic}.json` where topic matches URL parameter (e.g., `?topic=co2`).
   - What's unclear: Some requirements specify different filenames (e.g., ACTIONS-03 says "co2-history.json" but the topic is "co2").
   - Recommendation: Two options: (a) name cache files exactly as topics (`co2.json`, not `co2-history.json`) so the data-loader works without modification, or (b) have topic modules specify their own cache path. Option (a) is simpler.

3. **meta.json Update Strategy Across Staggered Jobs**
   - What we know: Each job runs independently 30min apart. meta.json needs aggregate stats.
   - What's unclear: How to count jobs_ok/jobs_failed across separate runs that happen at different times.
   - Recommendation: Each job updates meta.json incrementally -- reading existing meta, updating its own status, recounting files. The "last_full_update" is set by whichever job ran last (the 05:30 disasters job).

4. **GitHub Actions Minutes Budget**
   - What we know: STATE.md lists this as a concern. 6 new jobs x ~2-5 min each = 12-30 min/day.
   - What's unclear: Whether the project is on free tier (2000 min/month) or paid.
   - Recommendation: 30 min/day x 30 days = 900 min/month. Combined with existing pipeline (4 runs/day x ~20 min = ~80 min/day = 2400 min/month), total could approach or exceed free tier limits. Monitor after first week.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js native test runner (node:test) or manual validation scripts |
| Config file | none -- see Wave 0 |
| Quick run command | `node scripts/validate-cache.js` (new) |
| Full suite command | `node scripts/validate-cache.js --full` (new) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTIONS-01 | Workflow file parses and has 6 cron triggers | smoke | `python -c "import yaml; yaml.safe_load(open('.github/workflows/cache-pipeline.yml'))"` or `node -e "..."` | No -- Wave 0 |
| ACTIONS-02 | biodiversity.json produced with _meta.fetched_at | integration | `node scripts/cache-biodiversity.js && node -e "const d=JSON.parse(require('fs').readFileSync('data/cache/biodiversity.json','utf8')); if(!d._meta?.fetched_at) process.exit(1)"` | No -- Wave 0 |
| ACTIONS-03 | co2-history.json, ocean.json, solar.json produced | integration | `node scripts/cache-environment-ext.js && ls data/cache/co2-history.json data/cache/ocean.json data/cache/solar.json` | No -- Wave 0 |
| ACTIONS-04 | population.json, freedom.json, conflicts.json produced | integration | `node scripts/cache-society-ext.js && ls data/cache/population.json data/cache/freedom.json data/cache/conflicts.json` | No -- Wave 0 |
| ACTIONS-05 | currencies.json, inequality.json, poverty.json produced | integration | `node scripts/cache-economy-ext.js && ls data/cache/currencies.json data/cache/inequality.json data/cache/poverty.json` | No -- Wave 0 |
| ACTIONS-06 | arxiv-ai.json, space-news.json produced | integration | `node scripts/cache-progress-ext.js && ls data/cache/arxiv-ai.json data/cache/space-news.json` | No -- Wave 0 |
| ACTIONS-07 | disasters.json, hunger.json produced | integration | `node scripts/cache-disasters.js && ls data/cache/disasters.json data/cache/hunger.json` | No -- Wave 0 |
| ACTIONS-08 | Each job has timeout: 10 and continue-on-error: true | unit | `node -e "const y=require('fs').readFileSync('.github/workflows/cache-pipeline.yml','utf8'); const jobs=['update-biodiversity','update-environment-ext','update-society-ext','update-economy-ext','update-progress-ext','update-disasters']; for(const j of jobs){if(!y.includes('timeout-minutes: 10'))process.exit(1);}"` | No -- Wave 0 |
| ACTIONS-09 | meta.json has required fields | unit | `node -e "const m=JSON.parse(require('fs').readFileSync('data/cache/meta.json','utf8')); ['last_full_update','jobs_ok','jobs_failed','total_cache_files','total_data_points'].forEach(k=>{if(!(k in m))process.exit(1)})"` | No -- Wave 0 |
| INFRA-07 | Service worker has versioned cache and data/cache route | unit | `node -e "const sw=require('fs').readFileSync('service-worker.js','utf8'); if(!sw.includes('worldone-v2'))process.exit(1)"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/validate-cache.js` (validates schema of any cache files present)
- **Per wave merge:** Full validation of all cache files + service worker + workflow YAML
- **Phase gate:** All cache scripts run successfully locally + workflow YAML validates + service worker updated

### Wave 0 Gaps
- [ ] `scripts/validate-cache.js` -- validates all cache files have _meta.fetched_at, valid JSON, expected fields
- [ ] `data/cache/` directory with .gitkeep -- ensure directory exists in repo
- [ ] YAML validation for workflow file syntax

## Sources

### Primary (HIGH confidence)
- [GitHub Actions Docs - Workflow Syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) - cron syntax, timeout-minutes, continue-on-error, github.event.schedule
- [GitHub Actions Docs - Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) - schedule trigger, github.event.schedule context
- [GitHub Actions Docs - Concurrency control](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) - concurrency groups, cancel-in-progress
- Existing `data-pipeline.yml` (lines 1-313) - proven patterns for checkout, node setup, collect, commit, push, deploy
- Existing `scripts/collect-data.js` (817 lines) - fetchJSON, fetchText, extractWorldBankEntries, save patterns
- Existing `js/utils/data-loader.js` (123 lines) - Tier 2 cache contract: `data/cache/${topic}.json` with `_meta.fetched_at`
- Existing `service-worker.js` (88 lines) - current CACHE_NAME, DATA_PATHS, fetch strategy

### Secondary (MEDIUM confidence)
- [GBIF API Documentation](https://techdocs.gbif.org/en/openapi/v1/species) - species search API
- [UCDP API Documentation](https://ucdp.uu.se/apidocs/) - conflict data API (now requires token)
- [ReliefWeb API](https://reliefweb.int/help/api) - disaster data (1000 calls/day)
- [GitHub Community - Multiple schedules discussion](https://github.com/orgs/community/discussions/25662) - conditional job execution per schedule

### Tertiary (LOW confidence)
- UCDP token requirement timing (Feb 2026) - based on single web search result, should be verified by attempting API access
- GitHub Actions minutes budget estimation - based on assumptions about job duration, needs real measurement

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in use in existing workflows and scripts
- Architecture: HIGH - pattern directly extends existing proven data-pipeline.yml
- Pitfalls: HIGH - based on analysis of existing codebase contracts and verified API documentation
- API availability: MEDIUM - most APIs verified free/no-key, UCDP token situation is LOW confidence

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain; GitHub Actions rarely has breaking changes within 30 days)
