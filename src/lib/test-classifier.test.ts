import { describe, expect, it } from "vitest";
import { heuristicClassify } from "./test-classifier";

describe("test-mode heuristic", () => {
  it("does not invent a topic from empty text", () => {
    const labels = heuristicClassify(" ", []);
    expect(labels.topic.label).toBe("unknown");
  });

  it("can tag explicit finance language", () => {
    expect(heuristicClassify("I invest in index funds and taxes", []).topic.label).toBe("finance");
  });
});
