import fetch from "node-fetch";
import fs from "node:fs";
import { config } from "../src/config.mjs";

async function call(method, params = {}) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(qs ? `${url}?${qs}` : url);
  return res.json();
}

async function main() {
  const result = {
    checkedAt: new Date().toISOString(),
    configuredChannelId: config.telegram.channelId,
    getMe: await call("getMe"),
    getChatById: await call("getChat", { chat_id: config.telegram.channelId }),
    getChatByUsername: await call("getChat", { chat_id: "@CryptoGlobalBtc" }),
  };
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/telegram-diagnostic.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main();
