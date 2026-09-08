import fetch from "node-fetch";
import { config, missingSecrets } from "../config.mjs";
import { store } from "../state/store.mjs";

/**
 * Pulls what the Telegram Bot API actually exposes about the channel
 * (member count). Per-post views/forwards/reactions are NOT available
 * through the Bot API — that requires the channel owner's own Telegram
 * client/MTProto access, which this bot does not have. This is
 * documented here rather than silently faked.
 */
async function collectTelegramMemberCount() {
  if (missingSecrets("telegram").length > 0) return null;
  try {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/getChatMemberCount?chat_id=${config.telegram.channelId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return null;
    return data.result;
  } catch {
    return null;
  }
}

export async function runAnalyticsCollection() {
  const memberCount = await collectTelegramMemberCount();
  const snapshot = {
    timestamp: new Date().toISOString(),
    telegramSubscribers: memberCount,
  };
  store.append("performance", snapshot);

  const published = store.getAll("published", []);
  const last24h = published.filter(
    (p) => Date.now() - new Date(p.timestamp).getTime() < 24 * 3_600_000
  );

  return {
    snapshot,
    postsLast24h: last24h.length,
    xPostsLast24h: last24h.filter((p) => p.platform === "x").length,
    telegramPostsLast24h: last24h.filter((p) => p.platform === "telegram").length,
  };
}

// Allows `npm run analytics` to run this standalone.
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnalyticsCollection().then((r) => {
    console.log(JSON.stringify(r, null, 2));
  });
}
