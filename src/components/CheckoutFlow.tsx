"use client";

import { getPlan } from "@/lib/plans";
import { useSession } from "@/state/session";

export function CheckoutFlow() {
  const {
    checkout,
    planId,
    confirmTestCheckout,
    cancelCheckout,
    startCheckout,
    verifyCheckout,
  } = useSession();
  const plan = planId ? getPlan(planId) : null;
  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-4xl text-forest">Checkout</h1>
      <p className="mt-3 text-muted">
        Your export stays in this tab’s memory during payment. Complete Stripe in the new tab, then
        this tab verifies the session with Stripe’s API — a success URL alone is not trusted.
      </p>
      {plan ? (
        <p className="mt-4 text-sm">
          {plan.name} · one-time ${plan.priceUsd} · latest {plan.cap.toLocaleString()} Reels
        </p>
      ) : null}
      {checkout.status === "starting" ? <p className="mt-6">Starting checkout…</p> : null}
      {checkout.status === "waiting" ? (
        <div className="mt-6 scroll-card rounded-2xl p-5">
          <p>{checkout.message}</p>
          {checkout.url ? (
            <a className="mt-3 inline-block text-forest underline" href={checkout.url} target="_blank" rel="noreferrer">
              Reopen Stripe Checkout
            </a>
          ) : null}
          {checkout.sessionId ? (
            <button
              type="button"
              className="mt-4 block rounded-full bg-forest px-4 py-2 text-sm text-paper"
              onClick={() => void verifyCheckout(checkout.sessionId!)}
            >
              I’ve paid — verify
            </button>
          ) : null}
        </div>
      ) : null}
      {checkout.status === "verifying" ? <p className="mt-6">Verifying payment with Stripe…</p> : null}
      {checkout.status === "test" ? (
        <div className="mt-6 rounded-2xl border border-chakra/50 bg-[#f7e3d0] p-5">
          <p className="font-medium">TEST MODE — Stripe is not configured</p>
          <p className="mt-2 text-sm">{checkout.message}</p>
          <p className="mt-2 text-sm">
            Set <code>STRIPE_SECRET_KEY</code> for real Checkout. Simulated payment is for local
            development only and is labeled throughout the report.
          </p>
          <button
            type="button"
            onClick={confirmTestCheckout}
            className="mt-4 rounded-full bg-chakra px-5 py-2 text-sm text-paper"
          >
            Simulate paid analysis
          </button>
        </div>
      ) : null}
      {checkout.status === "canceled" ? (
        <div className="mt-6 scroll-card rounded-2xl p-5">
          <p>Checkout was canceled. Your file is still here.</p>
          <button type="button" className="mt-3 text-forest underline" onClick={() => void startCheckout()}>
            Try checkout again
          </button>
        </div>
      ) : null}
      {checkout.status === "failed" ? (
        <div className="mt-6 rounded-2xl border border-chakra/50 bg-[#f7e3d0] p-5">
          <p className="font-medium">Verification failed</p>
          <p className="text-sm">{checkout.message}</p>
          <button type="button" className="mt-3 text-forest underline" onClick={() => void startCheckout()}>
            Retry checkout
          </button>
        </div>
      ) : null}
      <button type="button" onClick={cancelCheckout} className="mt-8 text-sm underline">
        Back to plans
      </button>
    </div>
  );
}
