import { TwitterApi } from "twitter-api-v2";
import { config, missingSecrets } from "../config.mjs";
import { costControl } from "../costControl.mjs";
import { store } from "../state/store.mjs";

let client = null;
function getClient() {
  if (!client) {
    client = new TwitterApi({
      appKey: config.x.apiKey,
      appSecret: config.x.apiSecret,
      accessToken: config.x.accessToken,
      accessSecret: config.x.accessTokenSecret,
    });
  }
  return client.readWrite;
}

/**
 * Publishes a post to X. Respects DRY_RUN and the daily budget guard.
 * Never throws on a missing-secret situation — returns a structured
 * result so the pipeline can log and continue instead of crashing.
 */
export async function publishToX({ text, event }) {
  const missing = missingSecrets("x");
  if (missing.length > 0) {
    return { published: false, reason: "missing_secrets", missing };
  }
  if (!costControl.canPublishToX()) {
    return { published: false, reason: "daily_budget_reached" };
  }
  if (config.dryRun) {
    return { published: false, reason: "dry_run", wouldPublish: text };
  }

  try {
    const twitter = getClient();
    const result = await twitter.v2.tweet(text);
    costControl.recordXPost();
    store.append("published", {
      platform: "x",
      postId: result.data.id,
      text,
      eventFingerprint: event?.fingerprint || null,
      timestamp: new Date().toISOString(),
    });
    return { published: true, postId: result.data.id };
  } catch (err) {
    store.append("errors", {
      where: "publishToX",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
    return { published: false, reason: "api_error", error: err.message };
  }
}
