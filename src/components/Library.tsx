"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/analytics";
import { INSUFFICIENT_TEXT_LABEL, labelFor, TOPICS, CONTENT_TYPES } from "@/lib/taxonomy";
import { safeExternalUrl } from "@/lib/sanitize";
import { useSession } from "@/state/session";
import type { ClassificationStatus } from "@/lib/types";

export function Library() {
  const { results, selectReel, selectedId, mapFilter, setMapFilter } = useSession();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [creator, setCreator] = useState("");
  const [collection, setCollection] = useState("");
  const [status, setStatus] = useState<"" | ClassificationStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const creators = useMemo(
    () => [...new Set(results.map((r) => r.creator).filter((v): v is string => Boolean(v)))].sort(),
    [results],
  );
  const collections = useMemo(
    () => [...new Set(results.map((r) => r.collection).filter((v): v is string => Boolean(v)))].sort(),
    [results],
  );

  const filtered = results.filter((r) => {
    if (mapFilter?.kind === "topic" && r.labels?.topic.label !== mapFilter.value) return false;
    if (mapFilter?.kind === "creator" && r.creator !== mapFilter.value) return false;
    if (mapFilter?.kind === "contentType" && r.labels?.contentType.label !== mapFilter.value) return false;
    if (q) {
      const hay = `${r.caption ?? ""} ${r.creator ?? ""} ${r.hashtags.join(" ")}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (topic && r.labels?.topic.label !== topic) return false;
    if (creator && r.creator !== creator) return false;
    if (collection && r.collection !== collection) return false;
    if (status && r.status !== status) return false;
    if (from && (r.savedAt == null || r.savedAt < Date.parse(from))) return false;
    if (to && (r.savedAt == null || r.savedAt > Date.parse(to) + 86400000)) return false;
    return true;
  });

  const selected = results.find((r) => r.id === selectedId) ?? null;

  return (
    <div>
      {mapFilter ? (
        <p className="mb-3 text-sm">
          Map filter: {mapFilter.kind} = {mapFilter.value}{" "}
          <button type="button" className="underline" onClick={() => setMapFilter(null)}>
            Clear
          </button>
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-line bg-cream px-3 py-2 text-sm"
          placeholder="Search caption text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search caption text"
        />
        <select className="rounded-lg border border-line bg-cream px-2 py-2 text-sm" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">All topics</option>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-line bg-cream px-2 py-2 text-sm" value={creator} onChange={(e) => setCreator(e.target.value)}>
          <option value="">All creators</option>
          {creators.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="rounded-lg border border-line bg-cream px-2 py-2 text-sm" value={collection} onChange={(e) => setCollection(e.target.value)}>
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-line bg-cream px-2 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="">All statuses</option>
          <option value="classified">Classified</option>
          <option value="insufficient_text">Not enough text</option>
          <option value="failed">Failed</option>
        </select>
        <input type="date" className="rounded-lg border border-line bg-cream px-2 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="rounded-lg border border-line bg-cream px-2 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      <p className="mb-2 text-sm text-muted">{filtered.length} shown</p>
      <div className="space-y-2">
        {filtered.map((r) => {
          const href = safeExternalUrl(r.url);
          return (
            <article key={r.id} className="scroll-card rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.creator ?? "Unknown creator"}</p>
                  <p className="text-xs text-muted">{formatDate(r.savedAt)}</p>
                </div>
                <div className="flex gap-2">
                  {href ? (
                    <a className="rounded-full border border-line px-3 py-1 text-xs" href={href} target="_blank" rel="noopener noreferrer">
                      Open on Instagram
                    </a>
                  ) : null}
                  <button type="button" className="rounded-full bg-forest px-3 py-1 text-xs text-paper" onClick={() => selectReel(r.id)}>
                    Details
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm">{r.caption ? r.caption.slice(0, 220) : INSUFFICIENT_TEXT_LABEL}</p>
              <p className="mt-2 text-xs text-muted">
                {r.labels ? `${labelFor(TOPICS, r.labels.topic.label)} · ${labelFor(CONTENT_TYPES, r.labels.contentType.label)}` : r.status}{" "}
                {r.labels ? `· model confidence ${r.labels.topic.confidence.toFixed(2)}` : ""} {r.needsReview ? "· needs review (product setting)" : ""}
              </p>
            </article>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal>
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-paper p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl text-forest">Reel detail</h2>
              <button type="button" onClick={() => selectReel(null)} className="text-sm underline">
                Close
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-muted">Creator</dt><dd>{selected.creator ?? "—"}</dd></div>
              <div><dt className="text-muted">Saved</dt><dd>{formatDate(selected.savedAt)}</dd></div>
              <div><dt className="text-muted">Collection</dt><dd>{selected.collection ?? "—"}</dd></div>
              <div><dt className="text-muted">URL</dt><dd className="break-all">{selected.url}</dd></div>
              <div><dt className="text-muted">Caption (from export)</dt><dd className="whitespace-pre-wrap">{selected.caption ?? "—"}</dd></div>
              <div><dt className="text-muted">Hashtags</dt><dd>{selected.hashtags.join(" ") || "—"}</dd></div>
              <div><dt className="text-muted">Text sent to classifier</dt><dd className="whitespace-pre-wrap">{selected.textSent ? `${selected.textSent.caption}\n${selected.textSent.hashtags.join(" ")}` : "None — not classified"}</dd></div>
              <div><dt className="text-muted">JSON fields used</dt><dd>{selected.sourceFields.join(", ")}</dd></div>
              {selected.labels ? (
                <>
                  <div><dt className="text-muted">Topic</dt><dd>{labelFor(TOPICS, selected.labels.topic.label)} (confidence {selected.labels.topic.confidence.toFixed(2)})</dd></div>
                  <div><dt className="text-muted">Content type</dt><dd>{labelFor(CONTENT_TYPES, selected.labels.contentType.label)}</dd></div>
                  <div><dt className="text-muted">Apparent use</dt><dd>{selected.labels.apparentUse.label}</dd></div>
                  <div><dt className="text-muted">Promotional probability</dt><dd>{selected.labels.promotional.probability.toFixed(2)} ({selected.labels.promotional.label})</dd></div>
                  <div><dt className="text-muted">Caption hook / CTA</dt><dd>{selected.labels.captionHook.label} / {selected.labels.captionCta.label}</dd></div>
                  <div><dt className="text-muted">Model</dt><dd>{selected.modelVersion}{selected.testMode ? " · TEST MODE" : ""}</dd></div>
                </>
              ) : (
                <div><dt className="text-muted">Status</dt><dd>{selected.errorMessage ?? selected.status}</dd></div>
              )}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
