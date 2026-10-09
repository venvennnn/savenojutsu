import { getAppMode, isTestMode, stripeConfigured } from "@/lib/config.server";
import { issueEntitlement } from "@/lib/entitlement";
import { clientIp, incrementWindow } from "@/lib/ephemeral-store";
import { jsonNoStore, publicError } from "@/lib/http";
import { RATE_LIMITS } from "@/lib/limits";
import { getPlan, isPlanId } from "@/lib/plans";
import { createCheckoutSession } from "@/lib/stripe-server";
import type { PlanId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const rl = await incrementWindow({
    scope: "checkout",
    id: ip,
    limit: RATE_LIMITS.checkoutPerMinute,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return publicError(429, "rate_limited", "Too many checkout attempts. Wait and try again.");
  }

  let body: { planId?: unknown; uniqueReelCount?: unknown };
  try {
    body = (await request.json()) as { planId?: unknown; uniqueReelCount?: unknown };
  } catch {
    return publicError(400, "invalid_json", "Invalid checkout request.");
  }

  if (!isPlanId(body.planId)) {
    return publicError(400, "invalid_plan", "Choose a valid plan.");
  }
  const planId = body.planId as PlanId;
  const uniqueReelCount = Number(body.uniqueReelCount ?? 0);
  const plan = getPlan(planId);

  if (getAppMode() === "byok" || planId === "free") {
    if (planId === "free" && getAppMode() === "hosted") {
      const grant = await incrementWindow({
        scope: "free",
        id: ip,
        limit: RATE_LIMITS.freeGrantPerHour,
        windowMs: 60 * 60 * 1000,
      });
      if (!grant.allowed) {
        return publicError(
          429,
          "free_limit",
          "This network has reached the free-analysis limit for now. Try later or choose a paid tier.",
        );
      }
    }
    const token = issueEntitlement({
      planId,
      sessionId: `local_${planId}_${Date.now()}`,
      testMode: isTestMode(),
    });
    return jsonNoStore({
      kind: "entitlement",
      entitlement: {
        token,
        planId,
        maxItems: plan.cap,
        testMode: isTestMode(),
      },
      analyzedCount: Math.min(uniqueReelCount, plan.cap),
      amountCents: 0,
    });
  }

  if (!stripeConfigured()) {
    if (!isTestMode()) {
      return publicError(
        503,
        "stripe_unconfigured",
        "Stripe is not configured. Set STRIPE_SECRET_KEY, or enable TEST_MODE for a labeled simulated checkout.",
      );
    }
    const token = issueEntitlement({
      planId,
      sessionId: `test_${planId}_${Date.now()}`,
      testMode: true,
    });
    return jsonNoStore({
      kind: "test_checkout",
      entitlement: { token, planId, maxItems: plan.cap, testMode: true },
      analyzedCount: Math.min(uniqueReelCount, plan.cap),
      amountCents: plan.amountCents,
      testMode: true,
    });
  }

  try {
    const session = await createCheckoutSession({
      planId,
      uniqueReelCount,
    });
    if (!session.url || !session.id) {
      return publicError(502, "checkout_failed", "Checkout could not be started.");
    }
    return jsonNoStore({
      kind: "stripe",
      sessionId: session.id,
      url: session.url,
      analyzedCount: Math.min(uniqueReelCount, plan.cap),
      amountCents: plan.amountCents,
    });
  } catch {
    return publicError(502, "checkout_failed", "Checkout could not be started.");
  }
}
