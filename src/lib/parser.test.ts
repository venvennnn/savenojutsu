import { describe, expect, it } from "vitest";
import {
  applyTierCap,
  canonicalizeReelUrl,
  isPhotoPostUrl,
  parseSavedPostsJson,
  parseTimestamp,
} from "./parser";
import { SAMPLE_EXPORT_JSON } from "./sample-export";

describe("canonicalizeReelUrl", () => {
  it("canonicalizes /reel/, /reels/, and /tv/ by shortcode", () => {
    expect(canonicalizeReelUrl("https://www.instagram.com/reel/AbC_12/")?.url).toBe(
      "https://www.instagram.com/reel/AbC_12/",
    );
    expect(canonicalizeReelUrl("http://instagram.com/reels/AbC_12")?.shortcode).toBe("AbC_12");
    expect(canonicalizeReelUrl("https://www.instagram.com/tv/AbC_12/")?.shortcode).toBe("AbC_12");
  });

  it("does not treat /p/ as a Reel", () => {
    expect(canonicalizeReelUrl("https://www.instagram.com/p/NotAReel999/")).toBeNull();
    expect(isPhotoPostUrl("https://www.instagram.com/p/NotAReel999/")).toBe(true);
  });
});

describe("parseTimestamp", () => {
  it("accepts seconds, milliseconds, and ISO", () => {
    expect(parseTimestamp(1735689600).ms).toBe(1735689600000);
    expect(parseTimestamp(1735689600000).ms).toBe(1735689600000);
    expect(parseTimestamp("2025-01-01T00:00:00.000Z").ms).toBe(Date.parse("2025-01-01T00:00:00.000Z"));
  });

  it("keeps unknown dates unknown", () => {
    expect(parseTimestamp("not-a-date").ms).toBeNull();
    expect(parseTimestamp(12).ms).toBeNull();
  });
});

describe("parseSavedPostsJson", () => {
  it("parses Meta string_list_data, drops photo posts, dedupes, and sorts newest first", () => {
    const result = parseSavedPostsJson(SAMPLE_EXPORT_JSON, "saved_posts.json", SAMPLE_EXPORT_JSON.length);
    expect(result.preview.unsupportedIgnored).toBeGreaterThan(0);
    const codes = result.reels.map((r) => r.shortcode);
    expect(codes).toContain("AbC123xyz01");
    expect(codes.filter((c) => c === "AbC123xyz01")).toHaveLength(1);
    expect(result.preview.duplicatesRemoved).toBeGreaterThan(0);
    const consulting = result.reels.find((r) => r.shortcode === "AbC123xyz01");
    expect(consulting?.caption).toMatch(/consulting offer/);
    expect(consulting?.creator).toBe("foundry_notes");
    const dates = result.reels.map((r) => r.savedAt);
    const known = dates.filter((d): d is number => d != null);
    expect([...known].sort((a, b) => b - a)).toEqual(known);
    const noText = result.reels.find((r) => r.shortcode === "NoCaption000");
    expect(noText?.hasUsableText).toBe(false);
  });

  it("parses nested label_values blocks", () => {
    const json = JSON.stringify({
      items: [
        {
          label_values: [
            { label: "URL", value: "https://instagram.com/reel/LabelReel1/" },
            { label: "Caption", value: "A travel note from Kyoto #travel" },
            { label: "Owner", value: "north.routes" },
            { label: "Hashtags", value: "#kyoto" },
            { label: "Collection", value: "Wander" },
          ],
        },
      ],
    });
    const result = parseSavedPostsJson(json, "labels.json", json.length);
    expect(result.reels[0]?.shortcode).toBe("LabelReel1");
    expect(result.reels[0]?.caption).toMatch(/Kyoto/);
    expect(result.reels[0]?.creator).toBe("north.routes");
    expect(result.reels[0]?.collection).toBe("Wander");
    expect(result.reels[0]?.hashtags.join(" ")).toMatch(/#travel|#kyoto/);
  });

  it("parses flat records and continues after malformed rows", () => {
    const json = JSON.stringify([
      {
        url: "https://www.instagram.com/reel/FlatOne/",
        caption: "Learn TypeScript in public",
        creator: "quietcode",
        timestamp: "2024-06-01",
      },
      null,
      { url: "https://www.instagram.com/p/PhotoOnly/" },
      {
        href: "https://www.instagram.com/reels/FlatTwo/",
        text: "Budget sinking funds",
        username: "ledger.leaf",
      },
    ]);
    const result = parseSavedPostsJson(json, "flat.json", json.length);
    expect(result.reels.map((r) => r.shortcode).sort()).toEqual(["FlatOne", "FlatTwo"]);
    expect(result.preview.unsupportedIgnored).toBeGreaterThan(0);
  });

  it("throws friendly errors for empty, invalid, and non-reel files", () => {
    expect(() => parseSavedPostsJson("   ", "x.json", 3)).toThrow(/empty/i);
    expect(() => parseSavedPostsJson("{", "x.json", 1)).toThrow(/not valid JSON/i);
    expect(() => parseSavedPostsJson("{}", "x.json", 2)).toThrow(/does not look like/i);
    const photos = JSON.stringify({
      saved_saved_media: [
        { string_list_data: [{ href: "https://www.instagram.com/p/OnlyPhoto/", timestamp: 1700000000 }] },
      ],
    });
    expect(() => parseSavedPostsJson(photos, "p.json", photos.length)).toThrow(/Photo posts/);
  });

  it("applies tier cap after newest-first sort", () => {
    const json = JSON.stringify(
      [3, 2, 1].map((n) => ({
        url: `https://www.instagram.com/reel/Cap${n}/`,
        timestamp: 1700000000 + n,
        caption: `item ${n}`,
      })),
    );
    const { reels } = parseSavedPostsJson(json, "cap.json", json.length);
    expect(applyTierCap(reels, 2).map((r) => r.shortcode)).toEqual(["Cap3", "Cap2"]);
  });
});
