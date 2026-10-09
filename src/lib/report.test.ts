import { describe, expect, it } from "vitest";
import { buildReportHtml, reportHasExternalNetwork } from "./report";
import type { ClassifiedReel, ImportPreview } from "./types";

const preview: ImportPreview = {
  fileName: "saved_posts.json",
  fileBytes: 12,
  formatLabel: "test",
  reelsFound: 1,
  duplicatesRemoved: 0,
  unsupportedIgnored: 0,
  malformedSkipped: 0,
  truncated: false,
  truncatedFrom: null,
  withText: 1,
  withoutText: 0,
  datedCount: 1,
  unknownDateCount: 0,
  dateRange: { min: 1_700_000_000_000, max: 1_700_000_000_000 },
  issues: [],
  fieldsObserved: ["caption", "url"],
};

function reel(over: Partial<ClassifiedReel> = {}): ClassifiedReel {
  return {
    id: "EvilCode",
    shortcode: "EvilCode",
    url: "https://www.instagram.com/reel/EvilCode/",
    creator: "<img src=x onerror=alert(1)>",
    caption: "</script><script>alert(1)</script>",
    hashtags: ["#hi"],
    savedAt: 1_700_000_000_000,
    savedAtRaw: 1_700_000_000,
    collection: null,
    sourceFields: ["caption", "url"],
    hasUsableText: true,
    duplicateCount: 0,
    status: "classified",
    labels: {
      topic: { label: "technology_ai", confidence: 0.7, probabilities: { technology_ai: 0.7 } },
      contentType: { label: "tutorial", confidence: 0.6, probabilities: { tutorial: 0.6 } },
      apparentUse: { label: "learning", confidence: 0.5, probabilities: { learning: 0.5 } },
      promotional: { probability: 0.1, label: "no" },
      captionHook: { label: "none", confidence: 0.4, probabilities: { none: 0.4 } },
      captionCta: { label: "none", confidence: 0.4, probabilities: { none: 0.4 } },
    },
    modelVersion: "jev-1.13.0",
    testMode: false,
    errorMessage: null,
    textSent: { caption: "</script><script>alert(1)</script>", hashtags: ["#hi"] },
    needsReview: false,
    ...over,
  };
}

describe("standalone report", () => {
  it("escapes malicious captions and has no CDN/network assets", () => {
    const html = buildReportHtml({
      generatedAt: "2026-01-01T00:00:00.000Z",
      planId: "free",
      preview,
      reels: [reel()],
      config: {
        mode: "byok",
        testMode: false,
        jevModel: "jev-1.13.0",
        needsReviewThreshold: 0.45,
      },
      modelVersionObserved: "jev-1.13.0",
    });
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).not.toMatch(/<img src=x onerror/i);
    expect(reportHasExternalNetwork(html)).toBe(false);
    expect(html).not.toMatch(/cdn\.|fonts\.googleapis|unpkg|jsdelivr/i);
    expect(html).toContain("<style>");
    expect(html).toContain("const DATA =");
  });
});
