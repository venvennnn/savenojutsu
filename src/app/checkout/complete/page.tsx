"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CompleteInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const canceled = params.get("canceled");
  const payload = useMemo(
    () => ({
      type: "snj-checkout" as const,
      sessionId,
      canceled: canceled === "1",
    }),
    [sessionId, canceled],
  );

  useEffect(() => {
    try {
      const channel = new BroadcastChannel("snj-checkout");
      channel.postMessage(payload);
      channel.close();
    } catch {
      /* BroadcastChannel unavailable */
    }
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
    }
  }, [payload]);

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="text-3xl text-forest">
        {canceled ? "Checkout canceled" : "Return to your analysis tab"}
      </h1>
      <p className="mt-4 text-sm text-muted">
        {canceled
          ? "No payment was captured. The original tab still has your file in memory — go back there to try again."
          : "Payment completion was sent to the original tab so it can verify the Stripe session. If you closed that tab, upload again; this app does not store your JSON or report."}
      </p>
      <p className="mt-6 text-sm">You can close this window.</p>
    </main>
  );
}

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={<main className="p-8">Finishing checkout…</main>}>
      <CompleteInner />
    </Suspense>
  );
}
