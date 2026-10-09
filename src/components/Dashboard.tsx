"use client";

import { formatDateRange, pct } from "@/lib/analytics";
import { reelsToCsv, downloadTextFile } from "@/lib/csv";
import { getPlan } from "@/lib/plans";
import { buildReportHtml, downloadReport } from "@/lib/report";
import { labelFor, TOPICS } from "@/lib/taxonomy";
import { useSession } from "@/state/session";
import { HorizontalBars, MonthBars } from "./Charts";
import { InterestMap } from "./InterestMap";
import { Library } from "./Library";
import { Methods } from "./Methods";
import { Wordmark } from "./Brand";

const NAV = [
  ["dashboard", "Overview"],
  ["topics", "Topics"],
  ["creators", "Creators"],
  ["map", "Interest map"],
  ["library", "Library"],
  ["methods", "Methods"],
] as const;

export function Dashboard() {
  const session = useSession();
  const { analytics, results, preview, planId, view, setView, askReset, markDownloaded, config, retryFailed } =
    session;
  if (!analytics || !preview || !planId) return null;
  const plan = getPlan(planId);
  const testy = results.some((r) => r.testMode) || config?.testMode;
  const failed = results.filter((r) => r.status === "failed").length;
  const cancelled = results.filter((r) => r.status === "cancelled").length;

  const onReport = () => {
    const html = buildReportHtml({
      generatedAt: new Date().toISOString(),
      planId,
      preview,
      reels: results,
      config: {
        mode: config?.mode ?? "byok",
        testMode: Boolean(testy),
        jevModel: config?.jevModel ?? "jev-1.13.0",
        needsReviewThreshold: config?.needsReviewThreshold ?? 0.45,
      },
      modelVersionObserved: results.find((r) => r.modelVersion)?.modelVersion ?? null,
    });
    downloadReport(html);
    markDownloaded();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-cream/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Wordmark compact />
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="rounded-full bg-forest px-4 py-2 text-paper" onClick={onReport}>
              Download report
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-4 py-2"
              onClick={() => downloadTextFile("save-no-jutsu-results.csv", reelsToCsv(results), "text/csv;charset=utf-8")}
            >
              Export CSV
            </button>
            <button type="button" className="rounded-full border border-line px-4 py-2" onClick={askReset}>
              Start over
            </button>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-6xl text-sm text-muted">
          {preview.fileName} · {analytics.coverage.analyzed} analyzed · {formatDateRange(analytics.dateRange)} ·{" "}
          {plan.name}
        </p>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-6">
        {testy ? (
          <div className="mb-4 rounded-xl border border-chakra/40 bg-[#f7e3d0] px-4 py-3 text-sm">
            <strong>TEST MODE labels present.</strong> They are not Jev production results.
          </div>
        ) : null}
        {failed + cancelled > 0 ? (
          <div className="mb-4 rounded-xl border border-line bg-cream px-4 py-3 text-sm">
            Partial run: {failed} failed, {cancelled} cancelled.{" "}
            <button type="button" className="underline" onClick={() => void retryFailed()}>
              Retry failed items
            </button>
          </div>
        ) : null}
        <nav className="mb-6 flex flex-wrap gap-2">
          {NAV.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-full px-4 py-2 text-sm ${view === id ? "bg-forest text-paper" : "border border-line"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {view === "dashboard" ? (
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Reels analyzed", analytics.coverage.analyzed],
                [
                  "Caption/hashtag coverage",
                  `${pct(analytics.coverage.withCaption, analytics.coverage.analyzed)}`,
                ],
                ["Detected topics", analytics.topicCounts.filter((t) => t.id !== "unknown").length],
                [
                  "Most common topic",
                  analytics.mostCommonTopic ? labelFor(TOPICS, analytics.mostCommonTopic.id) : "—",
                ],
              ].map(([k, v]) => (
                <div key={String(k)} className="scroll-card rounded-2xl p-4">
                  <p className="text-sm text-muted">{k}</p>
                  <p className="font-serif text-2xl text-forest">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-lg">{analytics.headlineFact}</p>
            <section>
              <h2 className="text-2xl text-forest">Topic distribution</h2>
              <div className="mt-4">
                <HorizontalBars items={analytics.topicCounts} />
              </div>
            </section>
            <section>
              <h2 className="text-2xl text-forest">Save activity by month</h2>
              <p className="text-sm text-muted">
                Only Reels with a known save timestamp. Coverage {pct(analytics.coverage.dated, analytics.coverage.analyzed)}.
              </p>
              <div className="mt-4">
                <MonthBars months={analytics.monthly} />
              </div>
            </section>
            <section>
              <h2 className="text-2xl text-forest">Top creators</h2>
              {analytics.creatorCounts.length ? (
                <ol className="mt-3 list-decimal pl-5">
                  {analytics.creatorCounts.slice(0, 12).map((c) => (
                    <li key={c.creator}>
                      {c.creator} · {c.count}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No creator fields in this export.</p>
              )}
            </section>
            <section className="scroll-card rounded-2xl p-5">
              <h2 className="text-xl text-forest">Coverage</h2>
              <p className="mt-2 text-sm">
                Classified {analytics.coverage.classified} · insufficient text {analytics.coverage.insufficientText} ·
                unknown topic {analytics.coverage.unknownTopic} · failed {analytics.coverage.failed}
              </p>
              <button type="button" className="mt-3 text-sm text-forest underline" onClick={() => setView("map")}>
                Open the interest map
              </button>
            </section>
          </div>
        ) : null}

        {view === "topics" ? (
          <div>
            <h2 className="text-3xl text-forest">Topics</h2>
            <p className="mt-2 text-sm text-muted">Counts are among classified saves only.</p>
            <div className="mt-6">
              <HorizontalBars items={analytics.topicCounts} />
            </div>
          </div>
        ) : null}

        {view === "creators" ? (
          <div>
            <h2 className="text-3xl text-forest">Creators</h2>
            <ol className="mt-6 space-y-2">
              {analytics.creatorCounts.map((c) => (
                <li key={c.creator} className="flex justify-between border-b border-line py-2">
                  <span>{c.creator}</span>
                  <span className="text-muted">{c.count}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {view === "map" ? (
          <div>
            <h2 className="text-3xl text-forest">Interest map</h2>
            <p className="mt-2 text-sm text-muted">
              Connections among topics, creators, and content types in classified saves.
            </p>
            <div className="mt-6">
              <InterestMap />
            </div>
          </div>
        ) : null}

        {view === "library" ? (
          <div>
            <h2 className="mb-4 text-3xl text-forest">Reel library</h2>
            <Library />
          </div>
        ) : null}

        {view === "methods" ? (
          <div>
            <h2 className="mb-4 text-3xl text-forest">Methods</h2>
            <Methods />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ResetDialog() {
  const { resetOpen, cancelReset, confirmReset, downloaded } = useSession();
  if (!resetOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-w-md rounded-3xl bg-paper p-6">
        <h2 className="text-2xl text-forest">Start over?</h2>
        <p className="mt-3 text-sm">
          The upload, labels, and report live only in this tab.{" "}
          {downloaded
            ? "You already downloaded a report during this session."
            : "If you have not downloaded the report, you will need to run the analysis again."}
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" className="rounded-full bg-forest px-4 py-2 text-paper" onClick={confirmReset}>
            Clear this session
          </button>
          <button type="button" className="rounded-full border border-line px-4 py-2" onClick={cancelReset}>
            Keep working
          </button>
        </div>
      </div>
    </div>
  );
}
