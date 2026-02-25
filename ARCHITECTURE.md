# IsThisValid.com — Architecture Guide

**Last updated: February 25, 2026**

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
  │     ├── Disposable-domain Set lookup (3 500+ domains)
  │     └── Role-prefix Set lookup (admin@, noreply@, …)
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
  ├─► Early exit if no EMAILABLE_API_KEY set
  │
  └─► Emailable API — SMTP verification (~500 ms)
        ├── success → mergeEmailableResult()
        ├── API error → graceful fallback to local+MX result
        └── JSON response → EmailValidationResult
              ├── valid: boolean
              ├── score: 0–100
              ├── checks: { syntax, validTld, notDisposable, notRole, apiDeliverable }
              ├── message: human-readable verdict
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
│   └── UrlResultCard.tsx            # Score ring, check grid, flags list (URL) + NordVPN affiliate nudge
└── lib/
    ├── affiliate-links.ts           # Affiliate partner URLs (ZeroBounce, NordVPN) — swap PLACEHOLDERs when approved
    ├── email-validator.ts           # Core logic: validateEmailLocal, applyMxResult, mergeEmailableResult
    ├── url-validator.ts             # Core logic: validateUrlLocal, applyHeadResult, applySafeBrowsingResult
    ├── text-debunker.ts             # Types + Zod schema for TextDebunkResult
    ├── llm-client.ts                # Thin Anthropic SDK wrapper: callClaude(systemPrompt, userMsg)
    ├── disposable-domains.ts        # 3 500+ disposable domains via disposable-email-domains package
    ├── rate-limit.ts                # Upstash Redis: checkRateLimit (20/min), checkDailyTextLimit (20/day)
    └── faq-data.ts                  # Shared FAQ Q&A — consumed by FAQ.tsx + FAQPage JSON-LD
__tests__/
├── email-validator.test.ts          # Jest unit tests: validateEmailLocal, applyMxResult, mergeEmailableResult
└── url-validator.test.ts            # Jest unit tests: validateUrlLocal, applyHeadResult, applySafeBrowsingResult
```

## Environment Variables

| Variable                       | Required | Description                                                                               |
| ------------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`            | Yes      | Anthropic API key — powers the Text / SMS scam detector (Claude claude-sonnet-4-20250514) |
| `UPSTASH_REDIS_REST_URL`       | Yes      | Upstash Redis URL — rate limiting (20 req/min) + result cache (24 h TTL)                  |
| `UPSTASH_REDIS_REST_TOKEN`     | Yes      | Upstash Redis token — required alongside the URL above                                    |
| `GOOGLE_SAFE_BROWSING_API_KEY` | No       | Google Safe Browsing v5 key — enables malware/phishing lookup on URL tool                 |
| `EMAILABLE_API_KEY`            | No       | Emailable API key — enables SMTP-level mailbox checks on email tool                       |
| `NEXT_PUBLIC_ADSENSE_ID`       | No       | Google AdSense publisher ID (`ca-pub-...`) — leave blank until approved                   |

## Affiliate Links

Contextual affiliate recommendations are shown to users after risky/unsafe results:

- **Email validator** → ZeroBounce (shown for risky/invalid results)
- **URL checker** → NordVPN (shown for suspicious/dangerous scores)
- **Text/SMS detector** → NordVPN (shown for unsafe results)

Affiliate links are always labelled with a visible "Affiliate" disclosure badge. No personal data is shared with affiliate partners. URLs are stored in [src/lib/affiliate-links.ts](src/lib/affiliate-links.ts) — replace `PLACEHOLDER` values once accounts are approved.

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
  │     ├── Disposable-domain lookup (3 500+ domains from npm package)
  │     └── Role-prefix lookup
  │
  ├─► Early exit if syntax fails (no DNS or API call)
  │
  ├─► resolveMx() — DNS lookup, ~50 ms, free
  │     ├── true  → domain has MX records
  │     ├── false → no MX records (early exit, skip Emailable)
  │     └── null  → DNS timeout / transient error (continue)
  │
  ├─► applyMxResult() — attaches hasMx to result, adjusts score
  │
  ├─► Early exit if hasMx = false OR EMAILABLE_API_KEY not set
  │
  └─► Emailable API — SMTP verification, ~500 ms
        ├── mergeEmailableResult() — merges API response with local+MX result
        └── Graceful fallback to local+MX result on API error
```

## Colour Scheme

The site uses an **always-dark** design (zinc-950 background) with a neon-orange brand
colour — deliberately distinct from Emailable's corporate blue/teal palette.

| Token role           | Tailwind class       | Hex        |
| -------------------- | -------------------- | ---------- |
| Brand / CTA button   | `bg-orange-500`      | `#f97316`  |
| Brand accent / links | `text-orange-400`    | `#fb923c`  |
| Focus rings          | `ring-orange-500`    | `#f97316`  |
| Valid result         | `border-lime-500`    | `#84cc16`  |
| Risky result         | `border-yellow-500`  | `#eab308`  |
| Invalid result       | `border-rose-500`    | `#fb7185`  |
| Score ring — valid   | `#84cc16` (SVG fill) | lime-400   |
| Score ring — warn    | `#eab308` (SVG fill) | yellow-400 |
| Score ring — invalid | `#fb7185` (SVG fill) | rose-400   |

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
- [ ] **`og-image.png`** — 1200×630 open-graph image (see SEO checklist)
- [ ] **Core Web Vitals** — run Lighthouse; aim for green on all three

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
- **Result cache** — SHA-256 of the normalised message used as cache key; 24 h TTL on Upstash. Viral scam texts hit cache on the second request, skipping Claude entirely.
- All limiters are **no-ops when `UPSTASH_REDIS_REST_URL` is absent** (safe for local dev).

## Expansion Roadmap

See ROADMAP.md (local file, gitignored for privacy planning).

## Cost Monitoring

| Service                    | Free Tier          | Cost at Scale |
| -------------------------- | ------------------ | ------------- |
| Vercel Hosting             | 100GB bandwidth/mo | ~$20/mo Pro   |
| Emailable                  | 250 checks/mo      | $0.005/check  |
| Google Safe Browsing       | 10k req/day        | Free          |
| Upstash Redis (rate limit) | 10k req/day        | $0.20/100k    |

**Estimated cost at 10k validations/day with Emailable**: ~$15/mo
**Without Emailable (local only)**: Effectively free on Vercel hobby plan

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
- [ ] Core Web Vitals — run Lighthouse after launch
- [ ] `og-image.png` (1200×630) — create with Figma or [vercel/og](https://vercel.com/docs/functions/og-image-generation)

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
