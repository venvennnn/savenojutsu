/**
 * Temporary non-content metadata only: rate-limit counters and entitlement
 * usage. Never stores JSON, captions, labels, reports, or accounts.
 *
 * Prefers Vercel KV when KV_REST_API_URL + KV_REST_API_TOKEN are set.
 * Otherwise uses process memory and fails safe (rate limits reset on restart;
 * usage counters may under-count rather than block analysis forever).
 */
import { kvConfigured } from "./config.server";
import { hashKey } from "./entitlement";

type CounterRecord = { count: number; resetAt: number };

const memory = new Map<string, { value: string; exp: number }>();

function memGet(key: string): string | null {
  const row = memory.get(key);
  if (!row) return null;
  if (Date.now() > row.exp) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

function memSet(key: string, value: string, ttlMs: number) {
  memory.set(key, { value, exp: Date.now() + ttlMs });
}

async function kvGet(key: string): Promise<string | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return memGet(key);
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return memGet(key);
    const data = (await res.json()) as { result?: string | null };
    return data.result ?? null;
  } catch {
    return memGet(key);
  }
}

async function kvSet(key: string, value: string, ttlMs: number) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  memSet(key, value, ttlMs);
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSec}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    // Fail safe: in-memory still holds the value for this instance.
  }
}

export function ephemeralBackend(): "kv" | "memory" {
  return kvConfigured() ? "kv" : "memory";
}

export async function incrementWindow(args: {
  scope: string;
  id: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${args.scope}:${hashKey(args.id)}`;
  const raw = await kvGet(key);
  const now = Date.now();
  let rec: CounterRecord = raw ? (JSON.parse(raw) as CounterRecord) : { count: 0, resetAt: now + args.windowMs };
  if (now > rec.resetAt) {
    rec = { count: 0, resetAt: now + args.windowMs };
  }
  rec.count += 1;
  await kvSet(key, JSON.stringify(rec), args.windowMs);
  return { allowed: rec.count <= args.limit, remaining: Math.max(0, args.limit - rec.count) };
}

export async function consumeEntitlementUse(tokenHash: string, maxItems: number, ttlMs: number) {
  const key = `ent:${tokenHash}`;
  const raw = await kvGet(key);
  const used = raw ? Number(raw) : 0;
  const next = used + 1;
  if (next > Math.ceil(maxItems * 1.25) + 8) {
    return { allowed: false, used };
  }
  await kvSet(key, String(next), ttlMs);
  return { allowed: true, used: next };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}
