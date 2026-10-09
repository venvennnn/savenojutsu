import { DEFAULT_JEV_MODEL, TYPESAFE_API_URL } from "./jev-schema";
import { PLANS } from "./plans";
import type { AppMode, PublicConfig } from "./types";

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getAppMode(): AppMode {
  return process.env.APP_MODE === "hosted" ? "hosted" : "byok";
}

export function isTestMode(): boolean {
  return envFlag("TEST_MODE");
}

export function jevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function getJevModel(): string {
  return process.env.JEV_MODEL?.trim() || DEFAULT_JEV_MODEL;
}

export function getTypesafeUrl(): string {
  return process.env.TYPESAFE_API_URL?.trim() || TYPESAFE_API_URL;
}

export function getNeedsReviewThreshold(): number {
  const n = Number(process.env.NEEDS_REVIEW_THRESHOLD ?? 0.45);
  if (!Number.isFinite(n)) return 0.45;
  return Math.min(0.95, Math.max(0.05, n));
}

export function getPublicAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getPublicConfig(): PublicConfig {
  const mode = getAppMode();
  return {
    mode,
    testMode: isTestMode(),
    stripeConfigured: mode === "hosted" && stripeConfigured(),
    jevConfigured: jevConfigured(),
    jevModel: getJevModel(),
    needsReviewThreshold: getNeedsReviewThreshold(),
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
    plans: PLANS,
    kvConfigured: kvConfigured(),
  };
}

export function getTypesafeApiKey(): string | null {
  return process.env.TYPESAFE_API_KEY?.trim() || null;
}

export function getSigningSecret(): string | null {
  const explicit = process.env.ENTITLEMENT_SECRET?.trim();
  if (explicit) return explicit;
  const stripe = process.env.STRIPE_SECRET_KEY?.trim();
  if (stripe) return stripe;
  const jev = process.env.TYPESAFE_API_KEY?.trim();
  if (jev) return `entitlement:${jev}`;
  if (isTestMode()) return "test-mode-entitlement-secret";
  return null;
}

export const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
} as const;
