import Stripe from "stripe";
import { getPlan } from "./plans";
import { getPublicAppUrl, stripeConfigured } from "./config.server";
import type { PlanId } from "./types";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("stripe_unconfigured");
  }
  return new Stripe(key);
}

export function paidPlanAmountCents(planId: PlanId): number {
  return getPlan(planId).amountCents;
}

export async function createCheckoutSession(args: {
  planId: Exclude<PlanId, "free">;
  uniqueReelCount: number;
}) {
  if (!stripeConfigured()) {
    throw new Error("stripe_unconfigured");
  }
  const plan = getPlan(args.planId);
  const stripe = getStripe();
  const appUrl = getPublicAppUrl();
  const priceId =
    args.planId === "standard"
      ? process.env.STRIPE_PRICE_STANDARD?.trim()
      : process.env.STRIPE_PRICE_DEEP?.trim();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.amountCents,
            product_data: {
              name: `Save no Jutsu · ${plan.name}`,
              description: `One-time analysis of the latest ${plan.cap} unique saved Reels.`,
            },
          },
        },
      ];

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems,
      success_url: `${appUrl}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/complete?canceled=1`,
      metadata: {
        planId: plan.id,
        cap: String(plan.cap),
        uniqueReelCount: String(args.uniqueReelCount),
        product: "save-no-jutsu",
      },
    },
    { idempotencyKey: `snj_${plan.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` },
  );

  return session;
}

export async function retrievePaidSession(sessionId: string): Promise<
  | { paid: false; session: Stripe.Checkout.Session }
  | { paid: true; session: Stripe.Checkout.Session; planId: "standard" | "deep" }
> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return { paid: false, session };
  }
  const rawPlan = session.metadata?.planId;
  if (rawPlan !== "standard" && rawPlan !== "deep") {
    throw new Error("invalid_session_plan");
  }
  const planId: "standard" | "deep" = rawPlan;
  const expected = paidPlanAmountCents(planId);
  if (!process.env.STRIPE_PRICE_STANDARD && !process.env.STRIPE_PRICE_DEEP) {
    if (typeof session.amount_total === "number" && session.amount_total !== expected) {
      throw new Error("amount_mismatch");
    }
  }
  return { paid: true, session, planId };
}
