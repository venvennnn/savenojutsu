import { LIMITS } from "./limits";
import type { ClassifiedReel, CanonicalReel, Entitlement, JevLabels } from "./types";
import { INSUFFICIENT_TEXT_LABEL } from "./taxonomy";

export interface ClassifyProgress {
  stage: "classifying" | "building";
  completed: number;
  total: number;
  failed: number;
  insufficient: number;
  percent: number;
}

interface ClassifyResponse {
  labels: JevLabels;
  modelVersion: string;
  testMode: boolean;
  needsReview: boolean;
  error?: { code: string; message: string };
}

const sessionCache = new Map<string, ClassifyResponse>();

export function clearClassifyCache() {
  sessionCache.clear();
}

function cacheKey(caption: string, hashtags: string[]) {
  return `${caption}\n${hashtags.join(" ")}`;
}

function insufficientReel(reel: CanonicalReel): ClassifiedReel {
  return {
    ...reel,
    status: "insufficient_text",
    labels: null,
    modelVersion: null,
    testMode: false,
    errorMessage: INSUFFICIENT_TEXT_LABEL,
    textSent: null,
    needsReview: false,
  };
}

async function classifyOne(
  reel: CanonicalReel,
  entitlement: Entitlement,
  signal: AbortSignal,
  turnstileToken?: string,
): Promise<ClassifiedReel> {
  const caption = reel.caption ?? "";
  const hashtags = reel.hashtags;
  const key = cacheKey(caption, hashtags);
  const cached = sessionCache.get(key);
  if (cached) {
    return {
      ...reel,
      status: "classified",
      labels: cached.labels,
      modelVersion: cached.modelVersion,
      testMode: cached.testMode,
      errorMessage: null,
      textSent: { caption, hashtags },
      needsReview: cached.needsReview,
    };
  }

  let attempt = 0;
  let lastMessage = "Classification failed.";
  while (attempt < LIMITS.classifyMaxAttempts) {
    if (signal.aborted) {
      return {
        ...reel,
        status: "cancelled",
        labels: null,
        modelVersion: null,
        testMode: false,
        errorMessage: "Cancelled",
        textSent: { caption, hashtags },
        needsReview: false,
      };
    }
    attempt += 1;
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          caption,
          hashtags,
          entitlementToken: entitlement.token,
          turnstileToken,
        }),
        signal,
      });
      if (res.status === 429 || res.status === 502) {
        const wait = Math.min(8000, 400 * 2 ** (attempt - 1));
        await new Promise((r) => setTimeout(r, wait));
        lastMessage = "Classifier busy or unavailable.";
        continue;
      }
      const data = (await res.json()) as ClassifyResponse;
      if (!res.ok || !data.labels) {
        lastMessage = data.error?.message ?? "Classification failed.";
        break;
      }
      sessionCache.set(key, data);
      return {
        ...reel,
        status: "classified",
        labels: data.labels,
        modelVersion: data.modelVersion,
        testMode: data.testMode,
        errorMessage: null,
        textSent: { caption, hashtags },
        needsReview: data.needsReview,
      };
    } catch {
      if (signal.aborted) {
        return {
          ...reel,
          status: "cancelled",
          labels: null,
          modelVersion: null,
          testMode: false,
          errorMessage: "Cancelled",
          textSent: { caption, hashtags },
          needsReview: false,
        };
      }
      lastMessage = "Network error.";
      const wait = Math.min(8000, 400 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return {
    ...reel,
    status: "failed",
    labels: null,
    modelVersion: null,
    testMode: false,
    errorMessage: lastMessage,
    textSent: { caption, hashtags },
    needsReview: false,
  };
}

export async function classifyReels(args: {
  reels: CanonicalReel[];
  entitlement: Entitlement;
  onProgress: (p: ClassifyProgress) => void;
  signal: AbortSignal;
  turnstileToken?: string;
  onlyFailedOf?: ClassifiedReel[];
}): Promise<ClassifiedReel[]> {
  const previous = new Map((args.onlyFailedOf ?? []).map((r) => [r.id, r]));
  const results: ClassifiedReel[] = args.reels.map((reel) => {
    const prev = previous.get(reel.id);
    if (prev && prev.status !== "failed") return prev;
    if (!reel.hasUsableText) return insufficientReel(reel);
    return {
      ...reel,
      status: "pending" as const,
      labels: null,
      modelVersion: null,
      testMode: false,
      errorMessage: null,
      textSent: null,
      needsReview: false,
    };
  });

  const queue = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "pending");

  const total = args.reels.length;
  const insufficient = results.filter((r) => r.status === "insufficient_text").length;
  let completed = results.filter((r) => r.status !== "pending").length;
  let failed = results.filter((r) => r.status === "failed").length;

  const emit = (stage: ClassifyProgress["stage"] = "classifying") => {
    args.onProgress({
      stage,
      completed,
      total,
      failed,
      insufficient,
      percent: total ? Math.round((completed / total) * 100) : 100,
    });
  };
  emit();

  let cursor = 0;
  const workers = Array.from({ length: LIMITS.classifyConcurrency }, async () => {
    while (cursor < queue.length) {
      if (args.signal.aborted) break;
      const current = cursor;
      cursor += 1;
      const item = queue[current];
      const classified = await classifyOne(item.r, args.entitlement, args.signal, args.turnstileToken);
      results[item.i] = classified;
      completed += 1;
      if (classified.status === "failed") failed += 1;
      emit();
    }
  });
  await Promise.all(workers);

  if (args.signal.aborted) {
    for (let i = 0; i < results.length; i += 1) {
      if (results[i].status === "pending") {
        results[i] = { ...results[i], status: "cancelled", errorMessage: "Cancelled" };
      }
    }
  }

  emit("building");
  return results;
}
