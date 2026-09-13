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

// Telegram's hard cap on a photo caption. The image must always be part
// of the same message as the text — never a separate, standalone image
// message — so if a post ever runs long, the caption is trimmed to fit
// rather than split into two messages.
const TELEGRAM_CAPTION_LIMIT = 1024;

function fitCaption(text) {
  if (text.length <= TELEGRAM_CAPTION_LIMIT) return text;
  return `${text.slice(0, TELEGRAM_CAPTION_LIMIT - 1)}…`;
}

/**
 * Publishes a message to the configured Telegram channel via the
 * Bot API, as a single unified message: the image (when one was
 * resolved) with the post text as its caption in the same message —
 * never as two separate messages. Respects DRY_RUN and the daily
 * budget guard. Never throws on missing config — returns a structured
 * result instead.
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
    const data = hasImage ? await sendPhotoMessage(image.url, fitCaption(text)) : await sendTextMessage(text);
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
