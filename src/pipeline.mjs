import { collectAll } from "./sources/index.mjs";
import { dedupeCandidates } from "./events/dedupe.mjs";
import { scoreAll, MIN_PUBLISH_SCORE } from "./events/score.mjs";
import { verifyAll } from "./events/verify.mjs";
import { generatePost } from "./content/generate.mjs";
import { validatePost } from "./content/validate.mjs";
import { publishToX } from "./publish/x.mjs";
import { publishToTelegram } from "./publish/telegram.mjs";
import { decideCta, applyCta } from "./growth/telegramGrowthEngine.mjs";
import { store } from "./state/store.mjs";
import { costControl } from "./costControl.mjs";
import { config } from "./config.mjs";

// How many events this single run is allowed to act on. Kept low and run
// frequently via GitHub Actions, so the system stays event-driven rather
// than dumping a burst of posts every invocation.
const MAX_EVENTS_PER_RUN = 3;

async function processEvent(event) {
  const outcome = { event: { title: event.title, fingerprint: event.fingerprint }, x: null, telegram: null };

  // 1) Generate + validate + publish to X
  if (costControl.canCallAi()) {
    try {
      const xPost = await generatePost({ event, platform: "x" });
      const xValidation = validatePost({ platform: "x", text: xPost.text, event });
      if (xValidation.pass) {
        const cta = decideCta({ event, xFormat: xPost.format });
        const finalText = applyCta({ xPostText: xPost.text, xPostId: null, event, cta });
        const xResult = await publishToX({ text: finalText, event });
        outcome.x = { format: xPost.format, validation: xValidation, result: xResult };
      } else {
        outcome.x = { format: xPost.format, validation: xValidation, result: { published: false, reason: "failed_quality_gate" } };
      }
    } catch (err) {
      outcome.x = { error: err.message };
    }
  }

  // 2) Generate + validate + publish to Telegram (independent, adds depth, not a copy of X)
  if (costControl.canCallAi()) {
    try {
      const tgPost = await generatePost({ event, platform: "telegram" });
      const tgValidation = validatePost({ platform: "telegram", text: tgPost.text, event });
      if (tgValidation.pass) {
        const tgResult = await publishToTelegram({ text: tgPost.text, event });
        outcome.telegram = { format: tgPost.format, validation: tgValidation, result: tgResult };
      } else {
        outcome.telegram = { format: tgPost.format, validation: tgValidation, result: { published: false, reason: "failed_quality_gate" } };
      }
    } catch (err) {
      outcome.telegram = { error: err.message };
    }
  }

  // Mark this event's fingerprint as processed regardless of publish outcome,
  // so a failed quality gate doesn't cause endless re-attempts on the same story.
  store.addFingerprint(event.fingerprint);
  store.append("events", { ...event, processedAt: new Date().toISOString(), outcome });

  return outcome;
}

export async function runPipeline() {
  const runLog = { startedAt: new Date().toISOString(), dryRun: config.dryRun };

  const { candidates, errors: sourceErrors } = await collectAll();
  const deduped = dedupeCandidates(candidates);
  const verified = verifyAll(deduped).filter((c) => c.verified);
  const scored = scoreAll(verified).filter((c) => c.importance >= MIN_PUBLISH_SCORE);

  const toProcess = scored.slice(0, MAX_EVENTS_PER_RUN);

  const outcomes = [];
  for (const event of toProcess) {
    outcomes.push(await processEvent(event));
  }

  runLog.finishedAt = new Date().toISOString();
  runLog.candidatesCollected = candidates.length;
  runLog.afterDedupe = deduped.length;
  runLog.afterVerification = verified.length;
  runLog.aboveThreshold = scored.length;
  runLog.processed = toProcess.length;
  runLog.sourceErrors = sourceErrors;
  runLog.budget = costControl.snapshot();
  runLog.outcomes = outcomes;

  console.log(JSON.stringify(runLog, null, 2));
  return runLog;
}

// Allows `npm run collect-publish` / `npm run dry-run` to invoke this directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runPipeline().catch((err) => {
    console.error("Pipeline failed:", err);
    process.exit(1);
  });
}
