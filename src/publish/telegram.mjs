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
  const body = { chat_id: config.telegram.channelId, photo: imageUrl };
  if (caption) body.caption = caption;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Always the same order: full text first, then the image as its own
 *  message right after it — never image-on-top, never random. */
async function sendTextThenPhoto(text, imageUrl) {
  const textResult = await sendTextMessage(text);
  if (!textResult.ok) return textResult;
  const photoResult = await sendPhotoMessage(imageUrl, null);
  // The text message is what carries the fingerprint/dedup record; if the
  // follow-up photo fails, the post itself still counts as published.
  return textResult;
}

/**
 * Publishes a message to the configured Telegram channel via the
 * Bot API: the post text first, then its image (if one was resolved)
 * as a follow-up message directly below it. Respects DRY_RUN and the
 * daily budget guard. Never throws on missing config — returns a
 * structured result instead.
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
    const hasImage = Boolean(image?.url);
    const data = hasImage ? await sendTextThenPhoto(text, image.url) : await sendTextMessage(text);
    if (!data.ok) throw new Error(data.description || "Telegram API error");

    costControl.recordTelegramPost();
    store.append("telegramMessages", {
      messageId: data.result.message_id,
      text,
      hasImage,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    store.append("published", {
      platform: "telegram",
      postId: data.result.message_id,
      text,
      hasImage,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    return { published: true, messageId: data.result.message_id, hasImage };
  } catch (err) {
    store.append("errors", {
      where: "publishToTelegram",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
    return { published: false, reason: "api_error", error: err.message };
  }
}
