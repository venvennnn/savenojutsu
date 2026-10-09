"use client";

import { getPlan, tierCounts } from "@/lib/plans";
import { useSession } from "@/state/session";
import { TurnstileWidget } from "./Turnstile";

export function Consent() {
  const { planId, reels, preview, giveConsent, declineConsent, config, setTurnstileToken, turnstileToken } =
    useSession();
  if (!planId || !preview) return null;
  const plan = getPlan(planId);
  const counts = tierCounts(reels.length, plan);
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-4xl text-forest">Before classification</h1>
      <p className="mt-4 text-muted">
        Save no Jutsu will send only caption and hashtag text to TypeSafe (Jev) to produce labels.
        Reel URLs, creator handles, timestamps, collection names, and the JSON file stay in this
        browser. This app does not retain that text after you leave, but TypeSafe receives it to
        classify it.
      </p>
      <p className="mt-3 text-sm">
        TypeSafe privacy information:{" "}
        <a
          className="underline"
          href="https://www.typesafe.ai/privacy"
          target="_blank"
          rel="noreferrer"
        >
          typesafe.ai/privacy
        </a>
      </p>
      <div className="mt-6 scroll-card rounded-2xl p-5 text-sm">
        <p>
          {plan.name} · {counts.included.toLocaleString()} Reels ·{" "}
          {config?.mode === "byok" ? "your Jev key" : plan.priceUsd === 0 ? "$0" : `$${plan.priceUsd} one-time`}
        </p>
        <p className="mt-2 text-muted">
          Payments, if any, are processed by Stripe. Stripe’s transaction records are outside this
          app’s no-content-storage promise.
        </p>
      </div>
      {config?.turnstileSiteKey ? (
        <TurnstileWidget siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void giveConsent()}
          disabled={Boolean(config?.turnstileSiteKey) && !turnstileToken}
          className="rounded-full bg-forest px-6 py-3 text-paper disabled:opacity-50"
        >
          I consent — classify available text
        </button>
        <button
          type="button"
          onClick={declineConsent}
          className="rounded-full border border-line px-6 py-3"
        >
          Do not send text
        </button>
      </div>
    </div>
  );
}
