# IsThisValid.com — Architecture Guide

**Last updated: March 2, 2026**

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
  │     ├── RFC 5321 dot rules — rejects leading/trailing/consecutive dots in local part
  │     ├── TLD presence + length (≥2 chars)
  │     ├── Typo detection — domain in TYPO_MAP caps score ≤65 + targets message
  │     ├── Disposable-domain Set lookup (~57 000+ domains)
  │     └── Role-prefix Set lookup (110+ prefixes: admin@, noreply@, shop@, ceo@, …)
  │           └── +tag suffix stripped before lookup (noreply+bounce@ → noreply)
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
              └── suggestion: full corrected email for common domain typos
                              (e.g. user@gmial.com → user@gmail.com; covers
                               .con, .cmo, .ocm TLD typos + 30+ domain variants)
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
  │     ├── Shortener — 35 known services (bit.ly, tinyurl.com, t.ly, rebrand.ly …)
  │     ├── Suspicious keywords — 12 phishing-path pattern combos
  │     ├── Punycode — xn-- homograph detection
  │     ├── TLD — must have a dot + ≥2-char suffix
  │     ├── Brand squatting — 54 brands × word-boundary regex vs eTLD+1
  │     ├── Typosquat — Levenshtein ≤1 + digit/symbol substitution vs 54 brands
  │     ├── Excessive subdomain depth — ≥5 labels flagged (score cap ≤60)
  │     ├── Suspicious TLD — 15 high-abuse TLDs flagged (score cap ≤80)
  │     ├── High-entropy hostname — DGA/random label ≥12 chars, entropy >3.8 (score cap ≤75)
  │     └── Excessive hyphens — ≥3 hyphens in one label (−8 points)
  │
  ├─► Early exit if URL is unparseable
  │
  ├─► isPrivateHost() — SSRF guard (RFC-1918, loopback, .local, .internal, private IPv6)
  │     └── 400 Bad Request if host is private or reserved
  │
  ├─► checkResolves() + checkDomainAge() — HEAD + RDAP, run in parallel
  │     ├── HEAD follows up to 5 redirects; cross-domain destination → validateUrlLocal() + merge
  │     ├── resolves: true / false / null
  │     └── isOldDomain: true (≥30 days) / false (<30 days → score cap ≤70) / null (RDAP unavailable)
  │
  ├─► applyHeadResult() + applyRedirectResult() + applyRdapResult()
  │     ├── resolves=true  → +5 bonus (capped at 100)
  │     ├── resolves=false → score capped at 70
  │     ├── redirect to different domain → destination flags merged
  │     └── new domain (<30 days) → score capped at 70, safe=false
  │
  ├─► Early exit if no GOOGLE_SAFE_BROWSING_API_KEY set
  ├─► Early exit if score < 50 (already clearly dangerous — skip Google quota)
  │
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

### Phone Number Validation (`POST /api/validate-phone`)

```
Browser  →  POST /api/validate-phone { phone }
  │
  ├─► Rate limit check (Upstash, 20 req/min per IP — shared with email/URL)
  │     └── 429 if exceeded
  │
  ├─► Zod validation (5–25 chars)
  │
  ├─► validatePhoneLocal() — free, instant, libphonenumber-js
  │     ├── Normalise: leading "00" → "+"
  │     ├── Parse with libphonenumber-js/max (Google's numbering plan data)
  │     ├── US default applied when ≥7 digits with no explicit country code
  │     ├── isValid() + isPossible() checks
  │     ├── Country + calling code detection (240+ countries)
  │     ├── Line type: MOBILE / FIXED_LINE / VOIP / TOLL_FREE / PREMIUM_RATE /
  │     │             SHARED_COST / PERSONAL_NUMBER / PAGER / UAN / VOICEMAIL / UNKNOWN
  │     ├── US area-code → state/region lookup (us-area-codes.ts)
  │     └── Caribbean NANP warning — +1 numbers outside US/CA/PR/GU/VI/AS/MP
  │
  ├─► Early exit if !parseable
  │
  ├─► getCarrierProvider() — AbstractAPI preferred, NumVerify fallback
  │     └── null → return local result (no API keys configured)
  │
  ├─► Redis carrier cache lookup — sha256(E.164), 30-day TTL
  │     ├── HIT  → return cached result with input re-stamped (skip API)
  │     └── MISS → continue
  │
  ├─► carrier.lookup(e164) — AbstractAPI or NumVerify, 8 s timeout
  │     ├── AbstractAPI: GET phoneintelligence.abstractapi.com/v1/
  │     │     ├── phone_carrier.line_type (overridden by is_voip when true)
  │     │     ├── phone_validation.line_status → active flag
  │     │     └── phone_location.region + city → combined location string
  │     └── NumVerify: GET http://apilayer.net/api/validate  ← HTTP required (free tier)
  │           ├── line_type → normalised to SCREAMING_SNAKE_CASE
  │           └── valid → active flag
  │
  ├─► applyCarrierResult() — immutable merge
  │     ├── resolvedLineType = API type (if not UNKNOWN) else local type
  │     ├── swap old line-type bonus out, new one in, add API active bonus
  │     ├── rebuild label/message/flags when line type changed
  │     ├── preserve Caribbean NANP flag through enrichment
  │     └── override location with API-provided city/state
  │
  ├─► setCachedPhoneResult(e164, result) — fire-and-forget
  │
  └─► JSON response → PhoneValidationResult
        ├── valid, score (0–100), label, message, flags
        ├── phoneE164, countryCode, countryName, nationalFormat, internationalFormat
        ├── lineType, location, carrier, lineActive, ported
        ├── checks: { parseable, validLength, validPattern, possibleNumber, countryDetected }
        └── source: "local" | "abstract" | "numverify"
```

### Text / SMS Scam Analysis (`POST /api/debunk/text`)

```
Browser  →  POST /api/debunk/text { message }
  │
  ├─► Rate limit check (Upstash, 20 req/min per IP)
  │     └── 429 if exceeded
  │
  ├─► LLM availability check (ANTHROPIC_API_KEY configured?)
  │     └── 503 if not configured
  │
  ├─► Zod validation (10–5 000 chars)
  │
  ├─► Redis cache lookup (SHA-256 of normalised message, 24 h TTL)
  │     ├── HIT  → return cached result (X-Cache: HIT) ← daily limit NOT consumed
  │     └── MISS → continue
  │
  ├─► Daily spend cap check (Upstash, 20 req/day per IP) ← only reached on cache miss
  │     └── 429 if exceeded
  │
  ├─► Sanitise input — strip [MSG]/[/MSG] tags from user content
  │     └── Prevents delimiter injection attacks on the trust boundary
  │
  ├─► callClaude() — model from ANTHROPIC_MODEL env var (default: claude-sonnet-4-20250514)
  │     ├── System prompt: scam detection expert + prompt injection rules
  │     ├── User payload: [MSG]{sanitised message}[/MSG]  ← trust boundary delimiter
  │     ├── maxTokens from ANTHROPIC_MAX_TOKENS env var (default: 1024)
  │     └── AbortSignal.timeout(30 000 ms) — prevents hanging on slow/overloaded API
  │
  ├─► API error → 502
  ├─► null response → 503
  │
  ├─► Strip markdown code fences from response
  │
  ├─► Parse + Zod-validate Claude’s JSON response
  │     └── Parse failure → 502
  │
  ├─► coerceRiskScore() — enforce cross-field consistency
  │     ├── scam / smishing → riskScore = Math.max(riskScore, 60)
  │     ├── legit          → riskScore = Math.min(riskScore, 40)
  │     └── spam / suspicious → unchanged
  │
  ├─► Derive safe — riskScore < SAFE_RISK_THRESHOLD (50) AND classification not in DANGEROUS_CLASSIFICATIONS
  │
  ├─► Write result to Redis cache (fire-and-forget)
  │
  └─► JSON response → TextDebunkResult (X-Cache: MISS)
        ├── classification: scam | smishing | spam | suspicious | legit
        ├── confidence: 0–100
        ├── riskScore: 0–100 (coerced for consistency with classification)
        ├── safe: boolean
        ├── summary: one-sentence verdict
        ├── flags: string[]
        ├── explanation: 2–3 sentence breakdown
        └── modelLabel: human-readable model name (e.g. "Claude Sonnet 4", "Claude Haiku 4.5")
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
│   ├── UrlResultCard.tsx            # Score ring, check grid, flags list (URL) + NordVPN affiliate nudge
│   ├── PhoneFAQ.tsx                 # FAQ accordion for the phone validator (teal accent)
│   ├── PhoneForm.tsx                # Phone number input form (teal accent)
│   └── PhoneResultCard.tsx          # Score ring, line-type badge, carrier details, NANP callout
├── proxy.ts                         # CORS enforcement / middleware (Next.js 16 convention)
└── lib/
    ├── affiliate-links.ts           # Affiliate partner URLs — reads from NEXT_PUBLIC_* env vars
    ├── email-validator.ts           # Core logic: validateEmailLocal, applyMxResult, mergeSmtpResult, mergeEmailableResult (compat wrapper); 110+ role prefixes; 35+ typo corrections; RFC 5321 dot validation; typo score cap (≤65); +tag stripped for role check
    ├── smtp-cache.ts                # Redis SMTP result cache: getCachedSmtpResult / setCachedSmtpResult; sha256 key, 7-day TTL, local-only results excluded
    ├── smtp-provider.ts             # Pluggable SMTP provider abstraction: SmtpProvider interface, EmailableProvider, ZeroBounceProvider, getSmtpProvider() factory
    ├── faq-data.ts                  # FAQ Q&A for email tool — consumed by FAQ.tsx + FAQPage JSON-LD
    ├── url-validator.ts             # Core logic: validateUrlLocal, applyHeadResult, applySafeBrowsingResult,
    │                                #   applyRdapResult, applyRedirectResult;
    │                                #   CCTLD_SECOND_LEVELS (~100+ compound ccTLDs: co.uk, com.au, co.jp, co.in …);
    │                                #   getRegisteredDomain / checkBrandSquat / checkTyposquat exported @internal
    ├── url-faq-data.ts              # FAQ Q&A for URL tool — consumed by UrlFAQ.tsx + FAQPage JSON-LD
    ├── text-debunker.ts             # Types + Zod schema for TextDebunkResult
    ├── text-faq-data.ts             # FAQ Q&A for text tool — consumed by TextFAQ.tsx + FAQPage JSON-LD
    ├── phone-validator.ts           # Core logic: validatePhoneLocal, applyCarrierResult, getLineTypeBonus,
    │                                #   buildLabel, buildMessage, buildFlags; NANP_SAFE set; CarrierData interface
    ├── carrier-provider.ts          # Pluggable carrier API: CarrierProvider interface, AbstractApiProvider,
    │                                #   NumverifyProvider, getCarrierProvider() factory; normalizeLineType()
    ├── phone-cache.ts               # Redis carrier result cache: getCachedPhoneResult / setCachedPhoneResult;
    │                                #   sha256(E.164) key, 30-day TTL, local-only results excluded
    ├── phone-faq-data.ts            # FAQ Q&A for phone tool — consumed by PhoneFAQ.tsx
    ├── us-area-codes.ts             # US area-code → state/region lookup table
    ├── llm-client.ts                # Thin Anthropic SDK wrapper: callClaude(systemPrompt, userMsg)
    ├── disposable-domains.ts        # ~57 000+ disposable domains — disposable-email-domains (~3 500) merged with mailchecker (~55 860); combined Set
    └── rate-limit.ts                # Upstash Redis: checkRateLimit (20/min), checkDailyTextLimit (20/day); getRedis() shared client
__tests__/
├── debunk-text-route.test.ts        # Jest unit tests: POST /api/debunk/text route (45 tests)
├── email-validator.test.ts          # Jest unit tests: validateEmailLocal, applyMxResult, mergeSmtpResult, mergeEmailableResult, role prefixes, plus-addressed role check, expanded typo map, RFC 5321 dot rules, typo score cap, exact scoring, case normalization, DISPOSABLE_DOMAINS (150 tests)
├── phone-validator.test.ts          # Jest unit tests: validatePhoneLocal, applyCarrierResult, getLineTypeBonus,
    #   format parsing, validity, country detection, line-type scoring, flags, Caribbean NANP,
    #   area-code location, applyCarrierResult score swap, VOIP reclassification (70 tests)
├── smtp-cache.test.ts               # Jest unit tests: getCachedSmtpResult, setCachedSmtpResult — Redis mocked (15 tests)
└── url-validator.test.ts            # Jest unit tests: validateUrlLocal, applyHeadResult, applySafeBrowsingResult,
    #   applyRdapResult, applyRedirectResult; getRegisteredDomain, checkBrandSquat, checkTyposquat;
    #   notHighEntropy, notExcessiveHyphens, IP edge cases, ccTLD coverage (113 tests)
```

## Environment Variables

| Variable                               | Required | Description                                                                                                             |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                    | Yes      | Anthropic API key — powers the Text / SMS scam detector                                                                 |
| `ANTHROPIC_MODEL`                      | No       | Claude model to use (default: `claude-sonnet-4-20250514`; use `claude-haiku-4-5-20251001` for cheaper dev testing)      |
| `ANTHROPIC_MAX_TOKENS`                 | No       | Max output tokens for Claude (default: `1024`; set lower e.g. `300` to reduce cost during testing)                      |
| `UPSTASH_REDIS_REST_URL`               | Yes      | Upstash Redis URL — rate limiting (20 req/min) + result caches (SMTP 7d, phone 30d, text 24h)                           |
| `UPSTASH_REDIS_REST_TOKEN`             | Yes      | Upstash Redis token — required alongside the URL above                                                                  |
| `GOOGLE_SAFE_BROWSING_API_KEY`         | No       | Google Safe Browsing v4 JSON REST key — enables malware/phishing lookup on URL tool                                     |
| `ZEROBOUNCE_API_KEY`                   | No       | ZeroBounce API key — preferred SMTP provider (100 free verifications/month recurring)                                   |
| `EMAILABLE_API_KEY`                    | No       | Emailable API key — fallback SMTP provider (250 one-time free, then paid); used only if `ZEROBOUNCE_API_KEY` is not set |
| `ABSTRACT_API_PHONE_KEY`               | No       | AbstractAPI Phone Intelligence key — preferred carrier lookup (250 free/month recurring)                                |
| `NUMVERIFY_API_KEY`                    | No       | NumVerify API key — fallback carrier lookup (100 free/month); used only if `ABSTRACT_API_PHONE_KEY` is not set          |
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
  │     ├── Shortener — 35 known services (bit.ly, tinyurl.com, t.ly, rebrand.ly …)
  │     ├── Suspicious keywords — 12 phishing-path pattern combos
  │     ├── Punycode — xn-- homograph detection
  │     ├── TLD — must have a dot + ≥2-char suffix
  │     ├── Brand squatting — 54 brands × word-boundary regex vs eTLD+1
  │     ├── Typosquat — Levenshtein ≤1 + digit/symbol substitution vs 54 brands
  │     ├── Excessive subdomain depth — ≥5 labels flagged (score cap ≤60)
  │     ├── Suspicious TLD — 15 high-abuse TLDs (.tk, .ml, .xyz, .top …) flagged (score cap ≤80)
  │     ├── High-entropy hostname — DGA/random label ≥12 chars, entropy >3.8 (score cap ≤75)
  │     └── Excessive hyphens — ≥3 hyphens in one label (−8 points)
  │
  ├─► Early exit if !parseable
  │
  ├─► isPrivateHost(targetHostname) — SSRF guard
  │     └── 400 Bad Request if host is RFC-1918, loopback, link-local,
  │           shared-use (100.64/10), test-net (203.0.113/24), .local/.internal,
  │           or private IPv6 (::1, fc00::/7, fe80::/10, ::ffff:, 2001:db8::)
  │
  ├─► checkResolves() + checkDomainAge() — run in parallel, 5 s / 4 s timeouts
  │     ├── HEAD follows up to 5 redirect hops; cross-domain destination → validateUrlLocal() + merge
  │     ├── resolves: true (server alive) / false (NXDOMAIN) / null (timeout or private IP)
  │     └── isOldDomain: true (≥30 days) / false (<30 days) / null (RDAP unavailable)
  │
  ├─► applyHeadResult() — merges resolves into score
  │     ├── resolves=true  → +5 bonus (capped at 100)
  │     └── resolves=false → score capped at 70
  │
  ├─► applyRedirectResult() — merges cross-domain redirect destination checks
  │     └── destination flags prefixed "Redirect destination:" + min(orig, dest) score
  │
  ├─► applyRdapResult() — merges RDAP domain-age result
  │     ├── isOld=true  → no penalty
  │     ├── isOld=false → score capped at 70, safe=false, flag prepended
  │     └── isOld=null  → no penalty (RDAP unavailable)
  │
  ├─► Google Safe Browsing v4 Lookup API (optional, only if GOOGLE_SAFE_BROWSING_API_KEY set)
  │     ├── Skipped entirely if score < 50 (already clearly dangerous — saves quota)
  │     └── POST threatMatches:find — checks against malware, phishing, and unwanted software databases
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

| Check                       | Points / Cap          |
| --------------------------- | --------------------- |
| Valid scheme                | +10                   |
| Not IP address              | +15                   |
| No user info                | +10                   |
| Not shortener               | +10                   |
| No suspicious keywords      | +20                   |
| Not punycode                | +10                   |
| Valid TLD                   | +10                   |
| No brand squatting          | +15                   |
| Not typosquat               | cap ≤79 if violated   |
| Excessive hyphens           | −8 points if violated |
| Not excessive subdomains    | cap ≤60 if violated   |
| Not suspicious TLD          | cap ≤80 if violated   |
| High entropy hostname       | cap ≤75 if violated   |
| Domain not newly registered | cap ≤70 if violated   |
| Resolves (HEAD bonus)       | +5 (cap at 100)       |
| Resolves=false              | cap ≤70               |
| Safe Browsing flagged       | cap ≤5                |
| **Total (max)**             | **100**               |

> Score ≥ 80 → Safe (lime) · 50–79 → Suspicious (yellow) · < 50 → Dangerous (rose)  
> Typosquat cap forces score into Suspicious zone (≤79) even if all other checks pass.  
> Excessive subdomain depth caps at ≤60 regardless of other checks.  
> Suspicious TLD caps at ≤80 regardless of other checks.  
> High-entropy hostname caps at ≤75 regardless of other checks.  
> Newly-registered domain (<30 days) caps at ≤70 and sets safe=false.  
> Safe Browsing flagged → score hard-capped at 5.  
> Score <50 after local+RDAP: Safe Browsing API call is skipped entirely (quota saving).

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
  │     ├── RFC 5321 dot rules — rejects leading/trailing/consecutive dots in local part
  │     ├── TLD presence + length (≥2 chars)
  │     ├── Typo detection — domain in TYPO_MAP caps score ≤65 + targets message
  │     ├── Disposable-domain lookup (~57 000+ domains — mailchecker + disposable-email-domains)
  │     └── Role-prefix lookup (110+ prefixes; +tag stripped before match)
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

The site uses an **always-dark** design (zinc-950 background). Each tool has its own accent colour:

| Tool     | Accent         | Tailwind class   |
| -------- | -------------- | ---------------- |
| Email    | Orange (brand) | `orange-400/500` |
| URL      | Sky blue       | `sky-400/500`    |
| Text/SMS | Violet         | `violet-400/500` |
| Phone    | Teal           | `teal-400/500`   |

| Token role            | Tailwind class                          | Hex        |
| --------------------- | --------------------------------------- | ---------- |
| Brand / CTA button    | `bg-orange-500`                         | `#f97316`  |
| Brand accent / links  | `text-orange-400`                       | `#fb923c`  |
| Focus rings           | `ring-orange-500`                       | `#f97316`  |
| Valid result card     | `border-lime-500/50 bg-lime-950/40`     | lime       |
| Warn result card      | `border-yellow-500/50 bg-yellow-950/40` | yellow     |
| Invalid result card   | `border-rose-500/50 bg-rose-950/40`     | rose       |
| Score ring — valid    | `#84cc16` (SVG fill)                    | lime-400   |
| Score ring — warn     | `#eab308` (SVG fill)                    | yellow-400 |
| Score ring — invalid  | `#fb7185` (SVG fill)                    | rose-400   |
| Body / secondary text | `text-zinc-400`                         | `#a1a1aa`  |

> All four result cards (Email, URL, Text, Phone) share the same sentiment-coloured border pattern: lime/yellow/rose for valid/warn/invalid. The URL and Text cards were updated March 2 2026 to match.

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

## Rate Limiting & Caching (Production)

All API routes are protected by Upstash Redis rate limiting:

- **Per-IP sliding window** — 20 requests/min shared across `/api/validate`, `/api/validate-url`, and `/api/validate-phone`
- **Per-IP daily cap** — 20 requests/day on `/api/debunk/text` (LLM cost control)
- **Text result cache** — SHA-256 of the normalised message; 24 h TTL (`itv:text:<hash>`). Viral scam texts hit cache on second request, skipping Claude.
- **SMTP result cache** — SHA-256 of the lowercased email; 7-day TTL (`itv:smtp:<hash>`). Repeat email checks skip ZeroBounce/Emailable. Only SMTP-provider results are cached.
- **Phone result cache** — SHA-256 of the E.164 number; 30-day TTL (`itv:phone:<hash>`). Carrier assignments rarely change. Cache hit re-stamps `input` from the current request to avoid echoing the first caller's formatting. Only carrier-API results are cached — local-only results are not stored. Implemented in `src/lib/phone-cache.ts`.
- All limiters and caches are **no-ops when `UPSTASH_REDIS_REST_URL` is absent** (safe for local dev).

## Expansion Roadmap

See ROADMAP.md (local file, gitignored for privacy planning).

## Cost Monitoring

| Service              | Free Tier                         | Cost at Scale       |
| -------------------- | --------------------------------- | ------------------- |
| Vercel Hosting       | 100 GB bandwidth/mo               | ~$20/mo Pro         |
| ZeroBounce           | 100 checks/mo recurring (free)    | $0.008/check (paid) |
| Emailable            | 250 checks/mo one-time (fallback) | $0.005/check (paid) |
| Google Safe Browsing | 10 k req/day                      | Free                |
| Upstash Redis        | 10 k req/day                      | $0.20/100 k         |

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
├── /check/phone   ← full working tool (libphonenumber + carrier API)
└── /check/image   ← coming soon placeholder
```

`CheckShell` is a shared server component providing the back-nav and tool hero
for all four `/check/*` pages. Each tool page supplies its own colour accent and copy.

## Route Map

| Route                 | Type    | Purpose                                              |
| --------------------- | ------- | ---------------------------------------------------- |
| `/`                   | Static  | Hub — tool picker (2×2 card grid)                    |
| `/check/email`        | Static  | Full email validator                                 |
| `/check/url`          | Static  | URL safety checker                                   |
| `/check/text`         | Static  | SMS / text scam analyser (Claude-powered)            |
| `/check/phone`        | Static  | Phone number validator                               |
| `/check/image`        | Static  | Image authenticity checker (coming soon placeholder) |
| `/about`              | Static  | Site description, disclosure, contact                |
| `/privacy`            | Static  | GDPR/CCPA privacy policy (AdSense required)          |
| `/terms`              | Static  | Terms of service                                     |
| `/api/validate`       | Dynamic | POST — email validation                              |
| `/api/validate-url`   | Dynamic | POST — URL safety check                              |
| `/api/validate-phone` | Dynamic | POST — phone number validation (Node.js runtime)     |
| `/api/debunk/text`    | Dynamic | POST — text/SMS scam analysis (Claude, cached)       |
| `/sitemap.xml`        | Static  | Auto-generated sitemap                               |
| `/robots.txt`         | Static  | Auto-generated robots file                           |
