import {
  APPARENT_USE_IDS,
  APPARENT_USES,
  CAPTION_CTA_IDS,
  CAPTION_CTAS,
  CAPTION_HOOK_IDS,
  CAPTION_HOOKS,
  CONTENT_TYPE_IDS,
  CONTENT_TYPES,
  EVIDENCE_PREAMBLE,
  PROMOTIONAL_CRITERIA,
  TOPIC_IDS,
  TOPICS,
  optionsToCriteria,
} from "./taxonomy";
import type {
  ApparentUseId,
  CaptionCtaId,
  CaptionHookId,
  ContentTypeId,
  JevLabels,
  TopicId,
} from "./types";

export const DEFAULT_JEV_MODEL = "jev-1.13.0";
export const TYPESAFE_API_URL = "https://api.typesafe.ai/v1/systemone";

export function buildJevQuestions() {
  return {
    topic: {
      type: "choice" as const,
      instructions: `${EVIDENCE_PREAMBLE} Choose the single main topic of this Reel based only on the caption and hashtags.`,
      criteria: optionsToCriteria(TOPICS),
    },
    content_type: {
      type: "choice" as const,
      instructions: `${EVIDENCE_PREAMBLE} Choose the written content type. Do not infer spoken format, visuals, or video structure.`,
      criteria: optionsToCriteria(CONTENT_TYPES),
    },
    apparent_use: {
      type: "choice" as const,
      instructions: `${EVIDENCE_PREAMBLE} If the caption itself suggests how the post might be used, pick one. Never guess why the user saved it.`,
      criteria: optionsToCriteria(APPARENT_USES),
    },
    promotional: {
      type: "noul" as const,
      instructions: `${EVIDENCE_PREAMBLE} Is there explicit promotional, sponsored, affiliate, or selling language in the caption or hashtags?`,
      criteria: PROMOTIONAL_CRITERIA,
    },
    caption_hook: {
      type: "choice" as const,
      instructions: `${EVIDENCE_PREAMBLE} Classify the written caption hook only. Do not label spoken hooks or visual hooks.`,
      criteria: optionsToCriteria(CAPTION_HOOKS),
    },
    caption_cta: {
      type: "choice" as const,
      instructions: `${EVIDENCE_PREAMBLE} Classify an explicit written call to action in the caption only. If none is written, choose none.`,
      criteria: optionsToCriteria(CAPTION_CTAS),
    },
  };
}

export function buildJevState(caption: string, hashtags: string[]) {
  return {
    caption,
    hashtags: hashtags.join(" "),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickChoice<T extends string>(
  answers: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): { label: T; confidence: number; probabilities: Record<string, number> } {
  const node = asRecord(answers[key]);
  if (!node || node.type !== "choice") {
    throw new Error("invalid_jev_answer");
  }
  const choice = String(node.choice ?? "");
  if (!allowed.includes(choice as T)) {
    throw new Error("invalid_jev_label");
  }
  const probabilities: Record<string, number> = {};
  const raw = asRecord(node.probabilities) ?? {};
  for (const id of allowed) {
    const n = Number(raw[id] ?? 0);
    probabilities[id] = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  }
  const confidenceRaw = Number(node.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : probabilities[choice] ?? 0;
  return { label: choice as T, confidence, probabilities };
}

function pickNoul(answers: Record<string, unknown>, key: string) {
  const node = asRecord(answers[key]);
  if (!node || node.type !== "noul") {
    throw new Error("invalid_jev_answer");
  }
  const n = Number(node.noul);
  if (!Number.isFinite(n)) {
    throw new Error("invalid_jev_noul");
  }
  const probability = Math.min(1, Math.max(0, n));
  return {
    probability,
    label: probability >= 0.5 ? ("yes" as const) : ("no" as const),
  };
}

export function validateJevResponse(payload: unknown): {
  modelVersion: string;
  labels: JevLabels;
} {
  const body = asRecord(payload);
  if (!body) throw new Error("invalid_jev_response");
  const answers = asRecord(body.answers);
  if (!answers) throw new Error("invalid_jev_answers");
  const modelVersion = String(body.model ?? DEFAULT_JEV_MODEL);

  return {
    modelVersion,
    labels: {
      topic: pickChoice<TopicId>(answers, "topic", TOPIC_IDS),
      contentType: pickChoice<ContentTypeId>(answers, "content_type", CONTENT_TYPE_IDS),
      apparentUse: pickChoice<ApparentUseId>(answers, "apparent_use", APPARENT_USE_IDS),
      promotional: pickNoul(answers, "promotional"),
      captionHook: pickChoice<CaptionHookId>(answers, "caption_hook", CAPTION_HOOK_IDS),
      captionCta: pickChoice<CaptionCtaId>(answers, "caption_cta", CAPTION_CTA_IDS),
    },
  };
}

export function clientClassifyPayloadSchema(body: unknown): {
  caption: string;
  hashtags: string[];
  entitlementToken: string;
  turnstileToken?: string;
} {
  const rec = asRecord(body);
  if (!rec) throw new Error("invalid_body");
  if (typeof rec.caption !== "string") throw new Error("invalid_caption");
  if (!Array.isArray(rec.hashtags)) throw new Error("invalid_hashtags");
  if (typeof rec.entitlementToken !== "string" || !rec.entitlementToken) {
    throw new Error("missing_entitlement");
  }
  const hashtags = rec.hashtags
    .filter((h): h is string => typeof h === "string")
    .slice(0, 80);
  const turnstileToken =
    typeof rec.turnstileToken === "string" ? rec.turnstileToken : undefined;
  return {
    caption: rec.caption,
    hashtags,
    entitlementToken: rec.entitlementToken,
    turnstileToken,
  };
}
