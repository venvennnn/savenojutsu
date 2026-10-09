"use client";

import { PLANS, getPlan, tierCounts } from "@/lib/plans";
import { useSession } from "@/state/session";
import type { PlanId } from "@/lib/types";
import { useState } from "react";

export function Tiers() {
  const { preview, config, choosePlan, reels } = useSession();
  const [selected, setSelected] = useState<PlanId>("free");
  if (!preview) return null;
  const plan = getPlan(selected);
  const counts = tierCounts(reels.length, plan);
  const byok = config?.mode === "byok";

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm uppercase tracking-[0.18em] text-forest/70">Analysis size</p>
      <h1 className="mt-2 text-4xl text-forest">Choose how many Reels to read</h1>
      <p className="mt-3 max-w-2xl text-muted">
        One-time analysis purchase. No subscription. No account required. Every tier can download
        the report — this site does not keep it.
      </p>
      {byok ? (
        <p className="mt-3 rounded-xl border border-leaf/40 bg-[#e7f3da] px-4 py-3 text-sm">
          BYOK mode: Stripe is disabled. Caps still apply so you can control Jev usage on your own
          key. Nothing is billed by this app.
        </p>
      ) : null}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const c = tierCounts(reels.length, p);
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`scroll-card rounded-3xl p-6 text-left ${active ? "ring-2 ring-forest" : ""}`}
            >
              <p className="text-sm text-muted">{p.name}</p>
              <p className="font-serif text-3xl text-forest">
                {byok ? "Local" : p.priceUsd === 0 ? "$0" : `$${p.priceUsd}`}
              </p>
              <p className="mt-2 text-sm">{p.blurb}</p>
              <p className="mt-4 text-sm text-muted">
                {c.included.toLocaleString()} of {c.uniqueTotal.toLocaleString()} unique Reels
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-8 scroll-card rounded-2xl p-5 text-sm">
        <p>
          Unique Reels found: <strong>{counts.uniqueTotal.toLocaleString()}</strong>
        </p>
        <p>
          Included in {plan.name}: <strong>{counts.included.toLocaleString()}</strong> (newest first
          after dedupe)
        </p>
        <p>
          Outside this cap: <strong>{counts.excluded.toLocaleString()}</strong>
        </p>
        <p>
          Without enough text to classify: <strong>{preview.withoutText.toLocaleString()}</strong>{" "}
          in the full unique set
        </p>
        {!byok && plan.priceUsd > 0 ? (
          <p className="mt-3">
            You will be charged a one-time <strong>${plan.priceUsd}</strong> for{" "}
            {counts.included.toLocaleString()} Reels. The browser does not set the price.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => choosePlan(selected)}
        className="mt-8 rounded-full bg-forest px-6 py-3 text-paper"
      >
        Continue
      </button>
    </div>
  );
}
