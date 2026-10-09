import { describe, expect, it } from "vitest";
import { PLANS, getPlan, isPlanId, tierCounts } from "./plans";

describe("plans", () => {
  it("documents one-time hosted prices and caps", () => {
    expect(getPlan("free")).toMatchObject({ priceUsd: 0, cap: 200, amountCents: 0 });
    expect(getPlan("standard")).toMatchObject({ priceUsd: 5, cap: 2000, amountCents: 500 });
    expect(getPlan("deep")).toMatchObject({ priceUsd: 8, cap: 4000, amountCents: 800 });
    expect(PLANS).toHaveLength(3);
  });

  it("dedupes-then-caps: included count never exceeds the plan", () => {
    expect(tierCounts(5000, getPlan("free"))).toEqual({
      included: 200,
      excluded: 4800,
      uniqueTotal: 5000,
      cap: 200,
    });
    expect(tierCounts(150, getPlan("standard")).excluded).toBe(0);
  });

  it("maps plan ids on the server rather than trusting a browser amount", () => {
    expect(isPlanId("standard")).toBe(true);
    expect(isPlanId("enterprise")).toBe(false);
    expect(getPlan("standard").amountCents).toBe(500);
    expect(getPlan("deep").amountCents).toBe(800);
    expect(getPlan("free").amountCents).toBe(0);
  });
});
