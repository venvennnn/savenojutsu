import { createHmac, timingSafeEqual } from "node:crypto";
import { ENTITLEMENT_TTL_MS } from "./limits";
import { getPlan, isPlanId } from "./plans";
import type { PlanId } from "./types";
import { getSigningSecret } from "./config.server";

export interface EntitlementPayload {
  planId: PlanId;
  maxItems: number;
  exp: number;
  iat: number;
  sid: string;
  test: boolean;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function issueEntitlement(args: {
  planId: PlanId;
  sessionId: string;
  testMode?: boolean;
}): string {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("entitlement_unconfigured");
  }
  const plan = getPlan(args.planId);
  const now = Date.now();
  const payload: EntitlementPayload = {
    planId: plan.id,
    maxItems: plan.cap,
    iat: now,
    exp: now + ENTITLEMENT_TTL_MS,
    sid: args.sessionId,
    test: Boolean(args.testMode),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyEntitlement(token: string): EntitlementPayload {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("entitlement_unconfigured");
  }
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("invalid_token");
  const [body, sig] = parts;
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("invalid_token");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EntitlementPayload;
  if (!isPlanId(parsed.planId)) throw new Error("invalid_token");
  if (typeof parsed.maxItems !== "number") throw new Error("invalid_token");
  if (Date.now() > parsed.exp) throw new Error("expired_token");
  return parsed;
}

export function hashKey(value: string): string {
  return createHmac("sha256", getSigningSecret() ?? "snj").update(value).digest("hex").slice(0, 32);
}
