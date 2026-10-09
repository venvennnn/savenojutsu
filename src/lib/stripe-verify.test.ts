import { describe, expect, it } from "vitest";
import { paidPlanAmountCents } from "./stripe-server";

describe("server-side Stripe amounts", () => {
  it("never reads a price from the browser", () => {
    expect(paidPlanAmountCents("standard")).toBe(500);
    expect(paidPlanAmountCents("deep")).toBe(800);
  });
});
