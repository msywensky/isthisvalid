# IsThisValid.com — Architecture Guide

**Last updated: September 13, 2026**

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
        │     ├── validLength = isPossible() — digit count matches the numbering plan
        │     └── validPattern = isValid() — full NANP/national pattern match (e.g. NANP exchange codes can't start with 0/1)
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

### Image Authenticity Detection (`POST /api/debunk/image`)

```
Browser  →  POST /api/debunk/image  { file: multipart/form-data }
  │
  ├─► Rate limit check (Upstash, 20 req/min per IP — shared with other tools)
  │     └── 429 if exceeded
  │
  ├─► SightEngine availability check (SIGHTENGINE_API_USER + _SECRET configured?)
  │     └── 503 if not configured
  │
  ├─► Parse multipart FormData — 400 if malformed, 422 if "file" field missing/invalid
  │
  ├─► isAcceptedMimeType(file.type) — JPEG/PNG/WebP/GIF only, checked from actual
  │     content type (not filename extension) → 422 if unsupported
  │
  ├─► file.size > MAX_IMAGE_BYTES (4 MB) → 422
  │
  ├─► Read bytes → sha256(bytes) cache key (itv:image:<hash>)
  │
  ├─► Redis cache lookup ← hits return here, daily budget NOT consumed
  │     ├── HIT  → return cached ImageDebunkResult (X-Cache: HIT)
  │     └── MISS → continue
  │
  ├─► Daily spend cap check (Upstash, 10 req/day per IP) ← only reached on cache miss
  │     └── 429 if exceeded
  │
  ├─► callSightengine(bytes, mimeType, filename)
  │     ├── POST multipart to api.sightengine.com/1.0/check.json, models=genai
  │     ├── AbortSignal.timeout(30 000 ms)
  │     └── 3 retries, exponential backoff (1 s → 2 s → 4 s) on 429/5xx/network errors
  │
  ├─► API error → 502; null response (not configured) → 503
  │
  ├─► SightengineRawResponseSchema.safeParse() — Zod validates raw provider shape
  │     └── Parse failure → 502
  │
  ├─► normalizeProviderResponse() — converts type.ai_generated (0–1) into result
  │     ├── ≥0.7 → "ai-generated" · 0.4–0.7 → "uncertain" · <0.4 → "authentic"
  │     ├── confidence = distance from 0.5 ambiguity midpoint, scaled 0–100
  │     └── builds flags[] + explanation string
  │
  ├─► coerceImageRiskScore() — enforces cross-field consistency
  │     ├── ai-generated → riskScore = Math.max(riskScore, 60)
  │     ├── authentic    → riskScore = Math.min(riskScore, 40)
  │     └── uncertain     → riskScore clamped to 40–70 band
  │
  ├─► modelLabel attached from getSightengineModelLabel() (SIGHTENGINE_MODEL_LABEL env var, default "SightEngine")
  │
  ├─► Cache write to Redis, 24 h TTL (fire-and-forget)
  │
  └─► JSON response → ImageDebunkResult (X-Cache: MISS)
        ├── classification: ai-generated | authentic | uncertain
        ├── confidence: 0–100
        ├── riskScore: 0–100 (coerced for consistency with classification)
        ├── safe: boolean (riskScore < 50 AND not ai-generated)
        ├── summary, flags, explanation
        └── source: "sightengine", modelLabel
```

### QR Code Scanner (client-side decode → `POST /api/validate-url` on URL content)

```
Browser (client-side only — no new API route)
  │
  ├─► User uploads an image OR starts the camera
  │     ├── Upload: draw to <canvas> → ctx.getImageData()
  │     └── Camera: getUserMedia() → <video> → rAF loop throttled to ~12.5 fps →
  │           draw frame to <canvas> → ctx.getImageData()
  │
  ├─► jsQR(imageData, opts) — pure-JS decode, dynamically imported once, shared
  │     between upload ("attemptBoth") and camera ("dontInvert") via a cached ref
  │     └── No match → "No QR code found" (upload) / loop continues (camera)
  │
  ├─► classifyQrContent(raw) — src/lib/qr-content.ts, pure + DOM-free
  │     ├── tel: / mailto: / WIFI: schemes parsed (wifi password never extracted)
  │     ├── http(s):// or bare-domain pattern → { kind: "url" }
  │     └── everything else (incl. javascript:/data: — regression-guarded) → { kind: "text" }
  │
  └─► Route on classification:
        ├── kind: "url"  → POST /api/validate-url { url } (same pipeline as the
        │                   URL tool above) → <UrlResultCard>
        └── kind: other  → decoded content displayed as-is via <QrContentCard>,
                            never auto-navigated/auto-connected/auto-dialled
```

No server-side image processing, no new environment variables — decoding happens entirely
in the browser; only URL-classified content is ever sent to the server (as a string, to the
existing `/api/validate-url` route).

### Smart Universal Input (client-side routing → the existing API routes)

```
Homepage hero box (<SmartInput/>)
  │  detectInputKind() runs locally on every keystroke, only to show a hint
  │
  ├─► Submit → sessionStorage["itv_smart_input"] = value, router.push("/check/any")
  │     (never a query string — pasted messages contain names, account numbers,
  │      one-time codes, and Referrer-Policy is only strict-origin-when-cross-origin)
  │
/check/any (<useSmartCheck/>)
  │
  ├─► takeSmartInput() — reads AND deletes in one step, cached in a ref because
  │     StrictMode double-invokes the mount effect
  │
  ├─► detectInputKind(raw) — src/lib/input-router.ts, pure + DOM-free
  │     ordered precedence chain:
  │       1. empty                        → text
  │       2. javascript:/data:/file:/     → text  (NEVER url — security regression)
  │          vbscript:/blob:
  │       3. mailto: → email, tel: → phone
  │       4. IPv4 literal                 → url   (BEFORE phone: dots are phone separators)
  │       5. phone shape, 7–15 digits     → phone (BEFORE prose: "+1 555 123 4567" has spaces)
  │       6. contains whitespace          → text  (prose)
  │       7. matches email shape          → email ("@" beats bare-domain)
  │       8. http(s)://                   → url
  │       9. bare domain, alphabetic TLD  → url
  │      10. fallback                     → text
  │
  ├─► PRIMARY CHECK — runs alone, first (one of the five existing routes)
  │       email → POST /api/validate       │ url   → POST /api/validate-url
  │       phone → POST /api/validate-phone │ text  → POST /api/debunk/text
  │     Pre-flight length guards mirror each route's Zod schema so an over-long
  │     paste gets a friendly message instead of a raw 422.
  │
  └─► FAN-OUT — only when kind === "text"; runs even if the primary FAILED
        │  (a 503 with no ANTHROPIC_API_KEY still leaves the links worth checking)
        │
        ├─► extractUrls(msg)   — mask emails → match → strip trailing punctuation →
        │     dedupe (case-insensitive) → keep only candidates passing
        │     validateUrlLocal().checks.parseable && .validTld, and (for bare
        │     domains only) a TLD in EXTRACTABLE_TLDS
        │       ├── first 3 (MAX_AUTO_URL_CHECKS) → Promise.allSettled →
        │       │     POST /api/validate-url → <UrlResultCard variant="nested">
        │       └── the rest → listed as "not checked automatically"
        │
        └─► extractPhones(msg) — mask emails AND urls → match → keep only candidates
              passing validatePhoneLocal().checks.parseable && .valid
                └── first 3 → rendered as buttons, status "idle".
                    Dispatched to POST /api/validate-phone ONLY on click
                    (paid provider quota — never automatic).
```

**Rate-limit budget.** `checkRateLimit` is a single 20/min sliding window under the
Redis prefix `itv:rl`, shared by all five API routes and keyed on raw IP. Fan-out spends
from that same budget, hence the hard cap: worst case is 1 primary + 3 sub-checks = 4 of 20.
Each sub-check owns its own error state — a 429 or 502 renders an inline row and never
touches the primary card.

**Why client-side.** The network helpers (`resolveMx`, `checkResolves`, `checkDomainAge`,
`checkSafeBrowsing`, `isPrivateHost`) are module-private to their `route.ts` files, and the
entire text-debunk LLM pipeline (`SYSTEM_PROMPT`, `DebunkResponseSchema`, `coerceRiskScore`,
`cacheKey`) is private to `src/app/api/debunk/text/route.ts`. A server-side aggregator would
duplicate ~150 lines including the LLM prompt, creating two sources of truth for invariants
this document treats as regression-critical. No new API route, no new env vars.

### PWA + Text Share Target

```
Android share sheet ("Share → IsThisValid")
  │
  ├─► POST /share  (multipart/form-data: title, text, url)
  │     NOT under /api/ — src/proxy.ts matches /api/:path* and 403s browser
  │     requests from unrecognised origins; an OS share POST has an unreliable Origin
  │
  ├─► composeSharedText() — prefer `text`, else `title`; append `url` if it adds
  │     something new; truncate to 3000 chars
  │
  ├─► Set-Cookie itv_share = base64(payload)
  │     httpOnly: false (the client must read it), sameSite: lax, path: /,
  │     maxAge: 60, secure in production. Shrunk until it fits under ~4 KB.
  │
  ├─► 303 See Other → /share/handoff
  │     303 (not 200) is what stops the POST becoming a re-submittable history entry
  │
  └─► /share/handoff (client)
        read cookie → expire it immediately → sessionStorage["itv_smart_input"]
        → router.replace("/check/any")   (replace, not push — no back-stack entry)
```

- **Text-only. No service worker anywhere in the repo.** Shared _files_ are out of scope;
  images keep using the normal upload flow on `/check/image`.
- **Manifest is a static `public/manifest.json`**, not `src/app/manifest.ts`: Next 16 types
  `share_target.params.files` as the DOM `File` type rather than the spec's
  `{ name, accept }[]`.
- **iOS/Safari does not implement the Web Share Target API at all.** The manifest still
  buys an installable home-screen app with a standalone display mode and a proper icon
  there, but "Share → IsThisValid" will not appear in the iOS share sheet. Android/Chrome
  gets the full flow.
- Icons are generated from the `SiteLogo` diamond by `npm run generate-icons`.

## File Structure

```
src/
├── app/
│   ├── api/validate/route.ts        # POST handler, Zod validation, graceful API fallback
│   ├── about/page.tsx               # /about — site description, funding disclosure (Ko-fi + future ads)
│   ├── privacy/page.tsx             # /privacy — GDPR/CCPA-compliant privacy policy
│   ├── terms/page.tsx               # /terms — terms of service
│   ├── check/
│   │   ├── email/
│   │   │   ├── layout.tsx           # Email tool metadata
│   │   │   └── page.tsx             # /check/email — full email validator (client)
│   │   ├── url/
│   │   │   ├── layout.tsx           # URL tool metadata
│   │   │   └── page.tsx             # /check/url — URL safety checker
│   │   ├── text/
│   │   │   ├── layout.tsx           # Text tool metadata
│   │   │   └── page.tsx             # /check/text — SMS/text scam debunker (production, Claude-powered)
│   │   ├── image/
│   │   │   ├── layout.tsx           # Image tool metadata
│   │   │   └── page.tsx             # /check/image — image authenticity checker (SightEngine)
│   │   ├── qr/
│   │   │   ├── layout.tsx           # QR tool metadata
│   │   │   └── page.tsx             # /check/qr — QR code scanner (upload + live camera, client-side decode)
│   │   └── any/
│   │       ├── layout.tsx           # Smart Check metadata
│   │       └── page.tsx             # /check/any — smart universal input + composite result view (client)
│   ├── share/
│   │   ├── route.ts                 # POST — Web Share Target receiver; sets itv_share cookie, 303s to handoff
│   │   └── handoff/
│   │       ├── layout.tsx           # noindex metadata
│   │       └── page.tsx             # Cookie → sessionStorage → router.replace("/check/any")
│   ├── layout.tsx                   # Root layout: SEO metadata, Schema.org, AdSense script,
│   │                                #   SiteFooter + CookieConsent rendered globally
│   ├── page.tsx                     # Hub page — <SmartInput/> hero + tool picker grid (server component)
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
│   ├── SmartInput.tsx               # Homepage "paste anything" box; live kind hint, sessionStorage handoff
│   ├── TextFAQ.tsx                  # FAQ accordion for the text/SMS tool
│   ├── TextResultCard.tsx           # Classification badge, risk score, flags, explanation (text) + NordVPN affiliate nudge
│   ├── UrlFAQ.tsx                   # FAQ accordion for the URL checker tool
│   ├── UrlResultCard.tsx            # Score ring, check grid, flags list (URL) + NordVPN affiliate nudge
│   ├── PhoneFAQ.tsx                 # FAQ accordion for the phone validator (teal accent)
│   ├── PhoneForm.tsx                # Phone number input form (teal accent)
│   ├── PhoneResultCard.tsx          # Score ring, line-type badge, carrier details, NANP callout
│   ├── ImageFAQ.tsx                 # FAQ accordion for the image tool (emerald accent)
│   ├── ImageResultCard.tsx          # Classification badge, risk score, flags, explanation (image) — Ko-fi only, no affiliate nudge
│   ├── QrFAQ.tsx                    # FAQ accordion for the QR tool (cyan accent)
│   ├── QrContentCard.tsx            # Displays non-URL decoded QR content (tel/email/wifi/text) — never auto-acted on
│   └── ScoreRing.tsx                # Shared 0–100 ring (56×56, radius 20, -rotate-90) used by all 5 result cards —
│                                     #   callers pass their own resolved `ringColor`; `trackColor` defaults to
│                                     #   zinc-800, UrlResultCard overrides to zinc-700
├── proxy.ts                         # CORS enforcement / middleware (Next.js 16 convention)
├── hooks/
│   ├── useQrScanner.ts              # Camera capture, upload decode (jsQR), classification + /api/validate-url
│   │                                 #   routing for the QR tool — keeps check/qr/page.tsx render-only
│   └── useSmartCheck.ts             # Smart Check state machine: primary check + URL/phone fan-out,
│                                     #   per-sub-check error isolation, stale-run guard
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
    ├── image-debunker.ts            # Types + Zod schema for ImageDebunkResult; normalizeProviderResponse, coerceImageRiskScore,
    │                                #   isAcceptedMimeType, MAX_IMAGE_BYTES (4 MB), SAFE_RISK_THRESHOLD
    ├── image-faq-data.ts            # FAQ Q&A for image tool — consumed by ImageFAQ.tsx
    ├── sightengine-client.ts        # SightEngine API client: callSightengine, isSightengineConfigured, getSightengineModelLabel;
    │                                #   3 retries with exponential backoff on 429/5xx/network errors
    ├── qr-content.ts                # Pure classifier: classifyQrContent(raw) → QrContent discriminated union
    │                                #   (url/tel/email/wifi/text); DOM-free, wifi password never extracted
    ├── qr-faq-data.ts               # FAQ Q&A for QR tool — consumed by QrFAQ.tsx + FAQPage JSON-LD
    ├── input-router.ts              # Pure router: detectInputKind(raw) → DetectedInput (email/url/phone/text);
    │                                #   extractUrls / extractPhones for prose; MAX_AUTO_URL_CHECKS = 3;
    │                                #   EXTRACTABLE_TLDS allowlist; dangerous schemes never classified as url
    ├── smart-input-handoff.ts       # SMART_INPUT_KEY / SHARE_COOKIE; stashSmartInput / takeSmartInput
    │                                #   (read-once sessionStorage, deleted on read — never a query string)
    ├── result-card-variant.ts       # ResultCardVariant ("standalone" | "primary" | "nested") + showsKofi/showsAffiliate
    └── rate-limit.ts                # Upstash Redis: checkRateLimit (20/min), checkDailyTextLimit (20/day), checkDailyImageLimit (10/day);
                                     #   getRedis() shared client
__tests__/
├── debunk-text-route.test.ts        # Jest unit tests: POST /api/debunk/text route (45 tests)
├── debunk-image-route.test.ts       # Jest unit tests: POST /api/debunk/image route — rate limit, daily cap,
    #   cache hit/miss, MIME/size validation, SightEngine mocked (27 tests)
├── email-validator.test.ts          # Jest unit tests: validateEmailLocal, applyMxResult, mergeSmtpResult, mergeEmailableResult, role prefixes, plus-addressed role check, expanded typo map, RFC 5321 dot rules, typo score cap, exact scoring, case normalization, DISPOSABLE_DOMAINS (161 tests)
├── image-debunker.test.ts           # Jest unit tests: normalizeProviderResponse, coerceImageRiskScore,
    #   isAcceptedMimeType, classification thresholds, confidence scaling (46 tests)
├── phone-validator.test.ts          # Jest unit tests: validatePhoneLocal, applyCarrierResult, getLineTypeBonus,
    #   format parsing, validity, country detection, line-type scoring, flags, Caribbean NANP,
    #   area-code location, applyCarrierResult score swap, VOIP reclassification (70 tests)
├── input-router.test.ts             # Jest unit tests: detectInputKind precedence chain, extractUrls / extractPhones;
    #   dangerous-scheme regression guard, IPv4-before-phone, "@" beats bare-domain,
    #   prose false-positive rejection, fan-out cap constants (52 tests)
├── share-route.test.ts              # Jest unit tests: POST/GET /share — composeSharedText, 303 redirect,
    #   cookie flags, UTF-8 + delimiter round-trip, oversize shrink, no content in the URL (17 tests)
├── qr-content.test.ts               # Jest unit tests: classifyQrContent — url/tel/email/wifi/text classification,
    #   wifi password never surfaced, javascript:/data: regression guard (16 tests)
├── smtp-cache.test.ts               # Jest unit tests: getCachedSmtpResult, setCachedSmtpResult — Redis mocked (15 tests)
└── url-validator.test.ts            # Jest unit tests: validateUrlLocal, applyHeadResult, applySafeBrowsingResult,
    #   applyRdapResult, applyRedirectResult; getRegisteredDomain, checkBrandSquat, checkTyposquat;
    #   notHighEntropy, notExcessiveHyphens, IP edge cases, ccTLD coverage (113 tests)
```

**Total: 563 tests** (161 email + 113 URL + 71 phone + 52 input-router + 45 text + 46 image-debunker + 27 image-route + 17 share-route + 16 qr-content + 15 smtp-cache)

Jest runs with `testEnvironment: "node"` and no jsdom, so component tests are not possible —
logic worth testing lives in pure libs (`input-router.ts`, `qr-content.ts`, the validators).

```
public/
├── og-image.png                     # 1200×630 Open Graph image (npm run generate-og)
├── manifest.json                    # PWA manifest — icons, shortcuts, text-only share_target
└── icons/                           # npm run generate-icons (from the SiteLogo diamond)
    ├── icon-192.png                 # 192×192, purpose "any"
    ├── icon-512.png                 # 512×512, purpose "any"
    ├── icon-maskable-512.png        # 512×512, purpose "maskable" (diamond at 60% for the safe zone)
    └── apple-touch-icon.png         # 180×180 — iOS home screen
scripts/
├── generate-og.mjs                  # SVG → sharp → PNG
└── generate-icons.mjs               # SVG → sharp → PNG; re-run if SiteLogo.tsx changes
```

## Monorepo Structure & React Native Client (`apps/mobile`)

The repo is an **npm workspace root** (`"workspaces": ["packages/*", "apps/*"]` in the root `package.json`). The Next.js web app deliberately **stays at the repo root** — the root `package.json` is still the web app's own manifest — so Vercel's project settings, CI paths, and every existing script are untouched by this. `packages/core` and `apps/mobile` are new sibling directories, resolved into `node_modules/@isthisvalid/*` as symlinks by `npm install`, no publishing involved.

```
isthisvalid/
├── package.json          # web app + "workspaces": ["packages/*", "apps/*"]
├── src/, __tests__/       # web app — unchanged
├── packages/
│   └── core/              # @isthisvalid/core — shared pure validation logic
│       ├── package.json   # exports map, one subpath per module (mirrors src/lib/* names)
│       ├── tsconfig.json   # standalone: no DOM lib, no jsx — pure TS only
│       └── src/            # email-validator, url-validator, phone-validator, input-router,
│                            #   qr-content, result-card-variant, affiliate-links, *-faq-data,
│                            #   us-area-codes (+ data/us-area-codes.json), disposable-domains,
│                            #   text-debunker, image-debunker
└── apps/
    └── mobile/             # @isthisvalid/mobile — Expo + Expo Router client
```

**`packages/core`** holds every pure-TypeScript file that used to live in `src/lib/` — no DOM, no Node-only APIs, no server-only imports (verified file-by-file before the move). It's consumed two ways:

- **`apps/web`** (this Next.js app): `src/lib/<name>.ts` is now a one-line re-export shim — `export * from "@isthisvalid/core/<name>";` — so every existing import (`@/lib/email-validator`, all 563 Jest tests, every API route) is untouched. `next.config.ts` sets `transpilePackages: ["@isthisvalid/core"]` so Next transpiles it from source; `jest.config.ts` maps `@isthisvalid/core/*` straight to `packages/core/src/*.ts`, bypassing the workspace symlink for the test runner.
- **`apps/mobile`**: imports `@isthisvalid/core/*` directly (e.g. `@isthisvalid/core/email-validator`) for both types (parsing `/api/*` JSON responses) and the local/instant-feedback phase (e.g. `validateEmailLocal` runs on-device before the network call, mirroring the web app's progressive-enrichment pattern).

The one cross-file fix this required: `email-validator.ts` used to import `SmtpVerifyResult` from the server-only `smtp-provider.ts`. That's backwards for a shared package (it would make `packages/core` depend on app-only code), so `SmtpVerifyResult` is now defined in `packages/core/src/email-validator.ts`, and `src/lib/smtp-provider.ts` imports it from there instead.

**`apps/mobile`** is an Expo (Expo Router, `src/app/*` file-based routes) app that calls the **existing** `/api/validate`, `/api/validate-url`, `/api/validate-phone`, `/api/debunk/text`, `/api/debunk/image` routes over HTTP — no new backend, no duplicated scoring logic. `EXPO_PUBLIC_API_BASE_URL` (`.env.development` → `localhost:3000`, `.env.production` → `https://isthisvalid.com`) points it at the right origin; on a physical device (not a simulator) this needs the dev machine's LAN IP instead of `localhost`. `metro.config.js` sets explicit `watchFolders`/`nodeModulesPaths` so Metro picks up edits to `packages/core/src/*` without a restart. Styling is plain React Native `StyleSheet` with a small `src/constants/colors.ts` token file mirroring the web app's Tailwind hex values (zinc-950 background, amber-500 email accent, lime/yellow/rose result sentiment) — **not** NativeWind: NativeWind v4 only supports Tailwind CSS v3, and hoists to the workspace root `node_modules`, where its `tailwindcss` peer resolves to this repo's Tailwind v4 (used by the web app) instead of a pinned v3 — `npm overrides` cannot force a nested copy for an already-satisfied peer range. Revisit if NativeWind v5 (Tailwind v4 support) stabilizes.

All five tool screens are wired to their real API routes. `text.tsx` ports web's `TextCheckPage`/`TextResultCard`/`TextFAQ` closely, including the score ring (`react-native-svg`), the "What AI will detect" list, and the "Try an example" pre-baked result that never calls the API. `phone.tsx` ports web's `PhoneCheckPage`/`PhoneResultCard`/`PhoneFAQ`, including the rotated SVG score ring, the formatted-number detail grid (E.164/international/national/country/location/carrier), and the prominent Caribbean/NANP one-ring-scam callout pulled out of the generic flags list. `url.tsx` ports web's `UrlCheckPage`/`UrlResultCard`/`UrlFAQ`, including the stricter ≥80/≥50 sentiment thresholds than the other tools, the up-to-14-row check grid (neutral-bg rows — only the ✓/✗ glyph is colored, unlike the other tools' tinted rows), the Safe-Browsing-degraded warning, the redirect notice, and the flags-detected pill list. `image.tsx` ports web's `ImageCheckPage`/`ImageResultCard`/`ImageFAQ`/"What AI will detect" list, but swaps web's drag-and-drop `<input type="file">` for `expo-image-picker` (library-or-camera buttons, permission strings via its `app.json` config plugin) and POSTs `multipart/form-data` through a new `postFormData()` helper in `api-client.ts` (RN's `fetch` accepts a `{ uri, name, type }` object in place of a real `File`/`Blob`) — it's the only mobile tool screen whose input mechanism genuinely differs from web's. All five wired screens' result cards share one score-ring convention — a small 56×56px ring (radius 20, `-rotate-90`) in the header row, upper-right, next to the sentiment/classification badge, via the shared `ScoreRing.tsx` component. `ImageResultCard.tsx` and `TextResultCard.tsx` are thin per-tool config wrappers (classification labels, colors, copy) around one shared `ClassificationResultCard.tsx` — on web these are two separate near-duplicate files, so mobile collapsed them into one component from the start rather than porting the duplication. The home screen's quick-check input (`src/app/index.tsx`, mirrors web's `SmartInput`) runs `detectInputKind` from `@isthisvalid/core/input-router` locally and routes to the matching tool screen with the detected value passed as a route param, read back via `useLocalSearchParams` to prefill that screen's input — it does not reproduce web's `/check/any` fan-out (multi-entity extraction from prose, inline sub-results), which stays out of scope for mobile; Image is unreachable from it regardless, since `detectInputKind` only classifies pasted text. QR scanning and the Smart-Paste/share-target flow are out of scope for the mobile client: QR needs `expo-camera` + native barcode decoding (no shared code with the browser-`getUserMedia`-based `useQrScanner.ts`), and native apps use `Share`/deep-linking, a different mechanism than the web's `/share` cookie-handoff flow. `settings.tsx` links out to the existing web `/about`, `/privacy`, `/terms` pages via `expo-web-browser`'s in-app browser rather than porting their ~300–500 lines of static copy each to native screens — those pages carry legal weight and must stay a single source of truth, not two copies that can drift. It's reached from a ⚙️ icon in `_layout.tsx`'s `headerRight` on `index`, which otherwise keeps `headerTitle: ""` (header background matches the screen, so the bar is invisible and the home screen's hero still reads edge-to-edge).

Root ESLint (`eslint.config.mjs`) ignores `apps/mobile/**` — its Next-tuned rules (e.g. `no-require-imports`, which Metro's CJS config legitimately violates) don't apply there; `apps/mobile` has its own `expo lint` command and `eslint.config.js` (`eslint-config-expo`). Root `tsconfig.json` excludes `apps/mobile` from `npx tsc --noEmit` for the same reason (incompatible `lib`/`jsx` settings) — `packages/core` stays included and is typechecked transitively through the `src/lib/*` shims; `apps/mobile` needs its own `tsc --noEmit`, run separately (via Expo's own tooling), not yet wired into CI.

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
| `SIGHTENGINE_API_USER`                 | Yes\*    | SightEngine API user — powers the image authenticity checker (\*route returns 503 without it)                           |
| `SIGHTENGINE_API_SECRET`               | Yes\*    | SightEngine API secret — required alongside `SIGHTENGINE_API_USER`                                                      |
| `SIGHTENGINE_MODEL_LABEL`              | No       | Display label override for image tool results (default: `"SightEngine"`)                                                |
| `NEXT_PUBLIC_ADSENSE_ID`               | No       | Google AdSense publisher ID (`ca-pub-...`) — leave blank until approved                                                 |
| `NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL` | No       | ZeroBounce affiliate tracking URL — shown on email tool risky results                                                   |
| `NEXT_PUBLIC_NORDVPN_AFFILIATE_URL`    | No       | NordVPN affiliate tracking URL — shown on URL/text tool unsafe results                                                  |
| `NEXT_PUBLIC_KOFI_USERNAME`            | No       | Ko-fi username for donation link — link is hidden if not set                                                            |

## Affiliate Links

Contextual affiliate recommendations are shown to users after risky/unsafe results:

- **Email validator** → ZeroBounce (shown for risky/invalid results)
- **URL checker** → NordVPN (shown for suspicious/dangerous scores)
- **Text/SMS detector** → NordVPN (shown for unsafe results)

Affiliate links are always labelled with a visible "Affiliate" disclosure badge. No personal data is shared with affiliate partners. Tracking URLs are configured via environment variables:

- `NEXT_PUBLIC_ZEROBOUNCE_AFFILIATE_URL` — ZeroBounce tracking link
- `NEXT_PUBLIC_NORDVPN_AFFILIATE_URL` — NordVPN tracking link

Set these in `.env.local` (local dev) or Vercel environment variables (production) once affiliate accounts are approved.

## Donations

**Ko-fi voluntary donations** appear at the bottom of all result cards (email, URL, phone, SMS):

```
☕ Enjoying this? Support our work →
```

Clicking opens https://ko-fi.com/{username} in a new tab. Donors choose their own amount ($1+). Ko-fi takes 0% platform fees — users keep 98% of each donation (rest is payment processor). The donation link is controlled by `NEXT_PUBLIC_KOFI_USERNAME`:

- **Blank / not set:** Donation link is hidden (returns `null` from `KofiDonation.tsx` component)
- **Set to username:** Link appears on all result cards with coffee emoji and arrow

Implementation: [KofiDonation.tsx](src/components/KofiDonation.tsx) is imported in:

- [ResultCard.tsx](src/components/ResultCard.tsx) (email results)
- [TextResultCard.tsx](src/components/TextResultCard.tsx) (SMS scam results)
- [UrlResultCard.tsx](src/components/UrlResultCard.tsx) (URL safe/unsafe results)
- [PhoneResultCard.tsx](src/components/PhoneResultCard.tsx) (phone number results)
- [ImageResultCard.tsx](src/components/ImageResultCard.tsx) (image authenticity results)

The component renders conditionally and is positioned below affiliate nudges (which are shown only on risky/unsafe scores).

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

| Tool     | Accent   | Tailwind class    |
| -------- | -------- | ----------------- |
| Email    | Amber    | `amber-400/500`   |
| URL      | Sky blue | `sky-400/500`     |
| Text/SMS | Violet   | `violet-400/500`  |
| Phone    | Teal     | `teal-400/500`    |
| Image    | Emerald  | `emerald-400/500` |
| QR Code  | Cyan     | `cyan-400/500`    |

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

- [x] **Privacy Policy page** — `/privacy` covers AdSense cookies (future), third-party data,
      6 GDPR/CCPA rights (access, deletion, opt-out of sale, object to processing, portability, rectification + DPA complaint right), and cookie table
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

- **Per-IP sliding window** — 20 requests/min shared across `/api/validate`, `/api/validate-url`, `/api/validate-phone`, `/api/debunk/text`, and `/api/debunk/image`
- **Per-IP daily cap** — 20 requests/day on `/api/debunk/text` (LLM cost control); 10 requests/day on `/api/debunk/image` (lower than text's since SightEngine credits cost more per call at this scale)
- **Text result cache** — SHA-256 of the normalised message; 24 h TTL (`itv:text:<hash>`). Viral scam texts hit cache on second request, skipping Claude.
- **Image result cache** — SHA-256 of the raw image bytes; 24 h TTL (`itv:image:<hash>`). Cache hit returns immediately and does not consume the daily image cap. Image bytes themselves are never persisted — only the hash.
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
| SightEngine          | Free trial credits                | Paid per check      |

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
- [x] PWA manifest (`/manifest.json`) — installable, standalone display, maskable icon
- [x] `apple-touch-icon` + `appleWebApp` metadata for iOS home-screen installs
- [x] `/share/handoff` explicitly `noindex, nofollow` (transient redirect page)

## UI Architecture

**Hub-and-spoke model**: `/` is a tool-picker; each tool lives at its own route (`/check/*`).
This gives every tool its own `<h1>`, `<title>`, `<meta description>`, and JSON-LD —
maximising SEO value and deep-linkability.

```
/  (hub — Smart Check box + tool card grid)
├── /check/any     ← smart universal input; detects and routes to the tools below,
│                    and fans out sub-checks on links/numbers inside a pasted message
├── /check/email   ← full working tool
├── /check/url     ← full working tool
├── /check/text    ← full working tool (Claude-powered)
├── /check/phone   ← full working tool (libphonenumber + carrier API)
├── /check/image   ← full working tool (SightEngine AI detection)
└── /check/qr      ← full working tool (client-side jsQR decode, upload + camera)
```

`CheckShell` is a shared server component providing the back-nav and tool hero
for all `/check/*` pages. Each tool page supplies its own colour accent and copy;
`/check/any` uses the brand orange, deliberately not one of the six tool accents.

`/check/any` is the only page that stacks several result cards. It reuses the
existing cards verbatim via the `variant` prop (`src/lib/result-card-variant.ts`) —
`"primary"` for the headline verdict, `"nested"` for supporting sub-checks — so the
composite renders exactly one Ko-fi bar and at most one affiliate nudge. The default
`"standalone"` leaves all six single-tool pages untouched.

## Route Map

| Route                 | Type    | Purpose                                               |
| --------------------- | ------- | ----------------------------------------------------- |
| `/`                   | Static  | Hub — Smart Check box + tool picker grid              |
| `/check/any`          | Static  | Smart Check — paste anything, auto-routed             |
| `/check/email`        | Static  | Full email validator                                  |
| `/check/url`          | Static  | URL safety checker                                    |
| `/check/text`         | Static  | SMS / text scam analyser (Claude-powered)             |
| `/check/phone`        | Static  | Phone number validator                                |
| `/check/image`        | Static  | Image authenticity checker (SightEngine)              |
| `/check/qr`           | Static  | QR code scanner (upload + live camera, client-side)   |
| `/about`              | Static  | Site description, disclosure, contact                 |
| `/privacy`            | Static  | GDPR/CCPA privacy policy (AdSense required)           |
| `/terms`              | Static  | Terms of service                                      |
| `/api/validate`       | Dynamic | POST — email validation                               |
| `/api/validate-url`   | Dynamic | POST — URL safety check                               |
| `/api/validate-phone` | Dynamic | POST — phone number validation (Node.js runtime)      |
| `/api/debunk/text`    | Dynamic | POST — text/SMS scam analysis (Claude, cached)        |
| `/api/debunk/image`   | Dynamic | POST — image authenticity check (SightEngine, cached) |
| `/share`              | Dynamic | POST — Web Share Target receiver (303 → handoff)      |
| `/share/handoff`      | Static  | Cookie → sessionStorage bridge (noindex)              |
| `/manifest.json`      | Static  | PWA manifest (static file, not a route handler)       |
| `/sitemap.xml`        | Static  | Auto-generated sitemap                                |
| `/robots.txt`         | Static  | Auto-generated robots file                            |
