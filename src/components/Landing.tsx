"use client";

import { useCallback, useState } from "react";
import { Wordmark } from "./Brand";
import { useSession } from "@/state/session";

export function Landing() {
  const { loadFile, loadSample, error, importErrorCode, config, stage } = useSession();
  const [drag, setDrag] = useState(false);
  const reading = stage === "reading";

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void loadFile(file);
    },
    [loadFile],
  );

  return (
    <div className="leaf-grid min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Wordmark />
        <a className="text-sm text-forest underline-offset-4 hover:underline" href="/privacy">
          Privacy
        </a>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20">
        {config?.testMode ? (
          <div className="mb-6 rounded-xl border border-chakra/40 bg-[#f7e3d0] px-4 py-3 text-sm">
            <strong>TEST MODE is on.</strong> This deployment may use a labeled local classifier
            and/or simulated checkout because TypeSafe or Stripe secrets are missing. It is not
            production classification.
          </div>
        ) : null}
        <p className="mb-3 text-sm uppercase tracking-[0.18em] text-forest/70">Mission archive</p>
        <h1 className="max-w-3xl text-4xl leading-tight text-forest sm:text-5xl">
          Your saved Reels have a story.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Upload your Instagram JSON export to map the topics, creators, and ideas that appear in
          the Reels you save.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`scroll-card mt-10 rounded-3xl p-8 text-center ${drag ? "ring-2 ring-leaf" : ""}`}
        >
          {reading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="chakra-ring" />
              <p className="font-medium">Reading export…</p>
              <div className="scroll-unroll w-48 rounded-full" />
            </div>
          ) : (
            <>
              <p className="font-serif text-2xl text-forest">Drop saved_posts.json here</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
                Select the saved-posts JSON from your Instagram download. Do not share an Instagram
                password. This app never logs into Instagram and never downloads Reels.
              </p>
              <label className="mt-6 inline-flex cursor-pointer rounded-full bg-forest px-5 py-3 text-sm font-medium text-paper">
                Choose JSON file
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </label>
              <button
                type="button"
                onClick={() => void loadSample()}
                className="ml-3 rounded-full border border-line px-5 py-3 text-sm text-forest"
              >
                Try a sample export
              </button>
            </>
          )}
          <p className="mx-auto mt-6 max-w-2xl text-sm text-muted">
            No Instagram login. No Reel downloads. Your JSON and report aren’t stored by this app.
            Caption text is sent to Jev only after you consent.
          </p>
        </div>
        {error ? (
          <div className="mt-6 rounded-2xl border border-chakra/50 bg-[#f7e3d0] px-4 py-3">
            <p className="font-medium text-forest">Could not import that file</p>
            <p className="text-sm">{error}</p>
            {importErrorCode ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{importErrorCode}</p>
            ) : null}
          </div>
        ) : null}
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["Discover topics", "See which themes show up across the Reels you actually saved."],
            ["Watch save patterns", "Plot how saving activity changes over time when dates exist."],
            ["Map connections", "Explore links between topics and creators in an interest map."],
          ].map(([title, body]) => (
            <div key={title} className="scroll-card rounded-2xl p-5">
              <h2 className="text-xl text-forest">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
