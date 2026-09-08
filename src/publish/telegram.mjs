import fetch from "node-fetch";
import { config, missingSecrets } from "../config.mjs";
import { costControl } from "../costControl.mjs";
import { store } from "../state/store.mjs";

/**
 * Publishes a message to the configured Telegram channel via the
 * Bot API. Respects DRY_RUN and the daily budget guard. Never throws
 * on missing config — returns a structured result instead.
 */
export async function publishToTelegram({ text, event }) {
  const missing = missingSecrets("telegram");
  if (missing.length > 0) {
    return { published: false, reason: "missing_secrets", missing };
  }
  if (!costControl.canPublishToTelegram()) {
    return { published: false, reason: "daily_budget_reached" };
  }
  if (config.dryRun) {
    return { published: false, reason: "dry_run", wouldPublish: text };
  }

  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram.channelId,
        text,
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || "Telegram API error");

    costControl.recordTelegramPost();
    store.append("telegramMessages", {
      messageId: data.result.message_id,
      text,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    store.append("published", {
      platform: "telegram",
      postId: data.result.message_id,
      text,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    return { published: true, messageId: data.result.message_id };
  } catch (err) {
    store.append("errors", {
      where: "publishToTelegram",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
    return { published: false, reason: "api_error", error: err.message };
  }
}
