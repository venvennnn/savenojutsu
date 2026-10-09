export const LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxJsonDepth: 24,
  maxWalkNodes: 120_000,
  maxStringLength: 20_000,
  maxCaptionSent: 8_000,
  maxHashtagCount: 80,
  maxUniqueKept: 20_000,
  maxClassifyBodyBytes: 16_384,
  classifyConcurrency: 4,
  classifyMaxAttempts: 4,
} as const;

export const RATE_LIMITS = {
  classifyPerMinute: 40,
  checkoutPerMinute: 8,
  freeGrantPerHour: 6,
  verifyPerMinute: 30,
} as const;

export const ENTITLEMENT_TTL_MS = 2 * 60 * 60 * 1000;
