# IsThisValid.com

A free, no-signup verification hub for checking emails, scanning URLs for threats, detecting scam text messages using AI, and validating phone numbers.

**Live:** https://isthisvalid.com

---

## Features

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
- **Monetisation:** Google AdSense + affiliate links (ZeroBounce, NordVPN) + Ko-fi donations
- **Code Formatting:** Prettier + husky pre-commit hook (auto-formats on every commit)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm

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

**Current:** 403/403 tests passing (150 email + 113 URL + 70 phone + 45 text debunker + 15 smtp-cache + 10 other)

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
│   ├── check/              # Tool pages (email/url/text/phone/image)
│   ├── api/                # API routes (validation endpoints)
│   ├── privacy/            # Legal pages
│   ├── about/
│   └── terms/
├── components/             # React components
│   ├── ResultCard.tsx      # Email validator result display
│   ├── UrlResultCard.tsx   # URL checker result display
│   ├── TextResultCard.tsx  # Text debunker result display
│   ├── PhoneResultCard.tsx # Phone validator result display
│   └── ...
├── lib/                    # Utility functions & constants
│   ├── email-validator.ts  # Core email validation logic
│   ├── smtp-provider.ts    # Pluggable SMTP provider (ZeroBounce / Emailable)
│   ├── url-validator.ts    # Core URL validation logic
│   ├── text-debunker.ts    # Text analysis types
│   ├── phone-validator.ts  # Core phone validation logic + carrier merge
│   ├── carrier-provider.ts # Pluggable carrier API (AbstractAPI / NumVerify)
│   ├── phone-cache.ts      # Redis carrier result cache (30-day TTL)
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

Set all required env vars in your Vercel project dashboard before deploying:

- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`), `ANTHROPIC_MAX_TOKENS` (default: `1024`)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `GOOGLE_SAFE_BROWSING_API_KEY` (optional)

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

- **Privacy Policy** (`/privacy`) — GDPR/CCPA-compliant, all 5 subprocessors documented
- **Terms of Service** (`/terms`) — Liability disclaimers, tool limitations, acceptable use
- **Cookie Consent** — GDPR-required banner stored in localStorage
- **No data retention for URLs/text inputs** — URL and text inputs are never stored after the check is complete
- **Email SMTP cache** — a SHA-256 hash of submitted email addresses may be stored in Redis for up to 7 days to avoid redundant paid API calls; the hash is one-way and cannot be used to reconstruct the original address
- **Phone carrier cache** — a SHA-256 hash of the E.164-normalised phone number may be stored in Redis for up to 30 days to conserve carrier API quota; the hash cannot be used to reconstruct the original number

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
