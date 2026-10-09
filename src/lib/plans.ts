import type { PlanDefinition, PlanId } from "./types";

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    amountCents: 0,
    cap: 200,
    blurb: "Analyze the latest 200 unique saved Reels.",
  },
  {
    id: "standard",
    name: "Standard",
    priceUsd: 5,
    amountCents: 500,
    cap: 2000,
    blurb: "Analyze the latest 2,000 unique saved Reels.",
  },
  {
    id: "deep",
    name: "Deep analysis",
    priceUsd: 8,
    amountCents: 800,
    cap: 4000,
    blurb: "Analyze the latest 4,000 unique saved Reels.",
  },
];

export function getPlan(id: PlanId): PlanDefinition {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) {
    throw new Error("Unknown plan");
  }
  return plan;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "standard" || value === "deep";
}

export function tierCounts(uniqueTotal: number, plan: PlanDefinition) {
  const included = Math.min(uniqueTotal, plan.cap);
  const excluded = Math.max(0, uniqueTotal - plan.cap);
  return { included, excluded, uniqueTotal, cap: plan.cap };
}
