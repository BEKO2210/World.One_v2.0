#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Cache Validation Utility
   Validates cache file structure, freshness, and completeness.

   Usage:
     node scripts/validate-cache.js            # Basic validation
     node scripts/validate-cache.js --full     # Full expected file check
     node scripts/validate-cache.js --check-workflow  # Workflow YAML check
   ═══════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'data', 'cache');
const WORKFLOW_PATH = join(__dirname, '..', '.github', 'workflows', 'cache-pipeline.yml');
const PREFIX = '[validate-cache]';

const EXPECTED_FILES = [
  'biodiversity.json',
  'co2-history.json',
  'ocean.json',
  'solar.json',
  'population.json',
  'freedom.json',
  'conflicts.json',
  'currencies.json',
  'inequality.json',
  'poverty.json',
  'arxiv-ai.json',
  'space-news.json',
  'disasters.json',
  'hunger.json',
  // Live-data cache expansion (cache-live-data.js)
  'temperature.json',
  'forests.json',
  'renewables.json',
  'airquality.json',
  'weather.json',
  'earthquakes.json',
  'crypto_sentiment.json',
  'science.json',
  'space.json',
  'health.json',
  'internet.json'
];

const EXPECTED_JOBS = [
  'update-biodiversity',
  'update-environment-ext',
  'update-society-ext',
  'update-economy-ext',
  'update-progress-ext',
  'update-disasters',
  'update-live-data'
];

// ─── Utility: Format duration ───
function formatAge(ms) {
  if (ms < 0) return 'future?';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Basic Validation ───
function validateBasic() {
  console.log(`${PREFIX} Validating cache files in ${CACHE_DIR}`);

  if (!existsSync(CACHE_DIR)) {
    console.log(`${PREFIX} WARNING: Cache directory does not exist yet`);
    return { passed: true, files: [], warnings: ['Cache directory does not exist'] };
  }

  const jsonFiles = readdirSync(CACHE_DIR)
    .filter(f => f.endsWith('.json') && f !== 'meta.json');

  if (jsonFiles.length === 0) {
    console.log(`${PREFIX} WARNING: No cache files found (not an error -- files may not be generated yet)`);
    return { passed: true, files: [], warnings: ['No cache files found'] };
  }

  const results = [];
  let allValid = true;

  for (const file of jsonFiles) {
    const filePath = join(CACHE_DIR, file);
    const result = { file, valid: false, age: '-', dataKeys: 0, error: null };

    try {
      const raw = readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);

      // Check 1: Has _meta object
      if (!data._meta || typeof data._meta !== 'object') {
        result.error = 'Missing _meta object';
        allValid = false;
        results.push(result);
        continue;
      }

      // Check 2: Has _meta.fetched_at
      if (!data._meta.fetched_at || typeof data._meta.fetched_at !== 'string') {
        result.error = 'Missing _meta.fetched_at';
        allValid = false;
        results.push(result);
        continue;
      }

      // Check 3: fetched_at is a valid date
      const fetchedDate = new Date(data._meta.fetched_at);
      if (isNaN(fetchedDate.getTime())) {
        result.error = 'Invalid _meta.fetched_at date';
        allValid = false;
        results.push(result);
        continue;
      }

      // Check 4: At least one data key besides _meta
      const dataKeys = Object.keys(data).filter(k => k !== '_meta');
      if (dataKeys.length === 0) {
        result.error = 'No data keys besides _meta';
        allValid = false;
        results.push(result);
        continue;
      }

      result.valid = true;
      result.age = formatAge(Date.now() - fetchedDate.getTime());
      result.dataKeys = dataKeys.length;
    } catch (err) {
      result.error = err.message.includes('JSON') ? 'Invalid JSON' : err.message;
      allValid = false;
    }

    results.push(result);
  }

  // Print results table
  console.log('');
  console.log(`${'File'.padEnd(25)} ${'Valid'.padEnd(7)} ${'Age'.padEnd(10)} ${'Keys'.padEnd(6)} Error`);
  console.log('-'.repeat(70));
  for (const r of results) {
    const valid = r.valid ? 'yes' : 'NO';
    const error = r.error || '';
    console.log(`${r.file.padEnd(25)} ${valid.padEnd(7)} ${r.age.padEnd(10)} ${String(r.dataKeys).padEnd(6)} ${error}`);
  }
  console.log('');

  const validCount = results.filter(r => r.valid).length;
  console.log(`${PREFIX} ${validCount}/${results.length} files valid`);

  return { passed: allValid, files: results, warnings: [] };
}

// ─── Full Mode: Check Expected Files ───
function validateFull(basicResult) {
  console.log(`${PREFIX} Checking expected file list (${EXPECTED_FILES.length} files)...`);

  const presentFiles = basicResult.files.map(r => r.file);
  const missing = EXPECTED_FILES.filter(f => !presentFiles.includes(f));
  const invalid = basicResult.files.filter(r => !r.valid).map(r => r.file);

  if (missing.length > 0) {
    console.log(`${PREFIX} MISSING expected files: ${missing.join(', ')}`);
  }
  if (invalid.length > 0) {
    console.log(`${PREFIX} INVALID files: ${invalid.join(', ')}`);
  }

  const fullPassed = missing.length === 0 && invalid.length === 0;
  if (fullPassed) {
    console.log(`${PREFIX} All ${EXPECTED_FILES.length} expected files present and valid`);
  }

  return fullPassed;
}

// ─── Workflow Check Mode ───
function validateWorkflow() {
  console.log(`${PREFIX} Checking workflow file: ${WORKFLOW_PATH}`);

  if (!existsSync(WORKFLOW_PATH)) {
    console.log(`${PREFIX} FAIL: Workflow file not found`);
    return false;
  }

  const yaml = readFileSync(WORKFLOW_PATH, 'utf8');
  let allPassed = true;

  // Check all 6 job names exist
  for (const job of EXPECTED_JOBS) {
    if (!yaml.includes(`${job}:`)) {
      console.log(`${PREFIX} FAIL: Missing job "${job}"`);
      allPassed = false;
    } else {
      console.log(`${PREFIX} OK: Found job "${job}"`);
    }
  }

  // Check timeout-minutes: 10 exists (at least once)
  if (!yaml.includes('timeout-minutes: 10')) {
    console.log(`${PREFIX} FAIL: No "timeout-minutes: 10" found`);
    allPassed = false;
  } else {
    console.log(`${PREFIX} OK: timeout-minutes: 10 present`);
  }

  // Check continue-on-error: true exists (at least once)
  if (!yaml.includes('continue-on-error: true')) {
    console.log(`${PREFIX} FAIL: No "continue-on-error: true" found`);
    allPassed = false;
  } else {
    console.log(`${PREFIX} OK: continue-on-error: true present`);
  }

  if (allPassed) {
    console.log(`${PREFIX} Workflow validation PASSED`);
  } else {
    console.log(`${PREFIX} Workflow validation FAILED`);
  }

  return allPassed;
}

// ─── Main ───
function main() {
  const args = process.argv.slice(2);
  const fullMode = args.includes('--full');
  const workflowMode = args.includes('--check-workflow');

  if (workflowMode) {
    const passed = validateWorkflow();
    process.exit(passed ? 0 : 1);
  }

  const basicResult = validateBasic();

  if (!basicResult.passed) {
    process.exit(1);
  }

  if (fullMode) {
    const fullPassed = validateFull(basicResult);
    process.exit(fullPassed ? 0 : 1);
  }

  // Basic mode passed
  process.exit(0);
}

main();
