"use client";

import { useSession } from "@/state/session";

const STAGE_LABEL: Record<string, string> = {
  reading: "Reading export",
  finding: "Finding saved Reels",
  classifying: "Classifying available text",
  building: "Building report",
};

export function Processing() {
  const { progress, cancelProcessing, retryFailed, results, stage } = useSession();
  const p = progress;
  const failed = results.filter((r) => r.status === "failed").length;
  const cancelled = results.filter((r) => r.status === "cancelled").length;
  const done = stage === "results";
  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <div className="mx-auto chakra-ring" />
      <div className="mx-auto mt-6 scroll-unroll w-56 rounded-full" />
      <h1 className="mt-8 text-3xl text-forest">
        {STAGE_LABEL[p?.stage ?? "classifying"] ?? "Working"}
      </h1>
      <p className="mt-3 text-lg">
        {p ? `Classifying captions · ${p.completed} of ${p.total}` : "Preparing…"}
      </p>
      <p className="mt-2 text-sm text-muted">
        {p?.percent ?? 0}% · {p?.insufficient ?? 0} without usable text · {p?.failed ?? 0} failed
      </p>
      <div className="mx-auto mt-6 h-2 max-w-sm overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-leaf"
          style={{ width: `${p?.percent ?? 0}%` }}
        />
      </div>
      <div className="mt-8 flex justify-center gap-3">
        {!done ? (
          <button type="button" onClick={cancelProcessing} className="rounded-full border border-line px-4 py-2 text-sm">
            Cancel
          </button>
        ) : null}
        {(failed > 0 || cancelled > 0) && done ? (
          <button
            type="button"
            onClick={() => void retryFailed()}
            className="rounded-full bg-forest px-4 py-2 text-sm text-paper"
          >
            Retry failed items
          </button>
        ) : null}
      </div>
    </div>
  );
}
