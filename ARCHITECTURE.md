# IsThisValid.com — Architecture Guide

**Last updated: February 26, 2026**

## High-Level Flow

### Email Validation (`POST /api/validate`)

```
Browser  →  POST /api/validate { email }
  │
  ├─► Rate limit check (Upstash, 20 req/min per IP)
  │     └── 429 if exceeded
  │
  ├─► Zod validation (fail fast — max 254 chars)
  │
  ├─► validateEmailLocal() — free, <1 ms
  │     ├── RFC 5322 regex syntax check
  │     ├── TLD presence + length
  │     ├── Disposable-domain Set lookup (~57 000+ domains)
  │     └── Role-prefix Set lookup (110+ prefixes: admin@, noreply@, shop@, ceo@, …)
  │
  ├─► Early exit if syntax invalid
  │
  ├─► resolveMx() — DNS lookup, ~50 ms (free)
  │     ├── true  → domain has MX records → continue
  │     ├── false → no MX records → early exit (undeliverable)
  │     └── null  → DNS timeout → continue with local result
  │
  ├─► applyMxResult() — attaches hasMx to result, adjusts score
  │
  ├─► Redis SMTP cache lookup — sha256(email), 7-day TTL
  │     ├── HIT  → return cached result immediately (skip provider)
  │     └── MISS → continue
  │
  ├─► Early exit if no SMTP provider configured
  │     (requires ZEROBOUNCE_API_KEY or EMAILABLE_API_KEY)
  │
  └─► SMTP provider — ZeroBounce (preferred) or Emailable (fallback), ~500 ms
        ├── success → mergeSmtpResult() + write to Redis cache (fire-and-forget)
        ├── API error → graceful fallback to local+MX result
        └── JSON response → EmailValidationResult
              ├── valid: boolean
              ├── score: 0–100
              ├── checks: { syntax, validTld, notDisposable, notRole, hasMx, apiDeliverable }
              ├── message: human-readable verdict
              ├── source: "zerobounce" | "emailable" | "local"
              └── suggestion: typo correction (optional)
```

### URL Safety Check (`POST /api/validate-url`)

```
Browser  →  POST /api/validate-url { url }
  │
  ├─► Rate limit check (Upstash, 20 req/min per IP — shared with email)
  │     └── 429 if exceeded
  │
  ├─► Zod validation (fail fast — max 2 048 chars)
  │
  ├─► validateUrlLocal() — free, <1 ms
  │     ├── Parse URL (auto-prepend https:// for bare domains)
  │     ├── Scheme — must be http or https
  │     ├── IP address — raw IPv4/IPv6 in host flagged
  │     ├── User info — embedded credentials (@ trick) flagged
  │     ├── Shortener — 20 known services (bit.ly, tinyurl.com …)
  │     ├── Suspicious keywords — 6 phishing-path pattern combos
  │     ├── Punycode — xn-- homograph detection
  │     ├── TLD — must have a dot + ≥2-char suffix
  │     └── Brand squatting — 20 brands × word-boundary regex vs eTLD+1
  │
  ├─► Early exit if URL is unparseable
  │
  ├─► checkResolves() — HEAD request, 5 s timeout
  │     ├── true  → any HTTP response (server is alive)
  │     ├── false → NXDOMAIN / ENOTFOUND (domain doesn't exist)
  │     └── null  → timeout / SSL error (don't penalise)
  │
  ├─► applyHeadResult() — merges resolves into score
  │     ├── resolves=true  → +5 bonus (capped at 100)
  │     └── resolves=false → score capped at 70
  │
  ├─► Early exit if no GOOGLE_SAFE_BROWSING_API_KEY set
  │
  └─► Google Safe Browsing v4 Lookup API — POST threatMatches:find
        ├── success → applySafeBrowsingResult()
        │     ├── isFlagged=true  → score capped at 5, safe=false
        │     └── isFlagged=false → safeBrowsing=true, source="safe-browsing"
        └── API failure → graceful degradation
              ├── score hard-capped at 75
              ├── safeBrowsingError=true in response
              └── UI shows ⚠ yellow warning banner
```

### Text / SMS Scam Analysis (`POST /api/debunk/text`)

```
Browser  →  POST /api/debunk/text { message }
  │
  ├─► Rate limit check (Upstash, 20 req/min per IP)
  │     └── 429 if exceeded
  │
  ├─► Daily spend cap check (Upstash, 20 req/day per IP)
  │     └── 429 if exceeded
  │
  ├─► LLM availability check (ANTHROPIC_API_KEY configured?)
  │     └── 503 if not configured
  │
  ├─► Zod validation (10–5 000 chars)
  │
  ├─► Redis cache lookup (SHA-256 of normalised message, 24 h TTL)
  │     ├── HIT  → return cached result (X-Cache: HIT), skip Claude
  │     └── MISS → continue
  │
  ├─► callClaude() — Anthropic claude-sonnet-4-20250514, non-streaming
  │     ├── System prompt: scam detection expert + prompt injection rules
  │     └── User payload: [MSG]{message}[/MSG]  ← trust boundary delimiter
  │
  ├─► API error → 502
  ├─► null response → 503
  │
  ├─► Strip markdown code fences from response
  │
  ├─► Parse + Zod-validate Claude's JSON response
  │     └── Parse failure → 502
  │
  ├─► Derive safe = riskScore < 50
  │
  ├─► Write result to Redis cache (fire-and-forget)
  │
  └─► JSON response → TextDebunkResult (X-Cache: MISS)
        ├── classification: scam | smishing | spam | suspicious | legit
        ├── confidence: 0–100
        ├── riskScore: 0–100
        ├── safe: boolean
        ├── summary: one-sentence verdict
        ├── flags: string[]
        └── explanation: 2–3 sentence breakdown
```

## File Structure

```
src/
├── app/
│   ├── api/validate/route.ts        # POST handler, Zod validation, graceful API fallback
│   ├── about/page.tsx               # /about — site description, advertising disclosure
│   ├── privacy/page.tsx             # /privacy — GDPR/CCPA-compliant privacy policy
│   ├── terms/page.tsx               # /terms — terms of service
│   ├── check/
│   │   ├── email/
│   │   │   ├── layout.tsx           # Email tool metadata
│   │   │   └── page.tsx             # /check/email — full email validator (client)
│   │   ├── url/
│   │   │   ├── layout.tsx           # URL tool metadata
│   │   │   └── page.tsx             # /check/url — URL safety checker (beta stub)
│   │   ├── text/
│   │   │   ├── layout.tsx           # Text tool metadata
│   │   │   └── page.tsx             # /check/text — SMS/text scam debunker (production, Claude-powered)
│   │   └── image/
│   │       ├── layout.tsx           # Image tool metadata
│   │       └── page.tsx             # /check/image — image authenticity checker (beta stub)
│   ├── layout.tsx                   # Root layout: SEO metadata, Schema.org, AdSense script,
│   │                                #   SiteFooter + CookieConsent rendered globally
│   ├── page.tsx                     # Hub page — 2×2 tool picker (server component)
│   ├── globals.css                  # Tailwind v4, always-dark theme (zinc-950 bg, orange brand)
│   ├── robots.ts                    # /robots.txt via Next.js Metadata API
│   └── sitemap.ts                   # /sitemap.xml — all routes
├── components/
│   ├── AdSenseBanner.tsx            # AdSense <ins> placeholder
│   ├── AffiliateNudge.tsx           # Contextual affiliate link card (shown only on risky/unsafe results)
│   ├── CheckShell.tsx               # Shared top-nav (logo + back link) + hero wrapper for all /check/* pages
│   ├── CookieConsent.tsx            # GDPR cookie-consent banner (localStorage, no dep)
│   ├── EmailForm.tsx                # Controlled input + loading/submit state
│   ├── FAQ.tsx                      # Accordion FAQ section; imports data from lib/faq-data
│   ├── PolicyLayout.tsx             # Shared wrapper + PolicySection for legal pages
│   ├── ResultCard.tsx               # Score ring, check breakdown, cheeky message (email) + ZeroBounce affiliate nudge
│   ├── SiteFooter.tsx               # Persistent footer: About / Privacy / Terms nav links
│   ├── SiteLogo.tsx                 # Split-diamond SVG wordmark (size="md" hero / size="sm" nav)
│   ├── TextFAQ.tsx                  # FAQ accordion for the text/SMS tool
│   ├── TextResultCard.tsx           # Classification badge, risk score, flags, explanation (text) + NordVPN affiliate nudge
│   ├── UrlFAQ.tsx                   # FAQ accordion for the URL checker tool
│   └── UrlResultCard.tsx            # Score ring, check grid, flags list (URL) + NordVPN affiliate nudge
├── proxy.ts                         # CORS enforcement / middleware (Next.js 16 convention)
└── lib/
    ├── affiliate-links.ts           # Affiliate partner URLs — reads from NEXT_PUBLIC_* env vars
    ├── email-validator.ts           # Core logic: validateEmailLocal, applyMxResult, mergeSmtpResult, mergeEmailableResult (compat wrapper); 110+ role prefixes
    ├── smtp-cache.ts                # Redis SMTP result cache: getCachedSmtpResult / setCachedSmtpResult; sha256 key, 7-day TTL, local-only results excluded
    ├── smtp-provider.ts             # Pluggable SMTP provider abstraction: SmtpProvider interface, EmailableProvider, ZeroBounceProvider, getSmtpProvider() factory
    ├── faq-data.ts                  # FAQ Q&A for email tool — consumed by FAQ.tsx + FAQPage JSON-LD
    ├── url-validator.ts             # Core logic: validateUrlLocal, applyHeadResult, applySafeBrowsingResult
    ├── url-faq-data.ts              # FAQ Q&A for URL tool — consumed by UrlFAQ.tsx + FAQPage JSON-LD
    ├── text-debunker.ts             # Types + Zod schema for TextDebunkResult
    ├── text-faq-data.ts             # FAQ Q&A for text tool — consumed by TextFAQ.tsx + FAQPage JSON-LD
    ├── llm-client.ts                # Thin Anthropic SDK wrapper: callClaude(systemPrompt, userMsg)
    ├── disposable-domains.ts        # ~57 000+ disposable domains — disposable-email-domains (~3 500) merged with mailchecker (~55 860); combined Set
    └── rate-limit.ts                # Upstash Redis: checkRateLimit (20/min), checkDailyTextLimit (20/day); getRedis() shared client
__tests__/
├── debunk-text-route.test.ts        # Jest unit tests: POST /api/debunk/text route (35 tests)
├── email-validator.test.ts          # Jest unit tests: validateEmailLocal, applyMxResult, mergeSmtpResult, mergeEmailableResult, role prefixes, DISPOSABLE_DOMAINS (83 tests)
├── smtp-cache.test.ts               # Jest unit tests: getCachedSmtpResult, setCachedSmtpResult — Redis mocked (15 tests)
└── url-validator.test.ts            # Jest unit tests: validateUrlLocal, applyHeadResult, applySafeBrowsingResult (21 tests)
```

## Environment Variables

| Variable                               | Required | Description                                                                                                             |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                    | Yes      | Anthropic API key — powers the Text / SMS scam detector (Claude claude-sonnet-4-20250514)                               |
| `UPSTASH_REDIS_REST_URL`               | Yes      | Upstash Redis URL — rate limiting (20 req/min) + result cache (24 h TTL)                                                |
| `UPSTASH_REDIS_REST_TOKEN`             | Yes      | Upstash Redis token — required alongside the URL above                                                                  |
| `GOOGLE_SAFE_BROWSING_API_KEY`         | No       | Google Safe Browsing v5 key — enables malware/phishing lookup on URL tool                                               |
| `ZEROBOUNCE_API_KEY`                   | No       | ZeroBounce API key — preferred SMTP provider (100 free verifications/month recurring)                                   |
| `EMAILABLE_API_KEY`                    | No       | Emailable API key — fallback SMTP provider (250 one-time free, then paid); used only if `ZEROBOUNCE_API_KEY` is not set |
| `NEXT_PUBLIC_ADSENSE_ID`               | No       | Google AdSense publisher ID (`ca-pub-...`) — leave blank until approved                                                 |
| `NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL` | No       | ZeroBounce affiliate tracking URL — shown on email tool risky results                                                   |
| `NEXT_PUBLIC_NORDVPN_AFFILIATE_URL`    | No       | NordVPN affiliate tracking URL — shown on URL/text tool unsafe results                                                  |

## Affiliate Links

Contextual affiliate recommendations are shown to users after risky/unsafe results:

- **Email validator** → ZeroBounce (shown for risky/invalid results)
- **URL checker** → NordVPN (shown for suspicious/dangerous scores)
- **Text/SMS detector** → NordVPN (shown for unsafe results)

Affiliate links are always labelled with a visible "Affiliate" disclosure badge. No personal data is shared with affiliate partners. Tracking URLs are configured via environment variables:

- `NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL` — ZeroBounce tracking link
- `NEXT_PUBLIC_NORDVPN_AFFILIATE_URL` — NordVPN tracking link

Set these in `.env.local` (local dev) or Vercel environment variables (production) once affiliate accounts are approved.

## URL Validation Pipeline

```
POST /api/validate-url
  │
  ├─► Rate limit check (Upstash, shared with email route, no-op if unconfigured)
  │     └── 429 if exceeded
  │
  ├─► Zod schema validation (fail fast on bad input, max 2 048 chars)
  │
  ├─► validateUrlLocal() — free, <1 ms
  │     ├── Parse URL (auto-prepend https:// for bare domains)
  │     ├── Scheme — must be http or https
  │     ├── IP address — raw IPv4/IPv6 in host is flagged
  │     ├── User info — embedded credentials (@ trick) flagged
  │     ├── Shortener — 20 known services (bit.ly, tinyurl.com …)
  │     ├── Suspicious keywords — 6 phishing-path pattern combos
  │     ├── Punycode — xn-- homograph detection
  │     ├── TLD — must have a dot + ≥2-char suffix
  │     └── Brand squatting — 20 brands × word-boundary regex vs eTLD+1
  │
  ├─► Early exit if !parseable
  │
  ├─► checkResolves() — HEAD request, 5 s timeout
  │     ├── true  → any HTTP response (200, 4xx, 5xx — server alive)
  │     ├── false → NXDOMAIN / ENOTFOUND (domain doesn't exist)
  │     └── null  → timeout / SSL error (don't penalise)
  │
  ├─► applyHeadResult() — merges resolves into score
  │     ├── resolves=true  → +5 bonus (capped at 100)
  │     └── resolves=false → score capped at 70
  │
  ├─► Google Safe Browsing v5 Lookup API (optional, only if GOOGLE_SAFE_BROWSING_API_KEY set)
  │     └── GET urls:search — checks against malware, phishing, and unwanted software databases
  │     │
  │     ├── API success → applySafeBrowsingResult()
  │     │     ├── threats found → score capped at 5, safe=false
  │     │     └── no threats → safeBrowsing=true, source="safe-browsing"
  │     │
  │     └── API failure (timeout / error) → graceful degradation
  │           ├── score hard-capped at 75 (never "Safe" when check is incomplete)
  │           ├── safeBrowsingError=true added to result
  │           └── UrlResultCard shows a ⚠ yellow warning banner to the user
  │
  └─► applySafeBrowsingResult() — merges Safe Browsing into score
        ├── threats found → score capped at 5, safe=false
        └── no threats → safeBrowsing=true, source="safe-browsing"
```

### URL Scoring (0–100)

| Check                  | Points  |
| ---------------------- | ------- |
| Valid scheme           | +10     |
| Not IP address         | +15     |
| No user info           | +10     |
| Not shortener          | +10     |
| No suspicious keywords | +20     |
| Not punycode           | +10     |
| Valid TLD              | +10     |
| No brand squatting     | +15     |
| Resolves (HEAD bonus)  | +5      |
| **Total (max)**        | **100** |

> Score ≥ 80 → Safe (lime) · 50–79 → Suspicious (yellow) · < 50 → Dangerous (rose)
> Safe Browsing flagged → score hard-capped at 5.

## Email Validation Pipeline

```
POST /api/validate
  │
  ├─► Rate limit check (Upstash, no-op if unconfigured)
  │     └── 429 if exceeded
  │
  ├─► Zod schema validation (fail fast on bad input)
  │
  ├─► validateEmailLocal() — free, <1 ms
  │     ├── RFC 5322 regex syntax
  │     ├── TLD presence + length
  │     ├── Disposable-domain lookup (~57 000+ domains — mailchecker + disposable-email-domains)
  │     └── Role-prefix lookup (110+ prefixes)
  │
  ├─► Early exit if syntax fails (no DNS or API call)
  │
  ├─► resolveMx() — DNS lookup, ~50 ms, free
  │     ├── true  → domain has MX records
  │     ├── false → no MX records (early exit, skip provider)
  │     └── null  → DNS timeout / transient error (continue)
  │
  ├─► applyMxResult() — attaches hasMx to result, adjusts score
  │
  ├─► Redis SMTP cache lookup — sha256(email), 7-day TTL
  │     ├── HIT  → return cached result immediately (skip provider)
  │     └── MISS → continue
  │
  ├─► Early exit if hasMx = false OR no SMTP provider configured
  │
  └─► SMTP provider — ZeroBounce (preferred) or Emailable (fallback), ~500 ms
        ├── mergeSmtpResult() — merges API response with local+MX result
        ├── write result to Redis cache (fire-and-forget)
        └── Graceful fallback to local+MX result on API error
```

## Colour Scheme

The site uses an **always-dark** design (zinc-950 background) with a neon-orange brand
colour — deliberately distinct from Emailable's corporate blue/teal palette.

| Token role            | Tailwind class       | Hex        |
| --------------------- | -------------------- | ---------- |
| Brand / CTA button    | `bg-orange-500`      | `#f97316`  |
| Brand accent / links  | `text-orange-400`    | `#fb923c`  |
| Focus rings           | `ring-orange-500`    | `#f97316`  |
| Valid result          | `border-lime-500`    | `#84cc16`  |
| Risky result          | `border-yellow-500`  | `#eab308`  |
| Invalid result        | `border-rose-500`    | `#fb7185`  |
| Score ring — valid    | `#84cc16` (SVG fill) | lime-400   |
| Score ring — warn     | `#eab308` (SVG fill) | yellow-400 |
| Score ring — invalid  | `#fb7185` (SVG fill) | rose-400   |
| Body / secondary text | `text-zinc-400`      | `#a1a1aa`  |

> **WCAG AA note:** Secondary and body text uses `zinc-400` (#a1a1aa, ~6:1 contrast on zinc-950) rather than `zinc-500` (#71717a, ~4.1:1 which fails AA). This was audited and corrected Feb 26 2026 across `CheckShell.tsx`, `FAQ.tsx`, `UrlFAQ.tsx`, `TextResultCard.tsx`, `SiteFooter.tsx`, and `check/text/page.tsx`.

## Analytics

Vercel Analytics is enabled via `@vercel/analytics` package and the `<Analytics />` component in root layout. Tracking is automatic based on your Vercel account configuration.

## Running Locally

```bash
cp .env.example .env.local
# edit .env.local with your keys (optional for MVP)
npm run dev      # http://localhost:3000
npm test         # run unit tests
npm run build    # production build
```

## Deploying to Vercel

1. Push to GitHub
2. Import repo at vercel.com/new
3. Add env vars under **Settings → Environment Variables**
4. Deploy — Vercel auto-detects Next.js

## Google AdSense Approval Checklist

AdSense has hard requirements and soft recommendations. Track progress here.

### Hard requirements

- [x] **Privacy Policy page** — `/privacy` covers AdSense cookies, third-party data,
      GDPR/CCPA rights, and cookie table
- [x] **Cookie consent banner** — `CookieConsent` component stores preference in
      `localStorage` under key `itv_cookie_consent`; shown to all visitors until
      a choice is made
- [x] **Multiple navigable pages** — `/`, `/about`, `/privacy`, `/terms`
- [x] **Footer policy links on every page** — `SiteFooter` is rendered globally in
      `layout.tsx`; AdSense crawlers scan for these links
- [x] **Original content** — validation tool + About page written content
- [x] **HTTPS** — provided automatically by Vercel
- [x] **Mobile-responsive** — Tailwind responsive classes throughout
- [ ] **Active inbox at contact email** — update `privacy@isthisvalid.com` /
      `hello@isthisvalid.com` in the policy pages to a real monitored address
- [ ] **Domain email** — `hello@isthisvalid.com` preferred over a Gmail address
      in your AdSense account profile

### Soft recommendations (improve approval odds)

- [ ] **4–8 weeks live with real traffic** before applying — most common omission
- [ ] **Blog / written content** — a few articles dramatically improve approval rates
- [x] **`og-image.png`** — 1200×630 open-graph image updated to multi-tool branding
- [x] **Core Web Vitals** — Lighthouse run Feb 26 2026; Perf 85–88, A11y 90–96, SEO 100

### Cookie consent integration note

The `CookieConsent` component currently stores the user preference only. To fully
block AdSense cookies until consent, conditionally load the AdSense `<script>` in
`layout.tsx` based on the stored preference. A suggested approach:

```tsx
// In a client wrapper around layout body:
const consent = localStorage.getItem("itv_cookie_consent");
if (consent === "accepted") {
  // inject adsbygoogle script dynamically
}
```

This is optional for initial launch but required for strict GDPR compliance.

## Rate Limiting (Production)

All three API routes are protected by Upstash Redis rate limiting:

- **Per-IP sliding window** — 20 requests/min shared across `/api/validate` and `/api/validate-url`
- **Per-IP daily cap** — 20 requests/day on `/api/debunk/text` (LLM cost control)
- **Text result cache** — SHA-256 of the normalised message used as cache key; 24 h TTL on Upstash. Viral scam texts hit cache on the second request, skipping Claude entirely.
- **SMTP result cache** — SHA-256 of the lowercased email used as cache key; 7-day TTL on Upstash (`itv:smtp:<hash>`). Repeat checks of the same address skip ZeroBounce/Emailable entirely. Only SMTP-provider results are cached — local-only results are not stored. Implemented in `src/lib/smtp-cache.ts`.
- All limiters and caches are **no-ops when `UPSTASH_REDIS_REST_URL` is absent** (safe for local dev).

## Expansion Roadmap

See ROADMAP.md (local file, gitignored for privacy planning).

## Cost Monitoring

| Service                    | Free Tier                          | Cost at Scale        |
| -------------------------- | ---------------------------------- | -------------------- |
| Vercel Hosting             | 100 GB bandwidth/mo                | ~$20/mo Pro          |
| ZeroBounce                 | 100 checks/mo recurring (free)     | $0.008/check (paid)  |
| Emailable                  | 250 checks/mo one-time (fallback)  | $0.005/check (paid)  |
| Google Safe Browsing       | 10 k req/day                       | Free                 |
| Upstash Redis              | 10 k req/day                       | $0.20/100 k          |

**Estimated ZeroBounce cost at 10k unique validations/day (no caching)**: ~$80/day
**With Redis SMTP caching + role/disposable pre-filters (~75% reduction)**: ~$20/day at scale
**Without any SMTP provider (local only)**: Effectively free on Vercel hobby plan

## SEO Checklist

- [x] `<title>` and `<meta description>` via Next.js Metadata API
- [x] OpenGraph tags (Facebook, LinkedIn sharing)
- [x] Twitter Card
- [x] Schema.org `WebApplication` structured data
- [x] `FAQPage` JSON-LD structured data — enables Google FAQ rich snippets
- [x] `/sitemap.xml` auto-generated (includes all routes: hub, `/check/*`, legal pages)
- [x] `/robots.txt` auto-generated
- [x] Semantic HTML (`<main>`, `<section>`, `<h1>`, `aria-label`)
- [x] Mobile-responsive (Tailwind flex/grid, `sm:` breakpoints)
- [x] Privacy Policy, Terms, About pages (required for AdSense + trust signals)
- [x] Persistent footer policy links on every page via `SiteFooter`
- [x] Core Web Vitals — Lighthouse (mobile): Perf 85–88 / A11y 90–96 / Best Practices 92 / SEO 100
- [x] `og-image.png` (1200×630) — multi-tool branding

## UI Architecture

**Hub-and-spoke model**: `/` is a tool-picker; each tool lives at its own route (`/check/*`).
This gives every tool its own `<h1>`, `<title>`, `<meta description>`, and JSON-LD —
maximising SEO value and deep-linkability.

```
/  (hub — 2×2 card grid)
├── /check/email   ← full working tool
├── /check/url     ← full working tool
├── /check/text    ← full working tool (Claude-powered)
└── /check/image   ← coming soon placeholder
```

`CheckShell` is a shared server component providing the back-nav and tool hero
for all four `/check/*` pages. Each tool page supplies its own colour accent and copy.

## Route Map

| Route               | Type    | Purpose                                              |
| ------------------- | ------- | ---------------------------------------------------- |
| `/`                 | Static  | Hub — tool picker (2×2 card grid)                    |
| `/check/email`      | Static  | Full email validator                                 |
| `/check/url`        | Static  | URL safety checker                                   |
| `/check/text`       | Static  | SMS / text scam analyser (Claude-powered)            |
| `/check/image`      | Static  | Image authenticity checker (coming soon placeholder) |
| `/about`            | Static  | Site description, disclosure, contact                |
| `/privacy`          | Static  | GDPR/CCPA privacy policy (AdSense required)          |
| `/terms`            | Static  | Terms of service                                     |
| `/api/validate`     | Dynamic | POST — email validation                              |
| `/api/validate-url` | Dynamic | POST — URL safety check                              |
| `/api/debunk/text`  | Dynamic | POST — text/SMS scam analysis (Claude, cached)       |
| `/sitemap.xml`      | Static  | Auto-generated sitemap                               |
| `/robots.txt`       | Static  | Auto-generated robots file                           |
