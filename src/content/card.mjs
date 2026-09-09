import { createCanvas } from "canvas";

const WIDTH = 800;
const HEIGHT = 450;

const KICKER_LABELS = {
  question: "SOMETHING TO THINK ABOUT",
  meme: "MARKET MOOD",
  trend_pulse: "MARKET PULSE",
  deep_dive: "DEEP DIVE",
  default: "CRYPTO & MARKETS",
};

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a simple branded card (dark background, kicker label, headline
 * text) as a PNG buffer. Used only as a fallback when no real photo or
 * chart exists for a post, so every post can carry an image without ever
 * fabricating a fake "photo" of something specific.
 */
export function renderCard({ headline, type = "default" }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#0b0e14");
  gradient.addColorStop(1, "#151a24");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Accent bar
  ctx.fillStyle = "#16c784";
  ctx.fillRect(0, 0, 8, HEIGHT);

  // Kicker label
  ctx.fillStyle = "#16c784";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(KICKER_LABELS[type] || KICKER_LABELS.default, 48, 70);

  // Headline (wrapped, vertically centered-ish)
  ctx.fillStyle = "#f2f2f2";
  ctx.font = "bold 40px sans-serif";
  const maxWidth = WIDTH - 96;
  const lines = wrapLines(ctx, headline, maxWidth).slice(0, 6);
  const lineHeight = 52;
  const startY = HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, 48, startY + i * lineHeight);
  });

  // Footer / brand
  ctx.fillStyle = "#7a8699";
  ctx.font = "20px sans-serif";
  ctx.fillText("Crypto & Markets", 48, HEIGHT - 36);

  return canvas.toBuffer("image/png");
}
