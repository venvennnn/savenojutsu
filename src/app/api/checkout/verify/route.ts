import { isTestMode, stripeConfigured } from "@/lib/config.server";
import { issueEntitlement } from "@/lib/entitlement";
import { clientIp, incrementWindow } from "@/lib/ephemeral-store";
import { jsonNoStore, publicError } from "@/lib/http";
import { RATE_LIMITS } from "@/lib/limits";
import { getPlan } from "@/lib/plans";
import { retrievePaidSession } from "@/lib/stripe-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const rl = await incrementWindow({
    scope: "verify",
    id: ip,
    limit: RATE_LIMITS.verifyPerMinute,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return publicError(429, "rate_limited", "Too many verification attempts.");
  }

  let body: { sessionId?: unknown };
  try {
    body = (await request.json()) as { sessionId?: unknown };
  } catch {
    return publicError(400, "invalid_json", "Invalid verification request.");
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId || sessionId.length > 200) {
    return publicError(400, "invalid_session", "Missing checkout session.");
  }

  if (!stripeConfigured()) {
    return publicError(
      503,
      "stripe_unconfigured",
      isTestMode()
        ? "Stripe is not configured. Use the labeled test-mode checkout in this app instead of a session id."
        : "Stripe is not configured.",
    );
  }

  try {
    const result = await retrievePaidSession(sessionId);
    if (!result.paid) {
      return jsonNoStore({ paid: false, status: result.session.payment_status });
    }
    const plan = getPlan(result.planId);
    const token = issueEntitlement({
      planId: result.planId,
      sessionId,
      testMode: false,
    });
    return jsonNoStore({
      paid: true,
      entitlement: {
        token,
        planId: plan.id,
        maxItems: plan.cap,
        testMode: false,
      },
    });
  } catch {
    return publicError(400, "verify_failed", "This payment could not be verified.");
  }
}
