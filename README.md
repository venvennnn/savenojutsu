# Save no Jutsu

**The hidden art of understanding what you save.**

Save no Jutsu turns an Instagram **saved-posts JSON export** into an explorable library of topics, creators, formats, and save patterns. It never asks for Instagram credentials, never downloads Reels, and never stores your file, captions, labels, or report.

Findings describe the saved items in the uploaded export, based on available caption and hashtag text. Items without usable text are labeled **“Not enough text to classify.”** The app does not guess topics from URLs, creators, or dates, and it does not know views, watch time, or why something was saved.

## Modes

One parser, Jev schema, analytics layer, UI, and report generator.

| Mode | `APP_MODE` | Jev key | Billing |
| --- | --- | --- | --- |
| Hosted (Vercel) | `hosted` | Site `TYPESAFE_API_KEY` | Stripe Checkout |
| BYOK / open-source | `byok` | Operator `.env.local` key | Stripe disabled |

Hosted mode never asks users to paste a Jev key. BYOK never includes a real key in the repo, examples, or the frontend bundle.

## Pricing (hosted, one-time per analysis)

No accounts, subscriptions, or stored report history. Every tier can download the report because the site does not keep it.

- **Free — $0:** latest **200** unique saved Reels
- **Standard — $5:** latest **2,000** unique saved Reels
- **Deep analysis — $8:** latest **4,000** unique saved Reels

Deduplicate first, then apply the cap (newest save timestamp first). Amounts are mapped from plan IDs on the server; the browser cannot set the charge.

## Privacy

- Parse JSON in the browser. The original file is never uploaded.
- No database, object storage, persistent cache, localStorage, IndexedDB, session replay, or analytics that capture user content.
- After consent, only caption + hashtag text is POSTed to `/api/classify`, which proxies TypeSafe. URLs, handles, timestamps, collections, and the JSON file are not sent.
- Jev credentials stay in server env vars. Upstream error bodies and secrets are not returned to the browser.
- Stripe processes payments; its records are outside the no-content-storage promise.
- Optional ephemeral metadata (hashed IP, plan id, counters, expiry — **never** file contents) may live in memory or Vercel KV for **2 hours** to verify paid sessions and rate-limit abuse.
- `Cache-Control: no-store` on classify, checkout, and verify routes. Jev results are not cached across users or browser sessions.

TypeSafe privacy: [https://www.typesafe.ai/privacy](https://www.typesafe.ai/privacy)

## Local BYOK setup

```bash
git clone https://github.com/venvennnn/savenojutsu.git
cd savenojutsu
cp .env.example .env.local
```

Edit `.env.local`:

```
APP_MODE=byok
TYPESAFE_API_KEY=your_typesafe_key
JEV_MODEL=jev-1.13.0
TEST_MODE=false
```

Keep `.env.local` out of Git (already gitignored). The local app talks to TypeSafe from your machine; it does not send your key to any third-party proxy other than TypeSafe.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Try a sample export** or your `saved_posts.json`.

If you do not have a TypeSafe key yet, set `TEST_MODE=true`. The UI and report are labeled **TEST MODE** and use a local heuristic. That is not production Jev.

## Hosted deployment (Vercel)

1. Import this repo in Vercel.
2. Set environment variables (Production):
   - `APP_MODE=hosted`
   - `TYPESAFE_API_KEY` (server only)
   - `JEV_MODEL=jev-1.13.0`
   - `STRIPE_SECRET_KEY`
   - `ENTITLEMENT_SECRET` (random string)
   - `NEXT_PUBLIC_APP_URL` (your `https://…` domain)
   - `TEST_MODE=false`
3. Optional: `KV_REST_API_URL` + `KV_REST_API_TOKEN` for multi-instance entitlement/rate-limit metadata.
4. Optional abuse protection: Cloudflare Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).
5. Optional Stripe Price IDs: `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_DEEP`. If unset, Checkout uses server `price_data` at $5 / $8.

Without Stripe or TypeSafe secrets, do **not** silently pretend the product is live. Either configure them or set `TEST_MODE=true` for a labeled stand-in.

### Stripe test setup

1. Use `sk_test_…` in `STRIPE_SECRET_KEY`.
2. Complete Checkout with Stripe test cards.
3. Success opens `/checkout/complete` in the payment tab; the original tab keeps the file in memory and verifies the session via `POST /api/checkout/verify` (Stripe API retrieve — not a client flag).
4. `STRIPE_WEBHOOK_SECRET` is optional; verification does not depend on webhooks.

## Architecture

- `src/lib/parser.ts` — Instagram JSON import (string_list_data, label_values, flat records)
- `src/lib/taxonomy.ts` — editable topic / type / use / hook / CTA definitions
- `src/lib/jev-schema.ts` — bundled Jev questions + response validation
- `src/lib/analytics.ts` — counts and charts from in-memory results
- `src/lib/report.ts` — standalone HTML report (inline CSS/JS, no CDN)
- `src/app/api/classify/route.ts` — Jev proxy
- `src/app/api/checkout/route.ts` — Checkout session or BYOK/free entitlement
- `src/app/api/checkout/verify/route.ts` — Stripe session verification

Default Jev model: **`jev-1.13.0`** (`POST https://api.typesafe.ai/v1/systemone`).

## Abuse protection (hosted free tier)

Does not store uploaded content. Metadata only:

- JSON body size cap on `/api/classify` (16 KB)
- Per-IP rate limits: classify 40/min, checkout 8/min, free grants 6/hour, verify 30/min
- Per-entitlement classify quota (~plan cap with retry headroom), TTL 2 hours
- Optional Cloudflare Turnstile

## Known limitations

- Only `/reel/`, `/reels/`, and `/tv/` links are treated as Reels. A `/p/` URL is never guessed to be a Reel, even if some Instagram exports use `/p/` for everything.
- No transcription, video, or audio analysis. Hooks/CTAs are caption text only.
- Model confidence is not measured accuracy. “Needs review” is a configurable product setting (`NEEDS_REVIEW_THRESHOLD`) until validated on labeled examples.
- In-memory rate limits reset on serverless cold starts unless KV is configured.
- Closing the tab loses the analysis unless the HTML/CSV report was downloaded.

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
