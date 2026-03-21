#!/usr/bin/env node

/* ═══════════════════════════════════════════════════════════
   World.One 1.0 — Static Fallback Validator
   ═══════════════════════════════════════════════════════════
   Validates data/fallback/static-values.json schema integrity.
   Exit 0 on success, exit 1 on any validation failure.
   ═══════════════════════════════════════════════════════════ */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_PATH = join(__dirname, '..', 'data', 'fallback', 'static-values.json');

const EXPECTED_TOPICS = [
  'airquality', 'biodiversity', 'co2', 'conflicts', 'crypto_sentiment',
  'currencies', 'disasters', 'earthquakes', 'endangered', 'extinction',
  'forests', 'freedom', 'health', 'hunger', 'inequality', 'internet',
  'momentum_detail', 'ocean_ph', 'ocean_plastic', 'ocean_temp',
  'population', 'poverty', 'renewables', 'science', 'solar', 'space',
  'temperature', 'weather'
];

let errors = 0;
let populated = 0;
let placeholders = 0;

function fail(msg) {
  console.log(`  \u2718 ${msg}`);
  errors++;
}

function pass(msg) {
  console.log(`  \u2714 ${msg}`);
}

// ─── Read and parse JSON ───
console.log('\nValidating static-values.json...\n');

let data;
try {
  const raw = readFileSync(FALLBACK_PATH, 'utf8');
  data = JSON.parse(raw);
  pass('JSON parsed successfully');
} catch (err) {
  fail(`JSON parse error: ${err.message}`);
  process.exit(1);
}

// ─── Validate _meta ───
if (!data._meta) {
  fail('Missing _meta object');
} else {
  if (!data._meta.version) {
    fail('_meta.version is missing');
  } else {
    pass(`_meta.version: ${data._meta.version}`);
  }

  if (!data._meta.last_updated) {
    fail('_meta.last_updated is missing');
  } else {
    pass(`_meta.last_updated: ${data._meta.last_updated}`);
  }
}

// ─── Validate all 28 topic keys exist ───
const missingTopics = [];
const extraTopics = [];

for (const topic of EXPECTED_TOPICS) {
  if (!(topic in data)) {
    missingTopics.push(topic);
  }
}

const dataKeys = Object.keys(data).filter(k => k !== '_meta');
for (const key of dataKeys) {
  if (!EXPECTED_TOPICS.includes(key)) {
    extraTopics.push(key);
  }
}

if (missingTopics.length > 0) {
  fail(`Missing topics: ${missingTopics.join(', ')}`);
} else {
  pass(`All ${EXPECTED_TOPICS.length} topic keys present`);
}

if (extraTopics.length > 0) {
  console.log(`  ! Unexpected topics: ${extraTopics.join(', ')}`);
}

// ─── Validate data point schema for non-null topics ───
for (const topic of EXPECTED_TOPICS) {
  if (!(topic in data)) continue;

  const topicData = data[topic];

  if (topicData === null) {
    placeholders++;
    continue;
  }

  if (typeof topicData !== 'object') {
    fail(`${topic}: expected object or null, got ${typeof topicData}`);
    continue;
  }

  populated++;
  const points = Object.entries(topicData);

  for (const [pointName, pointData] of points) {
    if (!pointData || typeof pointData !== 'object') {
      fail(`${topic}.${pointName}: expected object with { value, year, source }`);
      continue;
    }

    if (!('value' in pointData)) {
      fail(`${topic}.${pointName}: missing 'value' field`);
    }
    if (!('year' in pointData)) {
      fail(`${topic}.${pointName}: missing 'year' field`);
    }
    if (!('source' in pointData)) {
      fail(`${topic}.${pointName}: missing 'source' field`);
    }
  }
}

// ─── Summary ───
console.log('\n--- Summary ---');
console.log(`  Total topics:     ${EXPECTED_TOPICS.length}`);
console.log(`  Populated:        ${populated}`);
console.log(`  Placeholders:     ${placeholders}`);
console.log(`  Validation errors: ${errors}`);

if (errors > 0) {
  console.log(`\n\u2718 Validation FAILED with ${errors} error(s)\n`);
  process.exit(1);
} else {
  console.log(`\n\u2714 Validation PASSED\n`);
  process.exit(0);
}
