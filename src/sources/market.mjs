import fetch from "node-fetch";
import { config } from "../config.mjs";

const TRACKED_COINS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

/**
 * Pulls current price + 24h change for the tracked coins.
 * Used both as a data source for market-observation posts and as
 * context the AI can reference when writing analysis.
 */
export async function collectMarketSnapshot() {
  try {
    const url = `${config.coingeckoBaseUrl}/coins/markets?vs_currency=usd&ids=${TRACKED_COINS.join(",")}&sparkline=true`;
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      change24h: c.price_change_percentage_24h,
      marketCap: c.market_cap,
      // Last ~24h of the 7d sparkline, thinned to a manageable point count for the chart.
      sparkline: (c.sparkline_in_7d?.price || []).slice(-24),
    }));
  } catch (err) {
    return { error: true, source: "CoinGecko", message: err.message };
  }
}

/**
 * Flags coins whose 24h move exceeds a threshold — a simple, honest
 * "market alert" trigger that doesn't require guessing at causes.
 */
export function detectMarketMoves(snapshot, thresholdPct = 5) {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.filter((c) => Math.abs(c.change24h ?? 0) >= thresholdPct);
}
