// Deliberately varied hook styles so posts never fall into a
// repetitive template ("Breaking:" every time, etc).
const HOOK_STYLES = [
  "question", "number", "direct_fact", "surprise", "warning",
  "context", "opinion", "analytical_opening", "curiosity",
];

const X_FORMATS = ["short_post", "medium_post", "thread", "chart_commentary", "question", "poll"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Chooses an X content format based on the event's kind/importance. */
export function chooseXFormat(event) {
  if (event.importance >= 8) return pick(["medium_post", "thread"]);
  if (event.kind === "market_move") return pick(["short_post", "chart_commentary"]);
  return pick(X_FORMATS);
}

/** Chooses a Telegram content format — always meant to add depth beyond the X post. */
export function chooseTelegramFormat(event) {
  if (event.importance >= 8) return "deep_dive";
  if (event.kind === "market_move") return "market_alert";
  return pick(["breaking_alert", "deep_dive", "risk_alert"]);
}

export function chooseHookStyle() {
  return pick(HOOK_STYLES);
}

/** Emoji usage varies: none, one, or a couple — never a fixed pattern. */
export function chooseEmojiPolicy() {
  return pick(["none", "single", "light"]);
}

/** Hashtags: mostly none, occasionally one, only when it adds discoverability. */
export function chooseHashtagPolicy() {
  return pick(["none", "none", "none", "one"]);
}
