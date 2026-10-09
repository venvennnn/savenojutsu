import { describe, expect, it } from "vitest";
import { buildJevQuestions, clientClassifyPayloadSchema, validateJevResponse } from "./jev-schema";
import { TOPIC_IDS } from "./taxonomy";

describe("Jev request schema", () => {
  it("bundles every classification question in one request map", () => {
    const q = buildJevQuestions();
    expect(Object.keys(q).sort()).toEqual([
      "apparent_use",
      "caption_cta",
      "caption_hook",
      "content_type",
      "promotional",
      "topic",
    ]);
    expect(Object.keys(q.topic.criteria)).toEqual(TOPIC_IDS);
    expect(q.promotional.type).toBe("noul");
  });
});

describe("validateJevResponse", () => {
  const valid = {
    model: "jev-1.13.0",
    answers: {
      topic: {
        type: "choice",
        choice: "finance",
        confidence: 0.8,
        probabilities: { finance: 0.8, other: 0.2 },
      },
      content_type: {
        type: "choice",
        choice: "tutorial",
        confidence: 0.7,
        probabilities: { tutorial: 0.7 },
      },
      apparent_use: {
        type: "choice",
        choice: "learning",
        confidence: 0.6,
        probabilities: { learning: 0.6 },
      },
      promotional: { type: "noul", noul: 0.12 },
      caption_hook: {
        type: "choice",
        choice: "instruction",
        confidence: 0.5,
        probabilities: { instruction: 0.5 },
      },
      caption_cta: {
        type: "choice",
        choice: "none",
        confidence: 0.9,
        probabilities: { none: 0.9 },
      },
    },
  };

  it("accepts a well-formed response and records the model version", () => {
    const out = validateJevResponse(valid);
    expect(out.modelVersion).toBe("jev-1.13.0");
    expect(out.labels.topic.label).toBe("finance");
    expect(out.labels.promotional.label).toBe("no");
  });

  it("rejects labels outside the taxonomy", () => {
    const bad = structuredClone(valid);
    bad.answers.topic.choice = "not_a_topic";
    expect(() => validateJevResponse(bad)).toThrow(/invalid_jev_label/);
  });

  it("rejects missing answers", () => {
    expect(() => validateJevResponse({ model: "jev-1.13.0", answers: {} })).toThrow();
  });
});

describe("clientClassifyPayloadSchema", () => {
  it("requires caption, hashtags, and entitlement — not URLs", () => {
    const parsed = clientClassifyPayloadSchema({
      caption: "hello",
      hashtags: ["#ai"],
      entitlementToken: "tok",
      url: "https://instagram.com/reel/nope/",
    });
    expect(parsed).toEqual({
      caption: "hello",
      hashtags: ["#ai"],
      entitlementToken: "tok",
      turnstileToken: undefined,
    });
  });
});
