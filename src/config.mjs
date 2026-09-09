// Central configuration. Every secret/setting is read here once, so the
// rest of the codebase never touches process.env directly.

function bool(v, fallback = false) {
  if (v === undefined || v === null || v === "") return fallback;
  return String(v).toLowerCase() === "true";
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  dryRun: bool(process.env.DRY_RUN, false),

  // Lets a platform be switched off cleanly (e.g. X while its account has
  // no posting credits) without touching any other part of the pipeline.
  platforms: {
    x: bool(process.env.ENABLE_X_PUBLISHING, false),
    telegram: bool(process.env.ENABLE_TELEGRAM_PUBLISHING, true),
  },

  geminiApiKey: process.env.GEMINI_API_KEY || "",

  x: {
    apiKey: process.env.X_API_KEY || "",
    apiSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    channelId: process.env.TELEGRAM_CHANNEL_ID || "",
    channelUsername: process.env.TELEGRAM_CHANNEL_USERNAME || "",
  },

  limits: {
    maxXPostsPerDay: num(process.env.MAX_X_POSTS_PER_DAY, 12),
    maxTelegramPostsPerDay: num(process.env.MAX_TELEGRAM_POSTS_PER_DAY, 15),
    maxAiCallsPerDay: num(process.env.MAX_AI_CALLS_PER_DAY, 120),
  },

  coingeckoBaseUrl: process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3",
};

/**
 * Returns which required secrets are missing for a given capability.
 * Used so the pipeline can degrade gracefully instead of crashing.
 */
export function missingSecrets(capability) {
  const missing = [];
  if (capability === "x") {
    if (!config.x.apiKey) missing.push("X_API_KEY");
    if (!config.x.apiSecret) missing.push("X_API_SECRET");
    if (!config.x.accessToken) missing.push("X_ACCESS_TOKEN");
    if (!config.x.accessTokenSecret) missing.push("X_ACCESS_TOKEN_SECRET");
  }
  if (capability === "telegram") {
    if (!config.telegram.botToken) missing.push("TELEGRAM_BOT_TOKEN");
    if (!config.telegram.channelId) missing.push("TELEGRAM_CHANNEL_ID");
  }
  if (capability === "ai") {
    if (!config.geminiApiKey) missing.push("GEMINI_API_KEY");
  }
  return missing;
}
