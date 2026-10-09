export type PlanId = "free" | "standard" | "deep";

export type AppMode = "hosted" | "byok";

export type ProcessingStage =
  | "reading"
  | "finding"
  | "classifying"
  | "building";

export type ClassificationStatus =
  | "classified"
  | "insufficient_text"
  | "failed"
  | "cancelled"
  | "pending";

export type TopicId =
  | "business_entrepreneurship"
  | "technology_ai"
  | "career_work"
  | "finance"
  | "education_learning"
  | "anime_entertainment"
  | "health_fitness"
  | "food_cooking"
  | "travel"
  | "home_lifestyle"
  | "art_design_photography"
  | "news_culture"
  | "other"
  | "unknown";

export type ContentTypeId =
  | "tutorial"
  | "recommendation"
  | "inspiration"
  | "entertainment"
  | "opinion"
  | "news"
  | "product"
  | "other"
  | "unknown";

export type ApparentUseId =
  | "learning"
  | "practical_reference"
  | "inspiration"
  | "shopping"
  | "entertainment"
  | "other"
  | "unknown";

export type CaptionHookId =
  | "question"
  | "contrarian_claim"
  | "curiosity"
  | "result_first"
  | "story"
  | "instruction"
  | "none"
  | "unknown";

export type CaptionCtaId =
  | "comment"
  | "follow"
  | "save"
  | "share"
  | "buy"
  | "link"
  | "none"
  | "unknown";

export interface CanonicalReel {
  id: string;
  shortcode: string;
  url: string;
  creator: string | null;
  caption: string | null;
  hashtags: string[];
  savedAt: number | null;
  savedAtRaw: string | number | null;
  collection: string | null;
  sourceFields: string[];
  hasUsableText: boolean;
  duplicateCount: number;
}

export interface ImportIssue {
  path: string;
  message: string;
}

export interface ImportPreview {
  fileName: string;
  fileBytes: number;
  formatLabel: string;
  reelsFound: number;
  duplicatesRemoved: number;
  unsupportedIgnored: number;
  malformedSkipped: number;
  truncated: boolean;
  truncatedFrom: number | null;
  withText: number;
  withoutText: number;
  datedCount: number;
  unknownDateCount: number;
  dateRange: { min: number; max: number } | null;
  issues: ImportIssue[];
  fieldsObserved: string[];
}

export interface ImportResult {
  preview: ImportPreview;
  reels: CanonicalReel[];
}

export interface ChoicePrediction<T extends string> {
  label: T;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface NoulPrediction {
  probability: number;
  label: "yes" | "no";
}

export interface JevLabels {
  topic: ChoicePrediction<TopicId>;
  contentType: ChoicePrediction<ContentTypeId>;
  apparentUse: ChoicePrediction<ApparentUseId>;
  promotional: NoulPrediction;
  captionHook: ChoicePrediction<CaptionHookId>;
  captionCta: ChoicePrediction<CaptionCtaId>;
}

export interface ClassifiedReel extends CanonicalReel {
  status: ClassificationStatus;
  labels: JevLabels | null;
  modelVersion: string | null;
  testMode: boolean;
  errorMessage: string | null;
  textSent: { caption: string; hashtags: string[] } | null;
  needsReview: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceUsd: number;
  amountCents: number;
  cap: number;
  blurb: string;
}

export interface PublicConfig {
  mode: AppMode;
  testMode: boolean;
  stripeConfigured: boolean;
  jevConfigured: boolean;
  jevModel: string;
  needsReviewThreshold: number;
  turnstileSiteKey: string | null;
  plans: PlanDefinition[];
  kvConfigured: boolean;
}

export interface Entitlement {
  token: string;
  planId: PlanId;
  maxItems: number;
  testMode: boolean;
}

export interface CoverageStats {
  analyzed: number;
  classified: number;
  insufficientText: number;
  unknownTopic: number;
  failed: number;
  cancelled: number;
  withCaption: number;
  dated: number;
}

export interface AnalyticsSnapshot {
  coverage: CoverageStats;
  topicCounts: { id: TopicId; label: string; count: number; pct: number }[];
  contentTypeCounts: {
    id: ContentTypeId;
    label: string;
    count: number;
    pct: number;
  }[];
  creatorCounts: { creator: string; count: number }[];
  monthly: {
    month: string;
    total: number;
    byTopic: Record<string, number>;
  }[];
  dateRange: { min: number; max: number } | null;
  headlineFact: string;
  mostCommonTopic: { id: TopicId; label: string; count: number; pct: number } | null;
  confidenceBuckets: { label: string; count: number }[];
  promotionalYes: number;
  fieldsUsed: string[];
}
