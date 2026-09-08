import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";

// Reputable, official/primary crypto & macro news feeds.
// Source abstraction: add/remove feeds here without touching the pipeline.
export const RSS_FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed" },
];

const parser = new XMLParser({ ignoreAttributes: false });

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "CryptoAndMarketsBot/1.0 (+https://github.com)" },
      timeout: 15000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = toArray(parsed?.rss?.channel?.item);
    return items.map((item) => ({
      source: feed.name,
      title: (item.title || "").toString().trim(),
      link: (item.link || "").toString().trim(),
      pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      summary: (item.description || "").toString().replace(/<[^>]+>/g, "").trim().slice(0, 500),
    }));
  } catch (err) {
    return { error: true, source: feed.name, message: err.message };
  }
}

/**
 * Collects raw candidate items from all configured RSS feeds.
 * Failures in one feed never block the others (graceful degradation).
 */
export async function collectRss() {
  const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
  const items = [];
  const errors = [];
  for (const r of results) {
    if (Array.isArray(r)) items.push(...r);
    else errors.push(r);
  }
  return { items, errors };
}
