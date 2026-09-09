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

/** For posts too long to fit as a photo caption (1024 char cap), the image is
 *  still sent — with a short caption — followed immediately by the full text
 *  as its own message, so long/important posts don't lose their image. */
async function sendPhotoThenText(imageUrl, text) {
  const shortCaption = text.length > 200 ? `${text.slice(0, 197)}...` : text;
  const photoResult = await sendPhotoMessage(imageUrl, shortCaption);
  if (!photoResult.ok) return photoResult;
  const textResult = await sendTextMessage(text);
  // Report the photo message as the primary result (it's what gets the fingerprint stored).
  return textResult.ok ? photoResult : textResult;
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
    // Short posts: image as caption. Long posts (over Telegram's 1024-char
    // caption cap): image with a short caption, then the full text as its
    // own message — the image is never silently dropped just because the
    // post is detailed.
    const canUsePhoto = Boolean(image?.url);
    const data = !canUsePhoto
      ? await sendTextMessage(text)
      : text.length <= 1024
        ? await sendPhotoMessage(image.url, text)
        : await sendPhotoThenText(image.url, text);
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
