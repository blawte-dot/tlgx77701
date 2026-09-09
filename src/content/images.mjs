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
 * Resolves the image to attach to a post for a given event, or null if
 * none is appropriate. Never invents an image — either it's the real
 * source article's image, or a real chart of real market data.
 */
export function resolveImage(event) {
  if (event.kind === "market_move" && event.meta?.sparkline?.length > 1) {
    return {
      type: "chart",
      url: buildMarketChartUrl(event.meta.symbol, event.meta.sparkline, event.meta.change24h >= 0),
    };
  }
  if (event.image && /^https?:\/\//.test(event.image)) {
    return { type: "article", url: event.image };
  }
  return null;
}
