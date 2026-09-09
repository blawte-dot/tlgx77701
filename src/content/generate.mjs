import { generateText } from "../ai/provider.mjs";
import {
  chooseXFormat,
  chooseTelegramFormat,
  chooseHookStyle,
  chooseEmojiPolicy,
  chooseHashtagPolicy,
} from "./formats.mjs";

const SYSTEM_PROMPT = `You are the editorial voice of "Crypto & Markets," an independent English-language
crypto and macro markets news account on X and Telegram. Your writing is factual, precise, and
grounded — never hype, never financial advice, never guaranteed-profit language. You vary sentence
structure and openings so posts never sound templated or bot-like. You never fabricate facts,
numbers, or quotes. If a claim is unverified, say so explicitly (e.g. "unconfirmed reports suggest").
You never use the literal word "Breaking:" as a crutch opener unless the hook style specifically calls
for a direct-fact urgent opening.`;

function buildPrompt({ event, platform, format, hookStyle, emojiPolicy, hashtagPolicy }) {
  const rumorNote = event.verification?.isRumor
    ? "This is an UNVERIFIED claim — phrase it explicitly as unconfirmed, do not state it as fact."
    : "";

  const trendingNote =
    (event.corroboratingSources || 1) >= 2
      ? `This story is being independently reported by ${event.corroboratingSources} different outlets right now — it is genuinely trending. Write with real urgency and relevance; make clear why this matters right now, not just what happened.`
      : "";

  const constraints =
    platform === "x"
      ? "X post. Hard limit 280 characters total. No links unless the source link is essential."
      : "Telegram message. Can be longer and more detailed than an X post (up to ~600 words for deep_dive, shorter for alerts). Must add depth beyond a headline, not just repeat it.";

  return `Write one ${format} post for ${platform === "x" ? "X (Twitter)" : "Telegram"}.

Event:
Title: ${event.title}
Summary: ${event.summary || "(no summary available)"}
Source: ${event.source}
Kind: ${event.kind}
${rumorNote}
${trendingNote}

Style instructions:
- The opening line is the single most important line in the post — it must be a genuinely strong,
  scroll-stopping hook that earns the read, not a generic restatement of the headline. Use this hook
  style as direction: ${hookStyle}
- Emoji usage: ${emojiPolicy} (none = zero emojis, single = at most one, light = at most two)
- Hashtags: ${hashtagPolicy} (none = zero hashtags, one = at most one, only if it adds real value)
- ${constraints}
- Do not use generic disclaimers like "not financial advice" unless directly relevant.
- Output ONLY the post text, nothing else — no preamble, no quotation marks around it.`;
}

/**
 * Generates one platform-specific post for a scored/verified event.
 * Returns { platform, format, text, hookStyle } or throws if generation fails.
 */
export async function generatePost({ event, platform }) {
  const format = platform === "x" ? chooseXFormat(event) : chooseTelegramFormat(event);
  const hookStyle = chooseHookStyle();
  const emojiPolicy = chooseEmojiPolicy();
  const hashtagPolicy = chooseHashtagPolicy();

  const prompt = buildPrompt({ event, platform, format, hookStyle, emojiPolicy, hashtagPolicy });

  const text = await generateText({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: platform === "x" ? 300 : 900,
  });

  return { platform, format, hookStyle, text: text.trim() };
}
