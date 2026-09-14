# IsThisValid.com

A free, no-signup verification hub for checking emails, scanning URLs for threats, detecting scam text messages using AI, validating phone numbers, detecting AI-generated images, and scanning QR codes before you trust them.

Not sure which of those you need? Paste it into **Smart Check** and it works that out for you.

**Live:** https://isthisvalid.com

**Mobile app:** A React Native (Expo) client lives in `apps/mobile/`, sharing its validation logic with the web app via the `packages/core` workspace package. It's in active development and **not yet published** to the App Store or Google Play.

---

## Features

### 🔍 Smart Check — paste anything

- One box that takes a link, an email address, a phone number, or a whole text message — it works out which and runs the right check
- Paste a suspicious SMS and it does more than one thing: the message gets an AI verdict **and** the links inside it are checked automatically (up to three)
- Callback numbers found in the message are listed with a button — looked up only when you ask, never behind your back
- What you paste is carried between pages in `sessionStorage`, never in the web address, so it stays out of your browser history
- Dangerous schemes (`javascript:`, `data:`, `file:`, `vbscript:`) are always treated as inert text, never as a link

**Result:** The full verdict from the matching tool, plus a card for each link found inside a pasted message

### 📲 Install it / share to it

- Installable as a home-screen app (PWA) with a proper icon and standalone display
- **Android:** share a suspicious text straight from Messages via **Share → IsThisValid** — it lands pre-filled in Smart Check
- **iOS:** installs to the home screen, but Apple does not implement the Web Share Target API, so IsThisValid will **not** appear in the iOS share sheet
- Text only — no service worker, and shared images are out of scope (use the Image Checker's normal upload)

### 🔤 Email Validator

- RFC 5322 syntax validation
- TLD verification
- Disposable email detection (57,000+ domains)
- Role-based email filtering (admin@, noreply@, etc.)
- MX record lookup
- Optional SMTP mailbox verification (pluggable provider: ZeroBounce preferred, Emailable fallback)
- Typo suggestions

**Result:** 0–100 confidence score with detailed check breakdown

### 🔗 URL Safety Checker

- Structural validation (scheme, IP, credentials, shorteners)
- Punycode homograph detection
- Brand-squatting detection (54 major brands)
- Typosquat detection (Levenshtein + digit/symbol substitution)
- High-entropy hostname detection (DGA/random label heuristic)
- Excessive hyphen detection
- Excessive subdomain depth detection
- Suspicious TLD detection (15 high-abuse TLDs)
- Live HEAD request + 5-hop redirect chain analysis
- RDAP domain age check (newly registered domains flagged)
- Google Safe Browsing v4 integration
- Phishing keyword pattern detection

**Result:** 0–100 safety score with granular check details

### 💬 Text / SMS Scam Detector

- AI-powered classification using Claude (model configurable via env var)
- Detects smishing, impersonation, urgency tricks, advance-fee scams
- Prompt injection hardening ([MSG]/[/MSG] delimiter sanitisation)
- Cross-field risk score coercion (scam/smishing ≥60; legit ≤40)
- Per-IP rate limiting (20/min) + daily spend cap (20/day)
- Cache check runs before daily limit — cache hits never burn quota
- 30-second API timeout on Claude calls
- 24-hour result caching to minimize API costs
- Pre-baked example for zero-cost demo
- Model name shown in result badge (e.g. "Claude Haiku 4.5 · AI Analysis")

**Result:** Classification (scam/smishing/spam/suspicious/legit) with confidence score and flagged red flags

### 📞 Phone Number Validator

- International format parsing (E.164, national, and local formats for any country)
- ITU-T validity and length checks via Google's libphonenumber
- Line type detection: mobile, landline, VoIP, toll-free, premium-rate, pager, VOIP
- Country and calling-code identification (240+ countries)
- US area-code geographic lookup
- Carrier name and active-line confirmation via AbstractAPI or NumVerify
- Caribbean/Pacific NANP one-ring scam warning (809, 876, 473, etc.)
- Premium-rate and VoIP flagging
- 30-day Redis cache keyed on SHA-256(E.164) to conserve monthly API quota

**Result:** 0–100 confidence score, line-type badge, carrier details, and prominent scam warnings

### 🖼️ Image Authenticity Checker

- AI-generated image detection via SightEngine (`genai` model)
- Accepts JPEG, PNG, WebP, GIF up to 4 MB
- MIME type validated from actual file content, not extension
- Image bytes never persisted — only a SHA-256 hash is cached
- Per-IP rate limiting (20/min) + daily cost cap (10/day — lower than text's 20/day since SightEngine credits cost more per call)
- Cache check runs before daily limit — cache hits never burn quota
- 24-hour result caching, 30-second API timeout with 3 automatic retries on transient errors
- Zod-validated raw provider response before normalisation

**Result:** Classification (ai-generated/authentic/uncertain), 0–100 risk score, confidence, flagged indicators, and explanation

### 🔳 QR Code Scanner

- Upload an image or scan live with your camera — decoded entirely in the browser (`jsQR`), nothing ever uploaded
- URLs are automatically run through the URL Safety Checker for a full verdict
- Non-URL content (Wi-Fi credentials, phone numbers, email addresses, plain text) decoded and displayed, never auto-actioned
- Wi-Fi QR passwords are parsed but never surfaced or stored
- `javascript:`/`data:` and other dangerous schemes are always treated as inert text, never sent to the URL checker
- Camera loop throttled to ~12.5fps with automatic cleanup — camera light never stays on after you leave the page

**Result:** Full URL safety verdict for links, or a decoded-content card with safety notes for everything else

---

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 (always-dark theme)
- **Runtime Validation:** Zod v4
- **Testing:** Jest + ts-jest
- **Rate Limiting & Caching:** Upstash Redis
- **LLM Integration:** Anthropic Claude API
- **Image AI Detection:** SightEngine (`genai` model)
- **QR Decoding:** jsQR (client-side, no server processing)
- **PWA:** static `public/manifest.json` with a text-only Web Share Target (no service worker)
- **Hosting:** Vercel
- **Analytics:** Vercel Analytics
- **Monetisation:** Ko-fi voluntary donations + contextual affiliate links (ZeroBounce, NordVPN) + Google AdSense (pending approval)
- **Code Formatting:** Prettier + husky pre-commit hook (auto-formats on every commit)

---

## Quick Start

### Prerequisites

- Node.js 24+ and npm

### Installation

```bash
git clone https://github.com/msywensky/isthisvalid.git
cd isthisvalid
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your API keys:

- `ANTHROPIC_API_KEY` — Claude API (required for text debunker)
- `ANTHROPIC_MODEL` — Claude model override (optional; default: `claude-sonnet-4-20250514`; use `claude-haiku-4-5-20251001` for cheaper dev testing)
- `ANTHROPIC_MAX_TOKENS` — Claude max output tokens (optional; default: `1024`; set lower e.g. `300` during testing)
- `UPSTASH_REDIS_REST_URL` — Redis for rate limiting (required)
- `UPSTASH_REDIS_REST_TOKEN` — Redis token (required)
- `GOOGLE_SAFE_BROWSING_API_KEY` — Safe Browsing API (optional)
- `ZEROBOUNCE_API_KEY` — ZeroBounce email verification (optional, preferred — 100 free/month)
- `EMAILABLE_API_KEY` — Emailable fallback (optional, only used if ZeroBounce key is absent)
- `NEXT_PUBLIC_ADSENSE_ID` — AdSense publisher ID (optional, leave blank until approved)
- `ABSTRACT_API_PHONE_KEY` — AbstractAPI Phone Intelligence (optional, 250 free/month; preferred carrier lookup)
- `NUMVERIFY_API_KEY` — NumVerify (optional, 100 free/month; fallback if Abstract key is absent)
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` — SightEngine image AI detection (required for image tool; sign up at sightengine.com)
- `SIGHTENGINE_MODEL_LABEL` — Optional display label override (default: `"SightEngine"`)
- `NEXT_PUBLIC_KOFI_USERNAME` — Ko-fi username for donation link (optional; link hidden if not set)

All external APIs degrade gracefully if keys are missing.

### Local Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Testing

```bash
npm test                  # Run all tests
npm run test -- --watch   # Watch mode
npm run test -- --coverage  # With coverage report
```

**Current:** 563/563 tests passing (161 email + 113 URL + 71 phone + 52 input-router + 45 text debunker + 46 image debunker + 27 image route + 17 share route + 16 qr-content + 15 smtp-cache)

### Production Build

```bash
npm run build
npm start
```

---

## Project Structure

This repo is an npm workspace root: the Next.js web app stays at the root (unchanged, zero deploy impact), with two workspace siblings — `packages/core` (pure validation logic shared by both clients) and `apps/mobile` (the React Native/Expo app). See [ARCHITECTURE.md](./ARCHITECTURE.md#9-monorepo--react-native-client) for the full breakdown.

```
packages/core/
└── src/                    # Pure TS: email/url/phone-validator, input-router, qr-content,
                             #   text/image-debunker, *-faq-data — no DOM, no Node-only APIs

apps/mobile/                # Expo Router app (@isthisvalid/mobile) — calls the same /api/*
│                            #   routes over HTTP; imports @isthisvalid/core/* directly.
│                            #   Has its own tsc/lint commands — see CLAUDE.md.
└── src/
    ├── app/                # Screens: index, email, url, phone, text, image, settings
    └── components/         # RN result cards, shared ScoreRing/FAQ components

src/
├── app/                    # Next.js App Router pages
│   ├── check/              # Tool pages (any/email/url/text/phone/image/qr)
│   ├── api/                # API routes (validation endpoints)
│   ├── share/              # Web Share Target receiver + handoff page
│   ├── privacy/            # Legal pages
│   ├── about/
│   └── terms/
├── components/             # React components
│   ├── ResultCard.tsx      # Email validator result display
│   ├── UrlResultCard.tsx   # URL checker result display
│   ├── TextResultCard.tsx  # Text debunker result display
│   ├── PhoneResultCard.tsx # Phone validator result display
│   ├── ImageResultCard.tsx # Image authenticity result display
│   ├── QrContentCard.tsx   # Non-URL QR content display (tel/email/wifi/text)
│   ├── SmartInput.tsx      # Homepage "paste anything" box
│   └── ...
├── lib/                    # Server-only logic + one-line re-export shims for the pure
│   │                       #   validators/debunkers (real implementation now lives in
│   │                       #   packages/core/ — see above; shims keep every existing
│   │                       #   import site working unchanged)
│   ├── smtp-provider.ts    # Pluggable SMTP provider (ZeroBounce / Emailable)
│   ├── carrier-provider.ts # Pluggable carrier API (AbstractAPI / NumVerify)
│   ├── phone-cache.ts      # Redis carrier result cache (30-day TTL)
│   ├── sightengine-client.ts # SightEngine API client with retry/backoff
│   ├── smart-input-handoff.ts # Read-once sessionStorage handoff (never a query string)
│   ├── llm-client.ts       # Anthropic API wrapper
│   ├── rate-limit.ts       # Upstash rate limiting
│   ├── affiliate-links.ts  # Affiliate partner URLs (shim)
│   └── email-validator.ts, url-validator.ts, phone-validator.ts, text-debunker.ts,
│       image-debunker.ts, input-router.ts, qr-content.ts, result-card-variant.ts # shims
├── hooks/                  # useQrScanner, useSmartCheck
└── __tests__/              # Jest unit tests (563)

public/
├── manifest.json           # PWA manifest (text-only share target)
└── icons/                  # Home-screen icons — regenerate with `npm run generate-icons`
```

Full architecture details: see [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository at [vercel.com/new](https://vercel.com/new)
3. Add environment variables under **Settings → Environment Variables → Production**
4. Deploy

Vercel auto-detects Next.js and handles everything else.

### Environment Variables in Production

Set all required env vars in your Vercel project dashboard before deploying:

- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`), `ANTHROPIC_MAX_TOKENS` (default: `1024`)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `GOOGLE_SAFE_BROWSING_API_KEY` (optional)
- `SIGHTENGINE_API_USER`, `SIGHTENGINE_API_SECRET` (required for image tool; optional `SIGHTENGINE_MODEL_LABEL`)

---

## Cost Monitoring

| Service              | Free Tier              | Notes                                              |
| -------------------- | ---------------------- | -------------------------------------------------- |
| Vercel               | 100 GB bandwidth/month | Hobby plan sufficient                              |
| Anthropic Claude     | Pay-per-token          | ~$1–3/month at 20 text checks/day                  |
| Google Safe Browsing | 10,000 req/day         | Free                                               |
| Upstash Redis        | 10,000 req/day         | Free tier                                          |
| ZeroBounce           | 100 checks/month       | Preferred SMTP provider; recurring free tier       |
| Emailable            | 250 checks (one-time)  | Fallback; only used if ZeroBounce key absent       |
| AbstractAPI Phone    | 250 lookups/month      | Preferred carrier lookup; recurring free tier      |
| NumVerify            | 100 lookups/month      | Carrier fallback; only used if Abstract key absent |
| SightEngine          | Free trial credits     | Image AI detection; 10 checks/day cap limits spend |

**Estimated monthly cost:** $0–5 with all APIs (depends on usage)

---

## Affiliate Links

Contextual affiliate recommendations appear on result cards when users get risky/unsafe verdicts:

- **Email validator → ZeroBounce** (shown for risky/invalid results)
- **URL checker → NordVPN** (shown for suspicious/dangerous scores)
- **Text detector → NordVPN** (shown for unsafe results)

Affiliate links are always labelled with a visible "Affiliate" disclosure. No user data is shared with partners.

To configure your affiliate tracking URLs, set these environment variables in `.env.local` and your Vercel project dashboard:

```
NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL=https://aff.zerobounce.net/your-tracking-link
NEXT_PUBLIC_NORDVPN_AFFILIATE_URL=https://go.nordvpn.net/aff_c?offer_id=15&aff_id=your-id
```

The fallback values in `src/lib/affiliate-links.ts` contain PLACEHOLDER values that will display a non-tracking direct link until you set your own.

---

## SEO & Schema

- Metadata API for dynamic titles & descriptions per page
- OpenGraph & Twitter Card tags
- Schema.org WebApplication + FAQPage structured data
- Auto-generated `sitemap.xml` and `robots.txt`
- Semantic HTML with skip-to-content link
- Mobile-responsive (Tailwind `sm:`, `md:`, `lg:` breakpoints)

---

## Privacy & Compliance

- **Privacy Policy** (`/privacy`) — GDPR/CCPA-compliant; all subprocessors documented; 6 GDPR rights including portability, rectification, and right to lodge a DPA complaint
- **Terms of Service** (`/terms`) — 15 sections covering liability disclaimers, tool limitations, acceptable use, indemnification, severability, and no-waiver
- **Cookie Consent** — GDPR-required banner stored in localStorage
- **No data retention for URLs/text inputs** — URL and text inputs are never stored after the check is complete
- **Email SMTP cache** — a SHA-256 hash of submitted email addresses may be stored in Redis for up to 7 days to avoid redundant paid API calls; the hash is one-way and cannot be used to reconstruct the original address
- **Phone carrier cache** — a SHA-256 hash of the E.164-normalised phone number may be stored in Redis for up to 30 days to conserve carrier API quota; the hash cannot be used to reconstruct the original number
- **Image bytes never stored** — only a SHA-256 hash of the uploaded image is cached in Redis for up to 24 hours to avoid redundant SightEngine calls

---

## Contributing

Found a bug? Have a suggestion? Reach out:

📧 **Email:** privacy@isthisvalid.com

## License

This project is licensed under the **MIT License with Commons Clause** — a dual-license approach that:

- **Allows:** Learning, personal use, modification, and forking
- **Restricts:** Commercial use, building competitive products, or commercial redistribution

See [LICENSE.md](LICENSE.md) for full terms. For commercial use or licensing inquiries, contact privacy@isthisvalid.com.

---

## Support

**Website:** https://isthisvalid.com  
**Email:** privacy@isthisvalid.com  
**About:** https://isthisvalid.com/about  
**Privacy:** https://isthisvalid.com/privacy  
**Terms:** https://isthisvalid.com/terms
