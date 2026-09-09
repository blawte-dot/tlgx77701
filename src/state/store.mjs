import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");

const FILES = {
  events: "events.json",
  fingerprints: "fingerprints.json",
  published: "published.json",
  telegramMessages: "telegram-messages.json",
  performance: "performance.json",
  ctaCampaigns: "cta-campaigns.json",
  errors: "errors.json",
  budget: "budget.json",
  "model-cache": "model-cache.json",
};

function filePath(name) {
  return path.join(DATA_DIR, FILES[name]);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(name, fallback) {
  ensureDataDir();
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function save(name, data) {
  ensureDataDir();
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

export const store = {
  // --- generic list-based collections ---
  getAll(name, fallback = []) {
    return load(name, fallback);
  },
  append(name, item, { cap = 5000 } = {}) {
    const list = load(name, []);
    list.push(item);
    // Keep the file bounded — oldest entries are trimmed, not archived,
    // matching "simple reliable state layer, do not over-engineer".
    const trimmed = list.length > cap ? list.slice(list.length - cap) : list;
    save(name, trimmed);
    return trimmed;
  },
  set(name, data) {
    save(name, data);
  },

  // --- fingerprint dedup helpers ---
  hasFingerprint(fp) {
    const list = load("fingerprints", []);
    return list.includes(fp);
  },
  addFingerprint(fp) {
    const list = load("fingerprints", []);
    if (!list.includes(fp)) {
      list.push(fp);
      const trimmed = list.length > 10000 ? list.slice(list.length - 10000) : list;
      save("fingerprints", trimmed);
    }
  },

  // --- daily budget counters (reset per UTC day) ---
  getBudget() {
    const today = new Date().toISOString().slice(0, 10);
    const budget = load("budget", {});
    if (budget.date !== today) {
      return { date: today, xPosts: 0, telegramPosts: 0, aiCalls: 0 };
    }
    return budget;
  },
  saveBudget(budget) {
    save("budget", budget);
  },
};
