import { LIMITS } from "./limits";
import { clipString } from "./sanitize";
import type { CanonicalReel, ImportIssue, ImportPreview, ImportResult } from "./types";

const REEL_PATH =
  /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(reel|reels|tv)\/([A-Za-z0-9_-]+)/i;
const PHOTO_PATH =
  /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/p\/([A-Za-z0-9_-]+)/i;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

const URL_KEYS = new Set([
  "href",
  "url",
  "link",
  "uri",
  "permalink",
  "media_url",
  "reel_url",
]);
const CAPTION_KEYS = new Set(["caption", "text", "title_text", "media_caption"]);
const CREATOR_KEYS = new Set([
  "creator",
  "owner",
  "username",
  "author",
  "account",
  "profile",
  "title",
  "name",
]);
const TIME_KEYS = new Set([
  "timestamp",
  "time",
  "saved_at",
  "date",
  "creation_timestamp",
  "taken_at",
]);
const COLLECTION_KEYS = new Set([
  "collection",
  "collection_name",
  "album",
  "folder",
]);
const HASHTAG_KEYS = new Set(["hashtags", "hashtag"]);

const LABEL_MAP: Record<string, "url" | "caption" | "creator" | "hashtags" | "timestamp" | "collection"> =
  {
    url: "url",
    link: "url",
    href: "url",
    permalink: "url",
    caption: "caption",
    "media caption": "caption",
    owner: "creator",
    creator: "creator",
    username: "creator",
    account: "creator",
    hashtags: "hashtags",
    hashtag: "hashtags",
    timestamp: "timestamp",
    date: "timestamp",
    "saved at": "timestamp",
    collection: "collection",
    "collection name": "collection",
  };

export class ImportError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ImportError";
  }
}

export function canonicalizeReelUrl(input: string): { shortcode: string; url: string } | null {
  const match = String(input).match(REEL_PATH);
  if (!match) return null;
  const shortcode = match[2];
  return {
    shortcode,
    url: `https://www.instagram.com/reel/${shortcode}/`,
  };
}

export function isPhotoPostUrl(input: string): boolean {
  return PHOTO_PATH.test(String(input)) && !REEL_PATH.test(String(input));
}

export function parseTimestamp(value: unknown): { ms: number | null; raw: string | number | null } {
  if (value == null || value === "") {
    return { ms: null, raw: null };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e10 ? value : value * 1000;
    if (ms < 946684800000 || ms > Date.now() + 86400000 * 2) {
      return { ms: null, raw: value };
    }
    return { ms: Math.round(ms), raw: value };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ms: null, raw: null };
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return parseTimestamp(Number(trimmed));
    }
    const iso = Date.parse(trimmed);
    if (!Number.isNaN(iso)) {
      if (iso < 946684800000 || iso > Date.now() + 86400000 * 2) {
        return { ms: null, raw: trimmed };
      }
      return { ms: iso, raw: trimmed };
    }
    return { ms: null, raw: trimmed };
  }
  return { ms: null, raw: String(value) };
}

function extractHashtags(value: unknown, extraCaption?: string | null): string[] {
  const found = new Set<string>();
  const addFromString = (text: string) => {
    const matches = text.match(HASHTAG_RE) ?? [];
    for (const tag of matches) {
      found.add(tag.toLowerCase());
    }
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const t = item.trim();
        if (!t) continue;
        if (t.startsWith("#")) found.add(t.toLowerCase());
        else addFromString(t);
      }
    }
  } else if (typeof value === "string") {
    addFromString(value);
  }
  if (extraCaption) addFromString(extraCaption);
  return [...found].slice(0, LIMITS.maxHashtagCount);
}

type PartialReel = {
  url: string | null;
  shortcode: string | null;
  caption: string | null;
  creator: string | null;
  hashtags: string[];
  savedAt: number | null;
  savedAtRaw: string | number | null;
  collection: string | null;
  sourceFields: Set<string>;
};

function emptyPartial(): PartialReel {
  return {
    url: null,
    shortcode: null,
    caption: null,
    creator: null,
    hashtags: [],
    savedAt: null,
    savedAtRaw: null,
    collection: null,
    sourceFields: new Set(),
  };
}

function applyUrl(partial: PartialReel, raw: string) {
  const canon = canonicalizeReelUrl(raw);
  if (!canon) return false;
  partial.url = canon.url;
  partial.shortcode = canon.shortcode;
  partial.sourceFields.add("url");
  return true;
}

function applyCaption(partial: PartialReel, raw: string) {
  const clipped = clipString(raw.trim(), LIMITS.maxStringLength);
  if (!clipped) return;
  if (!partial.caption || clipped.length > partial.caption.length) {
    partial.caption = clipped;
  }
  partial.sourceFields.add("caption");
}

function applyCreator(partial: PartialReel, raw: string) {
  const value = clipString(raw.trim().replace(/^@/, ""), 120);
  if (!value) return;
  if (value.length > 80 && /\s/.test(value)) return;
  if (!partial.creator) partial.creator = value;
  partial.sourceFields.add("creator");
}

function applyTime(partial: PartialReel, raw: unknown) {
  const parsed = parseTimestamp(raw);
  if (parsed.ms != null && (partial.savedAt == null || parsed.ms > partial.savedAt)) {
    partial.savedAt = parsed.ms;
    partial.savedAtRaw = parsed.raw;
  } else if (partial.savedAtRaw == null && parsed.raw != null) {
    partial.savedAtRaw = parsed.raw;
  }
  partial.sourceFields.add("timestamp");
}

function applyCollection(partial: PartialReel, raw: string) {
  const value = clipString(raw.trim(), 200);
  if (!value) return;
  if (!partial.collection) partial.collection = value;
  partial.sourceFields.add("collection");
}

function applyHashtags(partial: PartialReel, raw: unknown, caption?: string | null) {
  const tags = extractHashtags(raw, caption);
  if (tags.length) {
    partial.hashtags = [...new Set([...partial.hashtags, ...tags])];
    partial.sourceFields.add("hashtags");
  }
}

function hasUsableText(caption: string | null, hashtags: string[]): boolean {
  const cap = (caption ?? "").trim();
  if (cap.length >= 2) return true;
  return hashtags.length > 0;
}

function richness(p: PartialReel): number {
  return (
    (p.caption?.length ?? 0) +
    p.hashtags.join("").length +
    (p.creator ? 20 : 0) +
    (p.collection ? 10 : 0) +
    (p.savedAt ? 5 : 0)
  );
}

function mergePartials(a: PartialReel, b: PartialReel): PartialReel {
  const newer = (a.savedAt ?? 0) >= (b.savedAt ?? 0) ? a : b;
  const older = newer === a ? b : a;
  const richer = richness(a) >= richness(b) ? a : b;
  const out = emptyPartial();
  out.url = newer.url ?? older.url;
  out.shortcode = newer.shortcode ?? older.shortcode;
  out.caption = richer.caption ?? (richer === a ? b.caption : a.caption);
  out.creator = richer.creator ?? older.creator;
  out.hashtags = [...new Set([...a.hashtags, ...b.hashtags])];
  out.savedAt = newer.savedAt ?? older.savedAt;
  out.savedAtRaw = newer.savedAtRaw ?? older.savedAtRaw;
  out.collection = richer.collection ?? older.collection;
  out.sourceFields = new Set([...a.sourceFields, ...b.sourceFields]);
  return out;
}

function looksLikeUsername(value: string): boolean {
  return /^[A-Za-z0-9._]{1,30}$/.test(value) && !value.includes(" ");
}

function readLabelValues(node: Record<string, unknown>, partial: PartialReel) {
  const rows = node.label_values;
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const label = String(rec.label ?? rec.key ?? "")
      .trim()
      .toLowerCase();
    const mapped = LABEL_MAP[label];
    const value =
      rec.value ??
      rec.href ??
      (Array.isArray(rec.media_list_data) ? rec.media_list_data : undefined) ??
      rec.timestamp;
    if (!mapped || value == null) continue;
    if (mapped === "url" && typeof value === "string") applyUrl(partial, value);
    if (mapped === "caption" && typeof value === "string") applyCaption(partial, value);
    if (mapped === "creator" && typeof value === "string") applyCreator(partial, value);
    if (mapped === "hashtags") applyHashtags(partial, value, partial.caption);
    if (mapped === "timestamp") applyTime(partial, value);
    if (mapped === "collection" && typeof value === "string") applyCollection(partial, value);
  }
}

function readStringList(
  node: Record<string, unknown>,
  partial: PartialReel,
  onPhoto: () => void,
) {
  const lists = ["string_list_data", "media_list_data"] as const;
  for (const key of lists) {
    const rows = node[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      if (typeof rec.href === "string") {
        if (!applyUrl(partial, rec.href) && isPhotoPostUrl(rec.href)) onPhoto();
      }
      if (typeof rec.timestamp === "number" || typeof rec.timestamp === "string") {
        applyTime(partial, rec.timestamp);
      }
      if (typeof rec.value === "string" && rec.value.length > 2 && !looksLikeUsername(rec.value)) {
        if (!partial.caption) applyCaption(partial, rec.value);
      }
    }
  }
  if (typeof node.title === "string" && looksLikeUsername(node.title)) {
    applyCreator(partial, node.title);
  }
}

function readFlat(node: Record<string, unknown>, partial: PartialReel) {
  for (const [key, value] of Object.entries(node)) {
    const lower = key.toLowerCase();
    if (URL_KEYS.has(lower) && typeof value === "string") applyUrl(partial, value);
    else if (CAPTION_KEYS.has(lower) && typeof value === "string") applyCaption(partial, value);
    else if (CREATOR_KEYS.has(lower) && typeof value === "string") applyCreator(partial, value);
    else if (TIME_KEYS.has(lower)) applyTime(partial, value);
    else if (COLLECTION_KEYS.has(lower) && typeof value === "string") applyCollection(partial, value);
    else if (HASHTAG_KEYS.has(lower)) applyHashtags(partial, value, partial.caption);
  }
}

function collectStringUrls(value: unknown, acc: string[]) {
  if (typeof value === "string") {
    if (REEL_PATH.test(value) || PHOTO_PATH.test(value)) acc.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringUrls(item, acc);
  }
}

export function parseSavedPostsJson(
  rawText: string,
  fileName: string,
  fileBytes: number,
): ImportResult {
  if (!rawText.trim()) {
    throw new ImportError("empty", "This file is empty. Choose a saved-posts JSON export.");
  }
  if (fileBytes > LIMITS.maxFileBytes) {
    throw new ImportError(
      "too_large",
      `This file is larger than ${Math.round(LIMITS.maxFileBytes / 1024 / 1024)} MB.`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new ImportError(
      "invalid_json",
      "This file is not valid JSON. Export saved posts from Instagram and select the .json file.",
    );
  }

  const issues: ImportIssue[] = [];
  const candidates: PartialReel[] = [];
  let unsupportedIgnored = 0;
  let malformedSkipped = 0;
  let nodes = 0;
  const fieldsObserved = new Set<string>();
  let formatLabel = "Generic JSON";

  const visit = (node: unknown, depth: number, path: string, inheritedCollection: string | null) => {
    nodes += 1;
    if (nodes > LIMITS.maxWalkNodes) return;
    if (depth > LIMITS.maxJsonDepth) return;

    if (typeof node === "string") {
      if (applyUrl(emptyPartial(), node)) {
        const p = emptyPartial();
        applyUrl(p, node);
        if (inheritedCollection) applyCollection(p, inheritedCollection);
        candidates.push(p);
      } else if (isPhotoPostUrl(node)) {
        unsupportedIgnored += 1;
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, depth + 1, `${path}[${i}]`, inheritedCollection));
      return;
    }

    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;

    try {
      const partial = emptyPartial();
      if (inheritedCollection) applyCollection(partial, inheritedCollection);

      if ("saved_saved_media" in rec || "saved_media" in rec) {
        formatLabel = "Instagram saved media export";
      }
      if ("label_values" in rec) {
        formatLabel = "Instagram label_values export";
        readLabelValues(rec, partial);
      }
      if ("string_list_data" in rec || "media_list_data" in rec) {
        formatLabel = "Instagram string_list_data export";
        readStringList(rec, partial, () => {
          unsupportedIgnored += 1;
        });
      }
      readFlat(rec, partial);

      const urls: string[] = [];
      collectStringUrls(rec, urls);
      for (const url of urls) {
        if (isPhotoPostUrl(url) && !canonicalizeReelUrl(url)) {
          unsupportedIgnored += 1;
        }
      }

      if (partial.shortcode) {
        for (const field of partial.sourceFields) fieldsObserved.add(field);
        candidates.push(partial);
      }

      const nextCollection =
        partial.collection ??
        (typeof rec.title === "string" && !looksLikeUsername(rec.title) ? rec.title : inheritedCollection);

      for (const [key, value] of Object.entries(rec)) {
        if (
          key === "string_list_data" ||
          key === "media_list_data" ||
          key === "label_values"
        ) {
          continue;
        }
        visit(value, depth + 1, `${path}.${key}`, nextCollection);
      }
    } catch {
      malformedSkipped += 1;
      issues.push({ path, message: "Skipped a malformed record." });
    }
  };

  visit(data, 0, "$", null);

  if (candidates.length === 0) {
    if (unsupportedIgnored > 0) {
      throw new ImportError(
        "no_reels",
        `Found ${unsupportedIgnored} saved post URL(s), but none were Reel/TV links (/reel/, /reels/, or /tv/). Photo posts (/p/) are not treated as Reels.`,
      );
    }
    throw new ImportError(
      "unsupported",
      "This JSON does not look like an Instagram saved-posts export with Reel URLs. Select saved_posts.json from your download.",
    );
  }

  const byCode = new Map<string, { partial: PartialReel; dupes: number }>();
  for (const cand of candidates) {
    if (!cand.shortcode) continue;
    const existing = byCode.get(cand.shortcode);
    if (!existing) {
      byCode.set(cand.shortcode, { partial: cand, dupes: 0 });
    } else {
      existing.partial = mergePartials(existing.partial, cand);
      existing.dupes += 1;
    }
  }

  const unique = [...byCode.entries()].map(([shortcode, { partial, dupes }]) => {
    const tags = extractHashtags(partial.hashtags, partial.caption);
    const reel: CanonicalReel = {
      id: shortcode,
      shortcode,
      url: partial.url ?? `https://www.instagram.com/reel/${shortcode}/`,
      creator: partial.creator,
      caption: partial.caption,
      hashtags: tags,
      savedAt: partial.savedAt,
      savedAtRaw: partial.savedAtRaw,
      collection: partial.collection,
      sourceFields: [...partial.sourceFields],
      hasUsableText: hasUsableText(partial.caption, tags),
      duplicateCount: dupes,
    };
    return reel;
  });

  unique.sort((a, b) => {
    if (a.savedAt != null && b.savedAt != null) return b.savedAt - a.savedAt;
    if (a.savedAt != null) return -1;
    if (b.savedAt != null) return 1;
    return a.shortcode.localeCompare(b.shortcode);
  });

  const truncatedFrom = unique.length > LIMITS.maxUniqueKept ? unique.length : null;
  const kept = truncatedFrom ? unique.slice(0, LIMITS.maxUniqueKept) : unique;
  const dated = kept.filter((r) => r.savedAt != null);
  const dateRange =
    dated.length > 0
      ? {
          min: Math.min(...dated.map((r) => r.savedAt as number)),
          max: Math.max(...dated.map((r) => r.savedAt as number)),
        }
      : null;

  const preview: ImportPreview = {
    fileName,
    fileBytes,
    formatLabel,
    reelsFound: unique.length,
    duplicatesRemoved: candidates.length - unique.length,
    unsupportedIgnored,
    malformedSkipped,
    truncated: Boolean(truncatedFrom),
    truncatedFrom,
    withText: kept.filter((r) => r.hasUsableText).length,
    withoutText: kept.filter((r) => !r.hasUsableText).length,
    datedCount: dated.length,
    unknownDateCount: kept.length - dated.length,
    dateRange,
    issues,
    fieldsObserved: [...fieldsObserved].sort(),
  };

  return { preview, reels: kept };
}

export function applyTierCap(reels: CanonicalReel[], cap: number): CanonicalReel[] {
  return reels.slice(0, cap);
}
