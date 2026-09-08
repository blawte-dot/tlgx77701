import { collectRss } from "./rss.mjs";
import { collectMarketSnapshot, detectMarketMoves } from "./market.mjs";

/**
 * Collects everything from every configured source. Each source is
 * independent — one failing never blocks the others.
 */
export async function collectAll() {
  const [rss, marketSnapshot] = await Promise.all([collectRss(), collectMarketSnapshot()]);

  const marketMoves = detectMarketMoves(marketSnapshot);

  const newsCandidates = rss.items.map((item) => ({
    kind: "news",
    source: item.source,
    title: item.title,
    link: item.link,
    summary: item.summary,
    publishedAt: item.pubDate,
    collectedAt: new Date().toISOString(),
  }));

  const marketCandidates = marketMoves.map((m) => ({
    kind: "market_move",
    source: "CoinGecko",
    title: `${m.symbol} ${m.change24h >= 0 ? "up" : "down"} ${Math.abs(m.change24h).toFixed(1)}% in 24h`,
    link: null,
    summary: `${m.symbol} is trading at $${m.price.toLocaleString()}, ${m.change24h >= 0 ? "up" : "down"} ${Math.abs(m.change24h).toFixed(1)}% over the last 24 hours.`,
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    meta: m,
  }));

  return {
    candidates: [...newsCandidates, ...marketCandidates],
    marketSnapshot: Array.isArray(marketSnapshot) ? marketSnapshot : [],
    errors: [...(rss.errors || []), ...(marketSnapshot?.error ? [marketSnapshot] : [])],
  };
}
