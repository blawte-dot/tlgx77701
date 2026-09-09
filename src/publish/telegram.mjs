import fetch from "node-fetch";
import { config, missingSecrets } from "../config.mjs";
import { costControl } from "../costControl.mjs";
import { store } from "../state/store.mjs";

async function sendTextMessage(text) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegram.channelId, text, disable_web_page_preview: false }),
  });
  return res.json();
}

async function sendPhotoMessage(imageUrl, caption) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendPhoto`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegram.channelId, photo: imageUrl, caption }),
  });
  return res.json();
}

/**
 * Publishes a message to the configured Telegram channel via the
 * Bot API. Sends as a photo (with the post text as caption) when a
 * real image is available, otherwise a plain text message. Respects
 * DRY_RUN and the daily budget guard. Never throws on missing config —
 * returns a structured result instead.
 */
export async function publishToTelegram({ text, event, image }) {
  const missing = missingSecrets("telegram");
  if (missing.length > 0) {
    return { published: false, reason: "missing_secrets", missing };
  }
  if (!costControl.canPublishToTelegram()) {
    return { published: false, reason: "daily_budget_reached" };
  }
  if (config.dryRun) {
    return { published: false, reason: "dry_run", wouldPublish: text, wouldAttachImage: image?.url || null };
  }

  try {
    // Telegram photo captions are capped at 1024 chars — fall back to a
    // plain text message if the post is longer than that.
    const canUsePhoto = image?.url && text.length <= 1024;
    const data = canUsePhoto ? await sendPhotoMessage(image.url, text) : await sendTextMessage(text);
    if (!data.ok) throw new Error(data.description || "Telegram API error");

    costControl.recordTelegramPost();
    store.append("telegramMessages", {
      messageId: data.result.message_id,
      text,
      hasImage: canUsePhoto,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    store.append("published", {
      platform: "telegram",
      postId: data.result.message_id,
      text,
      hasImage: canUsePhoto,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    return { published: true, messageId: data.result.message_id, hasImage: canUsePhoto };
  } catch (err) {
    store.append("errors", {
      where: "publishToTelegram",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
    return { published: false, reason: "api_error", error: err.message };
  }
}
