#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Shared Cache Utilities
   Reusable fetch, extraction, and cache-writing functions
   for all cache-pipeline scripts.
   ═══════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Directory where all cache JSON files are written */
export const CACHE_DIR = join(__dirname, '..', 'data', 'cache');

const TIMEOUT = 25000;

// ─── HTTP Fetch JSON with timeout + retry ───
/**
 * Fetch a URL and parse as JSON, with retries and timeout.
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.retries=2]
 * @param {number} [options.timeout=15000]
 * @param {object} [options.headers={}]
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, options = {}) {
  const { retries = 3, timeout = TIMEOUT, headers = {} } = options;
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
      const data = await res.json();
      if (data === null || data === undefined) throw new Error('Empty JSON response');
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ─── HTTP Fetch Text with timeout + retry ───
/**
 * Fetch a URL and return as text, with retries and timeout.
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.retries=2]
 * @param {number} [options.timeout=15000]
 * @param {object} [options.headers={}]
 * @returns {Promise<string>}
 */
export async function fetchText(url, options = {}) {
  const { retries = 3, timeout = TIMEOUT, headers = {} } = options;
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
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ─── Safe World Bank data extraction ───
/**
 * Extract and clean World Bank API v2 response entries.
 * @param {any} data - Raw World Bank response (array where [1] contains entries)
 * @param {object} [options]
 * @param {number} [options.roundDigits=1]
 * @returns {Array<{year: number, value: number}>}
 */
export function extractWorldBankEntries(data, options = {}) {
  const { roundDigits = 1 } = options;
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  return data[1]
    .filter(e => e && e.value !== null && e.value !== undefined)
    .map(e => ({
      year: parseInt(e.date),
      value: roundDigits >= 0
        ? Math.round(e.value * Math.pow(10, roundDigits)) / Math.pow(10, roundDigits)
        : e.value
    }))
    .filter(e => !isNaN(e.year) && Number.isFinite(e.value))
    .sort((a, b) => a.year - b.year);
}

// ─── Write cache JSON file ───
/**
 * Write a cache JSON file with _meta envelope.
 * @param {string} filename - e.g. 'biodiversity.json'
 * @param {object} data - Topic-specific data to wrap
 */
export function saveCache(filename, data) {
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
