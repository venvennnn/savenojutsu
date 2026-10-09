import {
  APPARENT_USES,
  CAPTION_CTAS,
  CAPTION_HOOKS,
  CONTENT_TYPES,
  TOPICS,
} from "./taxonomy";
import type { ApparentUseId, CaptionCtaId, CaptionHookId, ContentTypeId, JevLabels, TopicId } from "./types";

/**
 * Deterministic local stand-in used only when TEST_MODE is on and no TypeSafe
 * key is configured. Results are labeled TEST MODE in the UI and report.
 */
const TOPIC_HINTS: Array<[RegExp, TopicId]> = [
  [/\b(startup|founder|entrepreneur|business|marketing funnel)\b/i, "business_entrepreneurship"],
  [/\b(ai|chatgpt|software|coding|programmer|llm)\b/i, "technology_ai"],
  [/\b(resume|interview|career|job|workplace)\b/i, "career_work"],
  [/\b(invest|stock|budget|tax|crypto|finance)\b/i, "finance"],
  [/\b(learn|study|course|tutorial|lesson)\b/i, "education_learning"],
  [/\b(anime|manga|naruto|netflix|movie|fandom)\b/i, "anime_entertainment"],
  [/\b(workout|gym|fitness|health|yoga)\b/i, "health_fitness"],
  [/\b(recipe|cooking|chef|restaurant|food)\b/i, "food_cooking"],
  [/\b(travel|itinerary|flight|hotel|tokyo|paris)\b/i, "travel"],
  [/\b(interior|home decor|apartment|outfit)\b/i, "home_lifestyle"],
  [/\b(photograph|design|illustration|art)\b/i, "art_design_photography"],
  [/\b(news|election|politics|headline)\b/i, "news_culture"],
];

function uniform<T extends string>(ids: T[], winner: T, confidence: number) {
  const rest = (1 - confidence) / Math.max(1, ids.length - 1);
  const probabilities: Record<string, number> = {};
  for (const id of ids) probabilities[id] = id === winner ? confidence : rest;
  return { label: winner, confidence, probabilities };
}

export function heuristicClassify(caption: string, hashtags: string[]): JevLabels {
  const text = `${caption} ${hashtags.join(" ")}`;
  let topic: TopicId = "other";
  for (const [re, id] of TOPIC_HINTS) {
    if (re.test(text)) {
      topic = id;
      break;
    }
  }
  if (text.trim().length < 8) topic = "unknown";

  const contentType: ContentTypeId = /\b(how to|step \d|tutorial)\b/i.test(text)
    ? "tutorial"
    : /\b(recommend|try this)\b/i.test(text)
      ? "recommendation"
      : /\b(news|just in)\b/i.test(text)
        ? "news"
        : "unknown";

  const apparentUse: ApparentUseId = contentType === "tutorial" ? "learning" : "unknown";
  const promotionalProb = /\b(sponsor|affiliate|use code|shop now|link in bio)\b/i.test(text)
    ? 0.82
    : 0.08;
  const captionHook: CaptionHookId = text.trim().endsWith("?")
    ? "question"
    : /^(stop|don't|never)\b/i.test(text.trim())
      ? "contrarian_claim"
      : "none";
  const captionCta: CaptionCtaId = /\bfollow\b/i.test(text)
    ? "follow"
    : /\bsave this\b/i.test(text)
      ? "save"
      : /\bcomment\b/i.test(text)
        ? "comment"
        : /\blink in bio\b/i.test(text)
          ? "link"
          : "none";

  return {
    topic: uniform(TOPICS.map((t) => t.id), topic, 0.62),
    contentType: uniform(CONTENT_TYPES.map((t) => t.id), contentType, 0.55),
    apparentUse: uniform(APPARENT_USES.map((t) => t.id), apparentUse, 0.5),
    promotional: {
      probability: promotionalProb,
      label: promotionalProb >= 0.5 ? "yes" : "no",
    },
    captionHook: uniform(CAPTION_HOOKS.map((t) => t.id), captionHook, 0.58),
    captionCta: uniform(CAPTION_CTAS.map((t) => t.id), captionCta, 0.6),
  };
}

export const TEST_MODEL_ID = "test-mode-heuristic";
