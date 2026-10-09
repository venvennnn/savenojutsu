"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string;
    };
  }
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  useEffect(() => {
    const render = () => {
      const el = document.getElementById("snj-turnstile");
      if (el && window.turnstile) {
        el.replaceChildren();
        window.turnstile.render(el, { sitekey: siteKey, callback: onToken });
      }
    };
    const existing = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
    if (existing) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [siteKey, onToken]);

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-muted">Hosted bot check (Cloudflare Turnstile). It does not receive your JSON file.</p>
      <div id="snj-turnstile" />
    </div>
  );
}
