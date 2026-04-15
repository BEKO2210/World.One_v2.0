#!/usr/bin/env node

/**
 * generate-meta.js — Cache Pipeline Meta Aggregator
 *
 * Reads current cache state and updates data/cache/meta.json with pipeline health stats.
 * Called after each cache job in cache-pipeline.yml with:
 *   node scripts/generate-meta.js --job <name> --status <success|failure>
 *
 * Exports: generateMeta (for programmatic use)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'data', 'cache');
const META_PATH = join(CACHE_DIR, 'meta.json');

/** Hardcoded job-to-files mapping */
const JOB_FILES = {
  'biodiversity': ['biodiversity.json'],
  'environment-ext': ['co2-history.json', 'ocean.json', 'solar.json'],
  'society-ext': ['population.json', 'freedom.json', 'conflicts.json'],
  'economy-ext': ['currencies.json', 'inequality.json', 'poverty.json'],
  'progress-ext': ['arxiv-ai.json', 'space-news.json'],
  'disasters': ['disasters.json', 'hunger.json'],
  'live-data': [
    'temperature.json', 'forests.json', 'renewables.json',
    'airquality.json', 'weather.json', 'earthquakes.json',
    'crypto_sentiment.json', 'science.json', 'space.json', 'health.json',
    'internet.json'
  ]
};

/**
 * Count data points in a cache file.
 * - If top-level has arrays: sum their lengths
 * - If top-level has objects with arrays: sum nested array lengths
 * - Fallback: count top-level keys minus _meta
 */
function countDataPoints(data) {
  if (!data || typeof data !== 'object') return 0;

  let points = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key === '_meta') continue;
    if (Array.isArray(value)) {
      points += value.length;
    } else if (typeof value === 'object' && value !== null) {
      // Check for nested arrays
      let hasNestedArrays = false;
      for (const nested of Object.values(value)) {
        if (Array.isArray(nested)) {
          points += nested.length;
          hasNestedArrays = true;
        }
      }
      if (!hasNestedArrays) {
        points += 1; // Count the object itself as one data point
      }
    } else {
      points += 1; // Scalar value counts as one data point
    }
  }
  return points;
}

/**
 * Generate or update meta.json based on current cache state and job result.
 * @param {string} jobName - Which job just ran (e.g., 'biodiversity')
 * @param {string} jobStatus - Job outcome: 'success' or 'failure'
 * @returns {object} The meta object written to disk
 */
export function generateMeta(jobName, jobStatus) {
  // Ensure cache directory exists
  mkdirSync(CACHE_DIR, { recursive: true });

  // Read existing meta.json if it exists
  let meta = {};
  if (existsSync(META_PATH)) {
    try {
      meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
    } catch {
      meta = {};
    }
  }

  // Initialize job_details if not present
  if (!meta.job_details || typeof meta.job_details !== 'object') {
    meta.job_details = {};
  }

  // Normalize status: GitHub Actions reports 'success'/'failure'/'cancelled'
  const normalizedStatus = jobStatus === 'success' ? 'ok' : 'failed';

  // Update this job's details
  if (jobName && JOB_FILES[jobName]) {
    meta.job_details[jobName] = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
      files: JOB_FILES[jobName]
    };
  }

  // List all .json files in cache dir excluding meta.json
  let cacheFiles = [];
  try {
    cacheFiles = readdirSync(CACHE_DIR)
      .filter(f => f.endsWith('.json') && f !== 'meta.json');
  } catch {
    cacheFiles = [];
  }

  // Count total data points across all cache files
  let totalDataPoints = 0;
  for (const file of cacheFiles) {
    try {
      const data = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8'));
      totalDataPoints += countDataPoints(data);
    } catch {
      // Skip corrupted files
    }
  }

  // Recount jobs_ok and jobs_failed from job_details
  const jobStatuses = Object.values(meta.job_details);
  meta.jobs_ok = jobStatuses.filter(j => j.status === 'ok').length;
  meta.jobs_failed = jobStatuses.filter(j => j.status === 'failed').length;

  // Set aggregate fields
  meta.last_full_update = new Date().toISOString();
  meta.total_cache_files = cacheFiles.length;
  meta.total_data_points = totalDataPoints;

  // Write meta.json
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  console.log(`  meta.json updated: ${meta.jobs_ok} ok, ${meta.jobs_failed} failed, ${meta.total_cache_files} files, ${meta.total_data_points} data points`);

  return meta;
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);
  let jobName = null;
  let jobStatus = 'success';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--job' && args[i + 1]) {
      jobName = args[i + 1];
      i++;
    } else if (args[i] === '--status' && args[i + 1]) {
      jobStatus = args[i + 1];
      i++;
    }
  }

  if (!jobName) {
    console.error('Usage: node scripts/generate-meta.js --job <name> --status <success|failure>');
    console.error('Jobs:', Object.keys(JOB_FILES).join(', '));
    process.exit(1);
  }

  if (!JOB_FILES[jobName]) {
    console.error(`Unknown job: ${jobName}`);
    console.error('Valid jobs:', Object.keys(JOB_FILES).join(', '));
    process.exit(1);
  }

  generateMeta(jobName, jobStatus);
}

main();
