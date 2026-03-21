#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   World.One — Progress Extended Cache Generator
   Fetches arXiv AI papers and spaceflight news
   Output: data/cache/arxiv-ai.json, space-news.json
   ═══════════════════════════════════════════════════════════════ */

import { fetchJSON, fetchText, saveCache } from './cache-utils.js';

// ─── arXiv AI Papers ───
async function fetchArxivAI() {
  console.log('  Fetching arXiv AI papers...');
  const url = 'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20';
  const xml = await fetchText(url);

  // Extract total results
  const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  const total_results = totalMatch ? parseInt(totalMatch[1]) : 0;

  // Extract entries using regex (matching existing collect-data.js approach)
  const entryBlocks = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  const papers = [];

  for (const block of entryBlocks) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const publishedMatch = block.match(/<published>([\s\S]*?)<\/published>/);
    const summaryMatch = block.match(/<summary>([\s\S]*?)<\/summary>/);
    const linkMatch = block.match(/<link[^>]*href="(https:\/\/arxiv\.org\/abs\/[^"]+)"[^>]*\/>/);

    const title = titleMatch
      ? titleMatch[1].replace(/\s+/g, ' ').trim()
      : 'Untitled';
    const published = publishedMatch
      ? publishedMatch[1].trim()
      : '';
    const summary = summaryMatch
      ? summaryMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200)
      : '';
    const paperUrl = linkMatch
      ? linkMatch[1]
      : '';

    papers.push({ title, published, summary, url: paperUrl });
  }

  console.log(`  arXiv: ${papers.length} papers (${total_results} total results)`);
  return { papers, total_results };
}

// ─── Spaceflight News ───
async function fetchSpaceNews() {
  console.log('  Fetching spaceflight news...');
  const url = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=10&ordering=-published_at';
  const data = await fetchJSON(url);

  if (!data || !Array.isArray(data.results)) {
    throw new Error('No results in spaceflight news response');
  }

  const articles = data.results.map(a => ({
    title: a.title,
    url: a.url,
    image_url: a.image_url,
    news_site: a.news_site,
    published_at: a.published_at,
    summary: a.summary
  }));

  console.log(`  Space news: ${articles.length} articles`);
  return { articles };
}

// ─── Main ───
async function main() {
  console.log('=== update-progress-ext ===');
  let filesWritten = 0;

  // arXiv AI
  try {
    const arxivData = await fetchArxivAI();
    saveCache('arxiv-ai.json', arxivData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR arxiv-ai: ${err.message}`);
  }

  // Space News
  try {
    const spaceData = await fetchSpaceNews();
    saveCache('space-news.json', spaceData);
    filesWritten++;
  } catch (err) {
    console.error(`  ERROR space-news: ${err.message}`);
  }

  console.log(`Done: ${filesWritten} files written`);
  if (filesWritten === 0) {
    console.error('FATAL: No files were written');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
