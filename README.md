# IsThisValid.com

A free, no-signup verification hub for checking emails, scanning URLs for threats, and detecting scam text messages using AI.

**Live:** https://isthisvalid.com

---

## Features

### 🔤 Email Validator

- RFC 5322 syntax validation
- TLD verification
- Disposable email detection (3,500+ domains)
- Role-based email filtering (admin@, noreply@, etc.)
- MX record lookup
- Optional SMTP mailbox verification (pluggable provider: ZeroBounce preferred, Emailable fallback)
- Typo suggestions

**Result:** 0–100 confidence score with detailed check breakdown

### 🔗 URL Safety Checker

- Structural validation (scheme, IP, credentials, shorteners)
- Punycode homograph detection
- Brand-squatting detection (20 major brands)
- Live HEAD request verification
- Google Safe Browsing v5 integration
- Phishing keyword pattern detection

**Result:** 0–100 safety score with granular check details

### 💬 Text / SMS Scam Detector

- AI-powered classification using Claude Sonnet
- Detects smishing, impersonation, urgency tricks, advance-fee scams
- Prompt injection hardening
- Per-IP rate limiting (20/min) + daily spend cap (20/day)
- 24-hour result caching to minimize API costs
- Pre-baked example for zero-cost demo

**Result:** Classification (scam/smishing/spam/suspicious/legit) with confidence score and flagged red flags

---

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 (always-dark theme)
- **Runtime Validation:** Zod v4
- **Testing:** Jest + ts-jest
- **Rate Limiting & Caching:** Upstash Redis
- **LLM Integration:** Anthropic Claude API
- **Hosting:** Vercel
- **Analytics:** Vercel Analytics
- **Monetisation:** Google AdSense + affiliate links (ZeroBounce, NordVPN)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
git clone https://github.com/yourusername/isthisvalid.git
cd isthisvalid
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your API keys:

- `ANTHROPIC_API_KEY` — Claude API (required for text debunker)
- `UPSTASH_REDIS_REST_URL` — Redis for rate limiting (required)
- `UPSTASH_REDIS_REST_TOKEN` — Redis token (required)
- `GOOGLE_SAFE_BROWSING_API_KEY` — Safe Browsing API (optional)
- `ZEROBOUNCE_API_KEY` — ZeroBounce email verification (optional, preferred — 100 free/month)
- `EMAILABLE_API_KEY` — Emailable fallback (optional, only used if ZeroBounce key is absent)
- `NEXT_PUBLIC_ADSENSE_ID` — AdSense publisher ID (optional, leave blank until approved)

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

**Current:** 83/83 tests passing (27 email + 21 URL + 35 text debunker)

### Production Build

```bash
npm run build
npm start
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── check/              # Tool pages (email/url/text/image)
│   ├── api/                # API routes (validation endpoints)
│   ├── privacy/            # Legal pages
│   ├── about/
│   └── terms/
├── components/             # React components
│   ├── ResultCard.tsx      # Email validator result display
│   ├── UrlResultCard.tsx   # URL checker result display
│   ├── TextResultCard.tsx  # Text debunker result display
│   └── ...
├── lib/                    # Utility functions & constants
│   ├── email-validator.ts  # Core email validation logic
│   ├── smtp-provider.ts    # Pluggable SMTP provider (ZeroBounce / Emailable)
│   ├── url-validator.ts    # Core URL validation logic
│   ├── text-debunker.ts    # Text analysis types
│   ├── llm-client.ts       # Anthropic API wrapper
│   ├── rate-limit.ts       # Upstash rate limiting
│   └── affiliate-links.ts  # Affiliate partner URLs
└── __tests__/              # Jest unit tests
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

Set all required env vars (ANTHROPIC_API_KEY, UPSTASH_REDIS_REST_URL/TOKEN, GOOGLE_SAFE_BROWSING_API_KEY) in your Vercel project dashboard before deploying.

---

## Cost Monitoring

| Service              | Free Tier              | Notes                                        |
| -------------------- | ---------------------- | -------------------------------------------- |
| Vercel               | 100 GB bandwidth/month | Hobby plan sufficient                        |
| Anthropic Claude     | Pay-per-token          | ~$1–3/month at 20 text checks/day            |
| Google Safe Browsing | 10,000 req/day         | Free                                         |
| Upstash Redis        | 10,000 req/day         | Free tier                                    |
| ZeroBounce           | 100 checks/month       | Preferred SMTP provider; recurring free tier |
| Emailable            | 250 checks (one-time)  | Fallback; only used if ZeroBounce key absent |

**Estimated monthly cost:** $0–5 with all APIs (depends on usage)

---

## Affiliate Links

Contextual affiliate recommendations appear on result cards when users get risky/unsafe verdicts:

- **Email validator → ZeroBounce** (shown for risky/invalid results)
- **URL checker → NordVPN** (shown for suspicious/dangerous scores)
- **Text detector → NordVPN** (shown for unsafe results)

Affiliate links are always labelled with a visible "Affiliate" disclosure. No user data is shared with partners.

To add your tracking URLs:

1. Sign up for [ZeroBounce affiliate](https://www.zerobounce.net/affiliate) and [NordVPN affiliate](https://nordvpn.com/affiliate)
2. Get your tracking links from each dashboard
3. Update `src/lib/affiliate-links.ts` (replace PLACEHOLDER values)

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

- **Privacy Policy** (`/privacy`) — GDPR/CCPA-compliant, all 5 subprocessors documented
- **Terms of Service** (`/terms`) — Liability disclaimers, tool limitations, acceptable use
- **Cookie Consent** — GDPR-required banner stored in localStorage
- **No data retention** — Email/URL/text inputs are never stored (except 24h cache hash on text)

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
