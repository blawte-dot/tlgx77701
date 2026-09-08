import { store } from "./state/store.mjs";
import { config } from "./config.mjs";

/**
 * Simple daily budget guard. Never assume an external API is free or
 * unlimited — this tracks usage against configured caps and blocks
 * further calls of that kind once the daily cap is hit.
 */
export const costControl = {
  canPublishToX() {
    const b = store.getBudget();
    return b.xPosts < config.limits.maxXPostsPerDay;
  },
  canPublishToTelegram() {
    const b = store.getBudget();
    return b.telegramPosts < config.limits.maxTelegramPostsPerDay;
  },
  canCallAi() {
    const b = store.getBudget();
    return b.aiCalls < config.limits.maxAiCallsPerDay;
  },
  recordXPost() {
    const b = store.getBudget();
    b.xPosts += 1;
    store.saveBudget(b);
  },
  recordTelegramPost() {
    const b = store.getBudget();
    b.telegramPosts += 1;
    store.saveBudget(b);
  },
  recordAiCall() {
    const b = store.getBudget();
    b.aiCalls += 1;
    store.saveBudget(b);
  },
  snapshot() {
    return store.getBudget();
  },
};
