import type { ClassifiedReel } from "./types";
import { formatDate } from "./analytics";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function reelsToCsv(reels: ClassifiedReel[]): string {
  const headers = [
    "shortcode",
    "url",
    "saved_date",
    "creator",
    "collection",
    "caption",
    "hashtags",
    "status",
    "topic",
    "topic_confidence",
    "content_type",
    "content_type_confidence",
    "apparent_use",
    "apparent_use_confidence",
    "promotional",
    "promotional_probability",
    "caption_hook",
    "caption_cta",
    "needs_review",
    "model_version",
    "test_mode",
    "source_fields",
  ];
  const rows = reels.map((r) =>
    [
      r.shortcode,
      r.url,
      r.savedAt ? formatDate(r.savedAt) : "",
      r.creator ?? "",
      r.collection ?? "",
      r.caption ?? "",
      r.hashtags.join(" "),
      r.status,
      r.labels?.topic.label ?? "",
      r.labels?.topic.confidence ?? "",
      r.labels?.contentType.label ?? "",
      r.labels?.contentType.confidence ?? "",
      r.labels?.apparentUse.label ?? "",
      r.labels?.apparentUse.confidence ?? "",
      r.labels?.promotional.label ?? "",
      r.labels?.promotional.probability ?? "",
      r.labels?.captionHook.label ?? "",
      r.labels?.captionCta.label ?? "",
      r.needsReview,
      r.modelVersion ?? "",
      r.testMode,
      r.sourceFields.join("|"),
    ]
      .map(csvCell)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
