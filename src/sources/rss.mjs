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
  { name: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
  { name: "NewsBTC", url: "https://www.newsbtc.com/feed/" },
  { name: "CryptoPotato", url: "https://cryptopotato.com/feed/" },
  { name: "U.Today", url: "https://u.today/rss" },
  { name: "AMBCrypto", url: "https://ambcrypto.com/feed/" },
  { name: "Blockworks", url: "https://blockworks.co/feed" },
  { name: "The Defiant", url: "https://thedefiant.io/feed" },
];

const parser = new XMLParser({ ignoreAttributes: false });

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function extractImage(item) {
  // Most feeds expose one of these — never fabricate an image if none exists.
  const media = item["media:content"];
  if (media) {
    const m = Array.isArray(media) ? media[0] : media;
    const url = m?.["@_url"];
    if (url) return url;
  }
  const thumb = item["media:thumbnail"];
  if (thumb) {
    const t = Array.isArray(thumb) ? thumb[0] : thumb;
    const url = t?.["@_url"];
    if (url) return url;
  }
  const enclosure = item.enclosure;
  if (enclosure?.["@_url"] && /image/i.test(enclosure?.["@_type"] || "")) {
    return enclosure["@_url"];
  }
  // Fallback: pull the first <img src="..."> out of the raw description HTML.
  const desc = item.description || "";
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(desc);
  return match ? match[1] : null;
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
      image: extractImage(item),
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
