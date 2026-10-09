import { afterEach, describe, expect, it, vi } from "vitest";
import { issueEntitlement, verifyEntitlement } from "./entitlement";

describe("entitlement tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a signed token that verifies plan and expiry", () => {
    vi.stubEnv("TEST_MODE", "true");
    vi.stubEnv("ENTITLEMENT_SECRET", "unit-test-secret");
    const token = issueEntitlement({ planId: "standard", sessionId: "cs_test_1" });
    const payload = verifyEntitlement(token);
    expect(payload.planId).toBe("standard");
    expect(payload.maxItems).toBe(2000);
    expect(payload.sid).toBe("cs_test_1");
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it("rejects tampered tokens", () => {
    vi.stubEnv("TEST_MODE", "true");
    vi.stubEnv("ENTITLEMENT_SECRET", "unit-test-secret");
    const token = issueEntitlement({ planId: "deep", sessionId: "cs_test_2" });
    expect(() => verifyEntitlement(token.replace(/.$/, "x"))).toThrow(/invalid_token/);
  });
});
