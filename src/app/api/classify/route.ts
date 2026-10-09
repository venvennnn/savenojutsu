import { clientIp, consumeEntitlementUse, incrementWindow } from "@/lib/ephemeral-store";
import {
  getJevModel,
  getNeedsReviewThreshold,
  getTypesafeApiKey,
  getTypesafeUrl,
  isTestMode,
  jevConfigured,
} from "@/lib/config.server";
import { hashKey, verifyEntitlement } from "@/lib/entitlement";
import { publicError, jsonNoStore } from "@/lib/http";
import {
  buildJevQuestions,
  buildJevState,
  clientClassifyPayloadSchema,
  validateJevResponse,
} from "@/lib/jev-schema";
import { ENTITLEMENT_TTL_MS, LIMITS, RATE_LIMITS } from "@/lib/limits";
import { clipString, redactError } from "@/lib/sanitize";
import { heuristicClassify, TEST_MODEL_ID } from "@/lib/test-classifier";

export const dynamic = "force-dynamic";

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const rl = await incrementWindow({
    scope: "classify",
    id: ip,
    limit: RATE_LIMITS.classifyPerMinute,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return publicError(429, "rate_limited", "Too many classification requests. Wait a moment and retry.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > LIMITS.maxClassifyBodyBytes) {
    return publicError(413, "payload_too_large", "Classification payload is too large.");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return publicError(400, "invalid_json", "Invalid classification request.");
  }

  let parsed;
  try {
    parsed = clientClassifyPayloadSchema(raw);
  } catch {
    return publicError(400, "invalid_request", "Classification request was missing required fields.");
  }

  const turnstileOk = await verifyTurnstile(parsed.turnstileToken, ip);
  if (!turnstileOk) {
    return publicError(403, "bot_check", "Bot check failed. Reload and try again.");
  }

  let entitlement;
  try {
    entitlement = verifyEntitlement(parsed.entitlementToken);
  } catch (err) {
    const code = err instanceof Error ? err.message : "invalid_token";
    if (code === "expired_token") {
      return publicError(401, "expired", "This analysis session expired. Start again in this tab.");
    }
    return publicError(401, "unauthorized", "This analysis is not authorized.");
  }

  const used = await consumeEntitlementUse(
    hashKey(parsed.entitlementToken),
    entitlement.maxItems,
    ENTITLEMENT_TTL_MS,
  );
  if (!used.allowed) {
    return publicError(429, "quota", "This session has used its classification quota.");
  }

  const caption = clipString(parsed.caption, LIMITS.maxCaptionSent);
  const hashtags = parsed.hashtags.slice(0, LIMITS.maxHashtagCount).map((h) => clipString(h, 80));
  const threshold = getNeedsReviewThreshold();

  const useHeuristic = !jevConfigured() && isTestMode();
  if (!jevConfigured() && !isTestMode()) {
    return publicError(
      503,
      "jev_unconfigured",
      "Jev is not configured. Set TYPESAFE_API_KEY on the server, or enable TEST_MODE for a labeled local stand-in.",
    );
  }

  if (useHeuristic) {
    const labels = heuristicClassify(caption, hashtags);
    return jsonNoStore({
      labels,
      modelVersion: TEST_MODEL_ID,
      testMode: true,
      needsReview: labels.topic.confidence < threshold,
    });
  }

  const key = getTypesafeApiKey();
  if (!key) {
    return publicError(503, "jev_unconfigured", "Jev is not configured.");
  }

  try {
    const res = await fetch(getTypesafeUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getJevModel(),
        state: buildJevState(caption, hashtags),
        questions: buildJevQuestions(),
      }),
    });

    if (res.status === 429 || res.status === 529) {
      return publicError(429, "upstream_busy", "The classifier is busy. Retry in a moment.");
    }
    if (res.status === 401) {
      return publicError(502, "upstream_auth", "Classification is temporarily unavailable.");
    }
    if (!res.ok) {
      return publicError(502, "upstream_error", "Classification failed. Retry this item.");
    }

    const payload: unknown = await res.json();
    const validated = validateJevResponse(payload);
    return jsonNoStore({
      labels: validated.labels,
      modelVersion: validated.modelVersion,
      testMode: false,
      needsReview: validated.labels.topic.confidence < threshold,
    });
  } catch (err) {
    redactError(err instanceof Error ? err.message : "");
    return publicError(502, "upstream_error", "Classification failed. Retry this item.");
  }
}
