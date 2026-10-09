import { LeafMark } from "@/components/Brand";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="flex items-center gap-2 text-forest">
        <LeafMark className="h-8 w-8" />
        Save no Jutsu
      </Link>
      <h1 className="mt-8 text-4xl text-forest">Privacy</h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          Save no Jutsu analyzes a user-selected Instagram <code>saved_posts.json</code> export in
          the browser. It does not ask for Instagram credentials, does not connect to Instagram, and
          does not download Reel media.
        </p>
        <p>
          The JSON file, parsed records, labels, and generated reports stay in JavaScript memory in
          your tab. They are not written to a database, object storage, localStorage, IndexedDB, or
          server logs. Closing the tab or resetting the session clears them. You are responsible for
          keeping any downloaded report.
        </p>
        <p>
          After you consent, caption and hashtag text only are sent to a same-origin proxy, which
          forwards that text to TypeSafe (Jev) for classification. URLs, creators, timestamps,
          collection names, and the original file are not sent. See{" "}
          <a className="underline" href="https://www.typesafe.ai/privacy">
            TypeSafe’s privacy information
          </a>
          .
        </p>
        <p>
          Hosted paid tiers use Stripe Checkout. Stripe processes payment details and keeps its own
          transaction records. That is outside this app’s no-content-storage promise. The app may
          keep short-lived entitlement metadata (plan id, hashed session token, request counters,
          expiry — never file contents) for up to two hours, in memory or optional KV, to verify a
          paid analysis and limit abuse.
        </p>
        <p>
          Hosted free-tier protection hashes the network address for rate limits, caps request size,
          and can use Cloudflare Turnstile when configured. Those checks do not store uploaded
          content.
        </p>
        <p>
          Classification endpoints send <code>Cache-Control: no-store</code>. Jev results are not
          cached across users or browser sessions.
        </p>
      </div>
    </main>
  );
}
