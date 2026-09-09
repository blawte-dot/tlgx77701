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

You NEVER write meta-commentary about yourself, the task, or the request — no "I cannot...", no
"please provide more context", no "as an AI", no asking the reader for clarification, no talking
about "rewriting" or "the text you'd like me to...". You are not a chatbot replying to a person —
you are publishing a finished post directly to an audience. Every output must read as a complete,
self-contained post a human editor would actually publish, with nothing else around it.

Structure every post so a reader can scan it in one glance: a short, strong opening line (the hook)
that stands on its own, then the body in short sentences or short paragraphs — never one dense wall
of text. Favor brevity: say only what's needed, then stop.`;

function formatGuidance(format) {
  if (format === "meme_take") {
    return "This is a witty, punchy, meme-style take — short, culturally sharp, maybe a little irreverent. It must still be grounded in the real event/numbers above (never a generic joke unrelated to this specific event). No forced slang, no cringe attempts at humor — clever beats try-hard.";
  }
  if (format === "engagement_question") {
    return "Open a direct, specific question to the audience about THIS real event/price move — inviting them to share their own read or reaction. The question must be answerable from genuine opinion, not a trivia quiz. Ground it explicitly in the real numbers/facts above, not a vague generic market question.";
  }
  return "";
}

function buildPrompt({ event, platform, format, hookStyle, emojiPolicy, hashtagPolicy }) {
  const rumorNote = event.verification?.isRumor
    ? "This is an UNVERIFIED claim — phrase it explicitly as unconfirmed, do not state it as fact."
    : "";

  const trendingNote =
    (event.corroboratingSources || 1) >= 2
      ? `This story is being independently reported by ${event.corroboratingSources} different outlets right now — it is genuinely trending. Write with real urgency and relevance; make clear why this matters right now, not just what happened.`
      : "";

  const formatNote = formatGuidance(format);

  const constraints =
    platform === "x"
      ? "X post. Hard limit 280 characters total. No links unless the source link is essential."
      : "Telegram message. Keep it as short as the content allows — only deep_dive should run long (up to ~600 words); every other format should be brief and scannable, a few short lines, not a wall of text.";

  return `Write one ${format} post for ${platform === "x" ? "X (Twitter)" : "Telegram"}.

Event:
Title: ${event.title}
Summary: ${event.summary || "(no summary available)"}
Source: ${event.source}
Kind: ${event.kind}
${rumorNote}
${trendingNote}
${formatNote}

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

const SHORT_TELEGRAM_FORMATS = new Set(["meme_take", "engagement_question", "market_alert"]);

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

  const maxTokens =
    platform === "x" ? 300 : format === "deep_dive" ? 900 : SHORT_TELEGRAM_FORMATS.has(format) ? 220 : 450;

  const text = await generateText({ system: SYSTEM_PROMPT, prompt, maxTokens });

  return { platform, format, hookStyle, text: text.trim() };
}
