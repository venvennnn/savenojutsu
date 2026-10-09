import { labelFor, TOPICS, CONTENT_TYPES } from "./taxonomy";
import type {
  AnalyticsSnapshot,
  ClassifiedReel,
  ContentTypeId,
  CoverageStats,
  TopicId,
} from "./types";

export function coverage(reels: ClassifiedReel[]): CoverageStats {
  const classified = reels.filter((r) => r.status === "classified").length;
  const insufficientText = reels.filter((r) => r.status === "insufficient_text").length;
  const failed = reels.filter((r) => r.status === "failed").length;
  const cancelled = reels.filter((r) => r.status === "cancelled").length;
  const unknownTopic = reels.filter(
    (r) => r.status === "classified" && r.labels?.topic.label === "unknown",
  ).length;
  return {
    analyzed: reels.length,
    classified,
    insufficientText,
    unknownTopic,
    failed,
    cancelled,
    withCaption: reels.filter((r) => r.hasUsableText).length,
    dated: reels.filter((r) => r.savedAt != null).length,
  };
}

export function buildAnalytics(reels: ClassifiedReel[]): AnalyticsSnapshot {
  const cov = coverage(reels);
  const classified = reels.filter((r) => r.status === "classified" && r.labels);

  const topicMap = new Map<TopicId, number>();
  const typeMap = new Map<ContentTypeId, number>();
  const creatorMap = new Map<string, number>();
  const monthMap = new Map<string, { total: number; byTopic: Record<string, number> }>();
  const confidenceBuckets = [
    { label: "0.0–0.25", count: 0 },
    { label: "0.25–0.50", count: 0 },
    { label: "0.50–0.75", count: 0 },
    { label: "0.75–1.00", count: 0 },
  ];

  for (const reel of classified) {
    const topic = reel.labels!.topic.label;
    topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
    const ct = reel.labels!.contentType.label;
    typeMap.set(ct, (typeMap.get(ct) ?? 0) + 1);
    if (reel.creator) {
      creatorMap.set(reel.creator, (creatorMap.get(reel.creator) ?? 0) + 1);
    } else {
      creatorMap.set("(unknown creator)", (creatorMap.get("(unknown creator)") ?? 0) + 1);
    }
    if (reel.savedAt != null) {
      const d = new Date(reel.savedAt);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const entry = monthMap.get(month) ?? { total: 0, byTopic: {} };
      entry.total += 1;
      entry.byTopic[topic] = (entry.byTopic[topic] ?? 0) + 1;
      monthMap.set(month, entry);
    }
    const conf = reel.labels!.topic.confidence;
    if (conf < 0.25) confidenceBuckets[0].count += 1;
    else if (conf < 0.5) confidenceBuckets[1].count += 1;
    else if (conf < 0.75) confidenceBuckets[2].count += 1;
    else confidenceBuckets[3].count += 1;
  }

  const topicTotal = classified.length || 1;
  const topicCounts = [...topicMap.entries()]
    .map(([id, count]) => ({
      id,
      label: labelFor(TOPICS, id),
      count,
      pct: (count / topicTotal) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  const contentTypeCounts = [...typeMap.entries()]
    .map(([id, count]) => ({
      id,
      label: labelFor(CONTENT_TYPES, id),
      count,
      pct: (count / topicTotal) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  const creatorCounts = [...creatorMap.entries()]
    .map(([creator, count]) => ({ creator, count }))
    .sort((a, b) => b.count - a.count);

  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const dated = reels.filter((r) => r.savedAt != null).map((r) => r.savedAt as number);
  const dateRange =
    dated.length > 0 ? { min: Math.min(...dated), max: Math.max(...dated) } : null;

  const mostCommonTopic = topicCounts[0] ?? null;
  let headlineFact =
    "No classified captions yet — findings only describe items with usable text in this export.";
  if (mostCommonTopic && classified.length > 0) {
    headlineFact = `${mostCommonTopic.label} is the most common topic among classified saves at ${Math.round(
      mostCommonTopic.pct,
    )}%.`;
  }

  const fieldsUsed = [...new Set(reels.flatMap((r) => r.sourceFields))].sort();
  const promotionalYes = classified.filter((r) => r.labels?.promotional.label === "yes").length;

  return {
    coverage: cov,
    topicCounts,
    contentTypeCounts,
    creatorCounts,
    monthly,
    dateRange,
    headlineFact,
    mostCommonTopic,
    confidenceBuckets,
    promotionalYes,
    fieldsUsed,
  };
}

export function formatDate(ms: number | null): string {
  if (ms == null) return "Unknown date";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateRange(range: { min: number; max: number } | null): string {
  if (!range) return "Save dates unknown";
  return `${formatDate(range.min)} – ${formatDate(range.max)}`;
}

export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
