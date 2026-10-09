"use client";

import { formatDateRange, pct } from "@/lib/analytics";
import { getPlan } from "@/lib/plans";
import { useSession } from "@/state/session";

export function Preview() {
  const { preview, continueToTiers, config, error } = useSession();
  if (!preview) return null;
  const defaultPlan = getPlan("free");
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm uppercase tracking-[0.18em] text-forest/70">Import preview</p>
      <h1 className="mt-2 text-4xl text-forest">Reels found in this export</h1>
      <p className="mt-3 text-muted">
        Findings will describe only these saved items, using caption and hashtag text when it
        exists. Photo posts were ignored. Dates of publication are not inferred.
      </p>
      {error ? (
        <p className="mt-4 rounded-xl border border-chakra/40 bg-[#f7e3d0] px-4 py-3 text-sm">{error}</p>
      ) : null}
      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Reels found", preview.reelsFound],
          ["Duplicates removed", preview.duplicatesRemoved],
          ["With text", preview.withText],
          ["Not enough text", preview.withoutText],
          ["Save dates known", `${preview.datedCount} (${pct(preview.datedCount, preview.reelsFound)})`],
          ["Unknown dates", preview.unknownDateCount],
        ].map(([k, v]) => (
          <div key={String(k)} className="scroll-card rounded-2xl p-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="font-serif text-2xl text-forest">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-sm text-muted">
        Format: {preview.formatLabel}. Date range: {formatDateRange(preview.dateRange)}. Fields
        observed: {preview.fieldsObserved.join(", ") || "url only"}.
      </p>
      {preview.truncated ? (
        <p className="mt-2 text-sm">
          This export had {preview.truncatedFrom} unique Reels; the newest{" "}
          {preview.reelsFound} were kept in memory.
        </p>
      ) : null}
      <p className="mt-4 text-sm">
        At the Free tier ({defaultPlan.cap}), {Math.min(preview.reelsFound, defaultPlan.cap)} Reels
        would be analyzed
        {config?.mode === "byok" ? " using your local Jev key" : ""}.
      </p>
      <button
        type="button"
        onClick={continueToTiers}
        className="mt-8 rounded-full bg-forest px-5 py-3 text-paper"
      >
        Continue to analysis size
      </button>
    </div>
  );
}
