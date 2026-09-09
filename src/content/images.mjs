// Free, no-key chart image generator — turns a price series into a
// shareable line chart image via a URL (no API key, no billing).
const QUICKCHART_BASE = "https://quickchart.io/chart";

function buildMarketChartUrl(symbol, points, changeUp) {
  const config = {
    type: "line",
    data: {
      labels: points.map((_, i) => i),
      datasets: [
        {
          label: symbol,
          data: points,
          borderColor: changeUp ? "#16c784" : "#ea3943",
          backgroundColor: changeUp ? "rgba(22,199,132,0.15)" : "rgba(234,57,67,0.15)",
          fill: true,
          pointRadius: 0,
          borderWidth: 3,
        },
      ],
    },
    options: {
      title: { display: true, text: `${symbol} — 24h`, fontColor: "#e6e6e6" },
      legend: { display: false },
      scales: {
        xAxes: [{ display: false }],
        yAxes: [{ ticks: { fontColor: "#aaaaaa" }, gridLines: { color: "#333333" } }],
      },
      backgroundColor: "#111318",
    },
  };
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `${QUICKCHART_BASE}?c=${encoded}&backgroundColor=%23111318&width=800&height=450&devicePixelRatio=2`;
}

/**
 * Resolves the image to attach to a post for a given event. Never
 * invents an image — it's always either the real source article's
 * image, a real chart of the specific coin the event is about, or (as
 * a last resort, so every post still gets a real image) a chart of
 * whichever tracked coin moved the most in the live snapshot right now.
 */
export function resolveImage(event, marketSnapshot = []) {
  if (event.kind === "market_move" && event.meta?.sparkline?.length > 1) {
    return {
      type: "chart",
      url: buildMarketChartUrl(event.meta.symbol, event.meta.sparkline, event.meta.change24h >= 0),
    };
  }
  if (event.image && /^https?:\/\//.test(event.image)) {
    return { type: "article", url: event.image };
  }
  if (Array.isArray(marketSnapshot) && marketSnapshot.length > 0) {
    const withSparkline = marketSnapshot.filter((c) => c.sparkline?.length > 1);
    if (withSparkline.length > 0) {
      const top = withSparkline.reduce(
        (best, c) => (Math.abs(c.change24h ?? 0) > Math.abs(best.change24h ?? 0) ? c : best),
        withSparkline[0]
      );
      return {
        type: "chart",
        url: buildMarketChartUrl(top.symbol, top.sparkline, (top.change24h ?? 0) >= 0),
      };
    }
  }
  return null;
}
