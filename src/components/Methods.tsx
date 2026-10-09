"use client";

import { pct } from "@/lib/analytics";
import { reelsToCsv, downloadTextFile } from "@/lib/csv";
import { TOPICS, CONTENT_TYPES, APPARENT_USES, INSUFFICIENT_TEXT_LABEL } from "@/lib/taxonomy";
import { useSession } from "@/state/session";
import { HorizontalBars } from "./Charts";

export function Methods() {
  const { analytics, results, preview, config } = useSession();
  if (!analytics || !preview) return null;
  const model =
    results.find((r) => r.modelVersion)?.modelVersion ?? config?.jevModel ?? "n/a";
  return (
    <div className="space-y-6 text-sm">
      <p>
        This view is a compact methods note. It describes the uploaded export, not Instagram
        performance. Watch time, views, and “why you saved this” are not in the file and are not
        inferred.
      </p>
      <section className="scroll-card rounded-2xl p-5">
        <h3 className="font-serif text-lg text-forest">JSON fields used</h3>
        <p className="mt-2">{analytics.fieldsUsed.join(", ") || "url only"}</p>
        <p className="mt-2 text-muted">
          Supported layouts: Meta <code>string_list_data</code>, nested <code>label_values</code>,
          and flat records. Only <code>/reel/</code>, <code>/reels/</code>, and <code>/tv/</code>{" "}
          URLs are analyzed. <code>/p/</code> photo posts are ignored.
        </p>
      </section>
      <section className="scroll-card rounded-2xl p-5">
        <h3 className="font-serif text-lg text-forest">Coverage</h3>
        <ul className="mt-2 list-disc pl-5">
          <li>Classified: {analytics.coverage.classified}</li>
          <li>
            Insufficient text ({INSUFFICIENT_TEXT_LABEL}): {analytics.coverage.insufficientText} (
            {pct(analytics.coverage.insufficientText, analytics.coverage.analyzed)})
          </li>
          <li>Unknown topic: {analytics.coverage.unknownTopic}</li>
          <li>Failed: {analytics.coverage.failed}</li>
        </ul>
      </section>
      <section className="scroll-card rounded-2xl p-5">
        <h3 className="font-serif text-lg text-forest">Taxonomy</h3>
        <p className="mt-2">Topics: {TOPICS.map((t) => t.label).join("; ")}</p>
        <p className="mt-2">Content types: {CONTENT_TYPES.map((t) => t.label).join("; ")}</p>
        <p className="mt-2">Apparent use: {APPARENT_USES.map((t) => t.label).join("; ")}</p>
        <p className="mt-2 text-muted">
          Definitions live in <code>src/lib/taxonomy.ts</code>. Hooks and CTAs are caption-text only.
        </p>
      </section>
      <section className="scroll-card rounded-2xl p-5">
        <h3 className="font-serif text-lg text-forest">Model confidence (not accuracy)</h3>
        <p className="mt-2 text-muted">
          Jev version requested: {config?.jevModel}. Observed: {model}. “Needs review” threshold{" "}
          {config?.needsReviewThreshold} is a product setting, not a validated accuracy cutoff.
        </p>
        <div className="mt-3">
          <HorizontalBars
            items={analytics.confidenceBuckets.map((b) => ({
              label: b.label,
              count: b.count,
              pct: analytics.coverage.classified
                ? (b.count / analytics.coverage.classified) * 100
                : 0,
            }))}
          />
        </div>
      </section>
      <details className="scroll-card rounded-2xl p-5">
        <summary className="cursor-pointer font-serif text-lg text-forest">Evidence per classified Reel</summary>
        <ul className="mt-3 space-y-3">
          {results
            .filter((r) => r.labels)
            .slice(0, 40)
            .map((r) => (
              <li key={r.id}>
                <p className="font-medium">{r.creator ?? r.shortcode}</p>
                <p className="whitespace-pre-wrap text-muted">{r.textSent?.caption || "(hashtags only)"}</p>
                <p>Topic {r.labels?.topic.label} from that text.</p>
              </li>
            ))}
        </ul>
      </details>
      <button
        type="button"
        className="rounded-full border border-line px-4 py-2"
        onClick={() => downloadTextFile("save-no-jutsu-results.csv", reelsToCsv(results), "text/csv;charset=utf-8")}
      >
        Download processed CSV
      </button>
      <button
        type="button"
        className="ml-2 rounded-full border border-line px-4 py-2"
        onClick={() =>
          downloadTextFile(
            "save-no-jutsu-results.json",
            JSON.stringify(
              results.map((r) => ({
                shortcode: r.shortcode,
                url: r.url,
                creator: r.creator,
                caption: r.caption,
                hashtags: r.hashtags,
                savedAt: r.savedAt,
                status: r.status,
                labels: r.labels,
                modelVersion: r.modelVersion,
              })),
              null,
              2,
            ),
            "application/json",
          )
        }
      >
        Download processed JSON
      </button>
    </div>
  );
}
