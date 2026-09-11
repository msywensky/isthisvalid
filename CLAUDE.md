# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: IsThisValid.com

A free, no-signup verification hub for email validation, URL safety checking, SMS/text scam detection (AI-powered), and phone number validation. Hosted on Vercel; serverless architecture with graceful degradation when external APIs are unavailable.

**Key constraint:** Main branch is production. All changes require a feature branch + PR approval before merging.

---

## Quick Commands

```bash
npm run dev                    # Start dev server at http://localhost:3000
npm run build                  # Production build (type-check + static generation)
npm test                       # Run all Jest suites (563 tests)
npx jest __tests__/email-validator.test.ts  # Single test file
npx jest -t "typosquat"       # Tests matching a pattern
npm run test:coverage         # Generate coverage report (→ coverage/)
npm run lint                  # ESLint
npm run test:watch            # Jest watch mode
```

**Important:** `npm run build` is the source of truth for TypeScript errors. Always run before declaring production-ready.

---

## Architecture: Four Validation Pipelines

The codebase implements a **progressive enrichment pattern**: cheap local checks first, then optional paid/slow APIs. Each pipeline uses immutable merge functions (no in-place mutations) and early exits to avoid expensive API calls when the result is already decisive.

### 1. Email Validation (`src/lib/email-validator.ts` → `POST /api/validate`)

- **Local phase** (free, <1ms): RFC 5322 regex, typo detection, disposable domain check (~57k domains)
- **MX check** (free, ~50ms DNS): Confirms domain has mail servers
- **SMTP cache** (Redis, 7-day TTL): Checks for repeat verifications before calling provider
- **Provider phase** (paid, ~500ms): ZeroBounce (preferred, 100 free/month) or Emailable fallback
- **Score formula**: 40 (syntax) + 15 (TLD) + 25 (not disposable) + 10 (not role) + 5 (MX) + 5 (SMTP deliverable) = max 100
- **Typo handling**: Domains matching `TYPO_MAP` cap score ≤65 unless `apiDeliverable === true`. Typo suggestions included in response.
- **Role addresses** (admin@, noreply@, etc.): `valid: true` but penalised in score. Plus-addressed roles (+bounce@admin) correctly strip the tag before lookup.

**Critical invariants:**

- `mergeSmtpResult`'s `valid` formula must include `local.checks.validTld`—do not remove it.
- Typo cap is ≤65, lifted only by SMTP `apiDeliverable`, not by `hasMx` alone.

### 2. URL Safety Check (`src/lib/url-validator.ts` → `POST /api/validate-url`)

- **Local phase** (free, <1ms): 54 brand squatting checks, typosquat detection (Levenshtein + symbol substitution), punycode homograph detection, excessive subdomains/hyphens, suspicious TLDs (15 high-abuse), high-entropy hostname (DGA detection), embedded credentials, shortener detection, phishing keywords
- **HEAD + RDAP** (parallel, free, ~500ms): Domain resolution + age check (newly registered <30 days flagged, score capped ≤70)
- **Redirect chain** (up to 5 hops): Destination flagged and merged; cross-domain redirects trigger additional validation
- **Safe Browsing** (optional, free 10k/day): Google's malware/phishing lists—skipped if score < 50 (already clearly dangerous)
- **Score formula**: Base 50, bonuses/penalties for each check, capped at [0–100]
- **Scoring order matters**: All bonuses applied BEFORE caps. Reordering score operations creates bypass bugs.

**Critical invariants:**

- `isPrivateHost()` must reject RFC-1918 addresses, loopback, .local, .internal, and private IPv6—SSRF guard.
- Safe Browsing failures cap score at 75 (not 0), allowing graceful degradation.
- Typosquat cap is ≤79; if score reaches 84, reorder so caps come last.

### 3. Phone Number Validation (`src/lib/phone-validator.ts` → `POST /api/validate-phone`)

- **Local phase** (free, instant): libphonenumber-js parsing, ITU-T validation, line-type detection (MOBILE, FIXED_LINE, VOIP, TOLL_FREE, PREMIUM_RATE, etc.), US area-code lookup, Caribbean NANP one-ring scam warning (+1 numbers outside US/CA/PR/GU/VI/AS/MP)
- **Carrier cache** (Redis, 30-day TTL): Checks for prior lookups before calling provider
- **Provider phase** (optional, ~8s timeout): AbstractAPI Phone Intelligence (preferred, 250 free/month) or NumVerify fallback (100 free/month; HTTP-only free tier)
- **Score formula**: Base 70 + bonuses (e.g. +10 for valid line type) − penalties (e.g. −30 for PREMIUM_RATE). NANP scam warning shown separately.

**Critical invariants:**

- Caribbean NANP warning preserved through carrier enrichment (`applyCarrierResult`).
- Line-type bonus/penalty swapped cleanly if API returns different type than local detection.
- E.164 normalisation must match exactly in all calls (hash cache, duplicate detection).
- `checks.validLength` reflects `isPossible()` (digit count) and `checks.validPattern` reflects `isValid()` (full pattern, e.g. NANP exchange codes can't start with 0/1)—don't alias both to `isValid()`, or a right-length-but-invalid-pattern number (e.g. `9001234534`) misreports its length as wrong.

### 4. Text/SMS Scam Detection (`src/app/api/debunk/text/route.ts` → `POST /api/debunk/text`)

- **Cache lookup** (Redis, 24-hour TTL, SHA-256 of normalised message): Hits return immediately—daily limit NOT consumed
- **Rate limits** (Upstash): 20/min (general), 20/day per IP (LLM cost protection). Daily cap only checked on cache miss.
- **Claude call** (Anthropic SDK, 30s timeout, configurable model/tokens): System prompt enforces scam detection expertise + prompt injection rules
- **Input sanitisation**: `[MSG]` / `[/MSG]` delimiters strip user-provided tags—prevents delimiter injection
- **Classification + risk score coercion** (`coerceRiskScore()`): Enforces consistency—scam/smishing ≥60, legit ≤40
- **Result** includes: `classification` (scam|smishing|spam|suspicious|legit), `riskScore` (0–100), `confidence`, flagged red-flag phrases, explanation, model label

**Critical invariants:**

- Cache check runs BEFORE daily spend cap—cache hits never burn quota.
- `SAFE_RISK_THRESHOLD = 50`; use this constant, not magic number 50.
- Claude JSON parsing must strip markdown code fences (`\`\`\`json ... \`\`\``).
- `DebunkResponseSchema` validates Claude's JSON—if Claude changes format, schema breaks. Test with actual Claude before deploying.

### 5. Image Authenticity Detection (`src/app/api/debunk/image/route.ts` → `POST /api/debunk/image`)

- **Cache lookup** (Redis, 24-hour TTL, SHA-256 of raw image bytes): Hits return immediately—daily limit NOT consumed
- **Rate limits** (Upstash): 20/min (general), 10/day per IP (API cost protection). Daily cap only checked on cache miss.
- **SightEngine call** (`src/lib/sightengine-client.ts`, 30s timeout, 3 retries): POSTs image bytes via multipart form; returns `ai_generated` probability (0–1)
- **Zod validation** (`SightengineRawResponseSchema`): Validates raw response before normalization; returns 502 on schema mismatch
- **Normalization + coercion** (`normalizeProviderResponse` → `coerceImageRiskScore`): Converts probability to classification + risk score; coercion enforces ai-generated ≥60, authentic ≤40, uncertain 40–70
- **Result** includes: `classification` (ai-generated|authentic|uncertain), `riskScore` (0–100), `confidence`, flags, explanation, `source: "sightengine"`, model label

**Critical invariants:**

- Cache lookup runs BEFORE `checkDailyImageLimit`—cache hits never burn quota.
- Image bytes are never persisted; only the SHA-256 hash is stored in Redis.
- `source: "sightengine"` is hardcoded on the result shape—update if provider changes.
- `coerceImageRiskScore` runs last, after `normalizeProviderResponse`.
- MIME type validated from `file.type` (not file extension)—use `isAcceptedMimeType()`.
- `SAFE_RISK_THRESHOLD = 50`; use this constant, not magic number 50.
- Daily limit is 10/day (intentionally lower than text's 20/day—SightEngine credits cost more per call than LLM tokens at this scale).

### 6. QR Code Scanner (`src/hooks/useQrScanner.ts` + `src/app/check/qr/page.tsx` — entirely client-side)

- **Decode** (free, in-browser, `useQrScanner()` hook — `src/hooks/useQrScanner.ts`): Upload an image or scan live via camera; both paths draw to a shared `<canvas>` and decode with `jsQR` (dynamically imported once, cached in a ref). Upload uses `inversionAttempts: "attemptBoth"`; the camera loop uses `"dontInvert"` and is throttled to ~12.5fps (`FRAME_INTERVAL_MS = 80`) to bound `getImageData` GC pressure. `check/qr/page.tsx` only renders based on the hook's returned state — it holds no decode/camera logic itself.
- **Classify** (`src/lib/qr-content.ts`, pure/DOM-free): `classifyQrContent(raw)` returns a discriminated union — `url` (http(s):// or bare-domain), `tel`, `email` (mailto:, `?subject=` stripped), `wifi` (SSID/encryption/hidden parsed; password `P:` never extracted), or `text` (everything else, including `javascript:`/`data:` schemes — never treated as a URL).
- **Route on classification**: `url` content is POSTed to the existing `/api/validate-url` route and rendered via `<UrlResultCard>` — no new API route, no new provider. Non-URL content is displayed via `<QrContentCard>` with safety notes; never auto-navigated, auto-connected, or auto-dialled.
- **No new environment variables.** No image bytes or camera frames ever leave the browser.

**Critical invariants:**

- The camera `MediaStream` must be stopped (`stopCamera()`) on decode success, on the Stop button, on reset, on switching to upload, and in a `useEffect` cleanup — a left-on camera light is the #1 regression risk here.
- `classifyQrContent` never returns `kind: "url"` for `javascript:`/`data:` schemes (regression-tested) — only `http://`/`https://`/bare-domain content is sent to `/api/validate-url`.
- Wifi QR parsing never surfaces the `P:` (password) field on the returned object.

### 7. Smart Universal Input (`src/lib/input-router.ts` + `src/hooks/useSmartCheck.ts` → `/check/any`)

The "paste anything" entry point. **Adds no API route, no provider, and no env vars** — it detects what the user pasted and calls the existing endpoints.

- **Detect** (`detectInputKind(raw)`, pure/sync/DOM-free): returns a discriminated union `email | url | phone | text` via an explicit ordered precedence chain (see invariants).
- **Route**: the primary check calls exactly one of `/api/validate`, `/api/validate-url`, `/api/validate-phone`, `/api/debunk/text`.
- **Fan out** (pasted messages only): `extractUrls()` / `extractPhones()` pull entities out of prose, filtering candidates through the free sync `validateUrlLocal` / `validatePhoneLocal`. The first `MAX_AUTO_URL_CHECKS` (3) links are checked automatically; the rest render as "not checked". Phones render as on-demand buttons — never dispatched automatically.
- **Orchestration is client-side** (`useSmartCheck`). Deliberate: the network helpers and the whole text-debunk LLM pipeline are module-private to their `route.ts` files, so a server aggregator would duplicate ~150 lines including `SYSTEM_PROMPT` and create a second source of truth for regression-critical invariants.
- **Handoff** (`src/lib/smart-input-handoff.ts`): the pasted value travels from the homepage box to `/check/any` through `sessionStorage` key `itv_smart_input`, read-once and deleted on read. **Never a query string** — pasted messages contain names, account numbers, and one-time codes, and `Referrer-Policy` is only `strict-origin-when-cross-origin`.

**Critical invariants:**

- **Precedence order is the correctness surface.** In `detectInputKind`: dangerous schemes (`javascript:`/`data:`/`file:`/`vbscript:`/`blob:`) are tested FIRST and always return `text` — never `url`. **IPv4 is tested BEFORE phone shape** (`192.168.1.1` is only digits and dots, and dots are phone separators, so the phone rule would otherwise claim it). Phone shape is tested BEFORE the prose test (`+1 555 123 4567` has spaces but is not prose). `@` beats bare-domain (`support@paypal.com` is an email).
- **`MAX_AUTO_URL_CHECKS = 3` is a rate-limit guard, not a UI preference.** `checkRateLimit` is a 20/min sliding window shared by all five routes under one Redis prefix. Worst case here is 1 primary + 3 sub-checks = 4 of 20. Raising it eats the user's whole budget on one link-heavy message.
- **Prose bare-domain extraction requires a TLD in `EXTRACTABLE_TLDS`.** `validateUrlLocal`'s `validTld` check is only "≥2 characters", so without the allowlist ordinary prose with a missing space ("delayed.Also confirm") parses as a domain and spends a real API call. Explicit `http(s)://` links bypass the allowlist.
- **Emails and URLs are masked out before scanning** — otherwise `support@paypal.com` also yields the bare domain `paypal.com`, and digits inside a tracking URL are read as a phone number.
- **Sub-checks are error-isolated.** A 429 or 502 on one link renders an inline row and never touches the primary card. Fan-out also runs when the primary check _failed_ (e.g. 503 with no `ANTHROPIC_API_KEY`), because the embedded links are still worth checking.
- `variant` on the result cards defaults to `"standalone"` — changing that default silently alters all five single-tool pages.

### 8. PWA + Text Share Target (`public/manifest.json` + `src/app/share/`)

- **Manifest** is a static `public/manifest.json`, **not** `src/app/manifest.ts`: Next 16 mistypes `share_target.params.files` as the DOM `File` type instead of the spec's `{ name, accept }[]`.
- **Text-only share target.** No service worker anywhere in the repo. Shared _files_ are out of scope; images keep using the normal upload flow.
- **Receiver is `/share`, deliberately NOT under `/api/`** — `src/proxy.ts` matches `/api/:path*` and 403s browser requests from unrecognised origins, and an OS-initiated share POST has an unreliable `Origin`.
- **Flow:** POST `/share` → compose one payload from `text`/`url`/`title` → base64 into the `itv_share` cookie (`maxAge: 60`, `sameSite: lax`, not httpOnly) → **303** to `/share/handoff` → client reads the cookie, expires it, writes `itv_smart_input`, `router.replace("/check/any")`.
- **iOS/Safari does not implement Web Share Target at all.** The manifest still gives an installable home-screen app with a proper icon there, but "Share → IsThisValid" will not appear in the iOS share sheet. Do not describe this as cross-platform in user-facing copy.
- **Icons** are generated by `npm run generate-icons` from the `SiteLogo` diamond. If the logo changes, re-run it.

**Critical invariants:**

- The 303 (not 200) is what stops the share POST becoming a re-submittable history entry; `/share/handoff` uses `router.replace`, not `push`.
- The share payload is never written to a query string, and the cookie is expired on first read.
- `next.config.ts` must keep `camera=(self)`, not `camera=()` — an **empty** allowlist disables the feature in the top-level document too, which blocks the QR scanner's own `getUserMedia`. Verify with `document.featurePolicy.allowsFeature("camera")`.

---

## Environment Variables & Graceful Degradation

**Core principle:** Every external API must degrade gracefully when its key is absent.

| Variable                               | Required?        | Graceful Fallback                         |
| -------------------------------------- | ---------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY`                    | Text tool only   | Route returns 503; text tool unavailable  |
| `ANTHROPIC_MODEL`                      | No               | Default: `claude-sonnet-4-20250514`       |
| `ANTHROPIC_MAX_TOKENS`                 | No               | Default: `1024`                           |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN`    | Rate limit/cache | No-op; rate limits + caching disabled     |
| `GOOGLE_SAFE_BROWSING_API_KEY`         | URL tool         | Safe Browsing skipped; local checks run   |
| `ZEROBOUNCE_API_KEY`                   | Email SMTP       | Falls back to Emailable or local+MX       |
| `EMAILABLE_API_KEY`                    | Email SMTP       | Ignored if ZeroBounce present             |
| `ABSTRACT_API_PHONE_KEY`               | Phone carrier    | Falls back to NumVerify or local-only     |
| `NUMVERIFY_API_KEY`                    | Phone carrier    | Ignored if AbstractAPI present            |
| `SIGHTENGINE_API_USER` + `_API_SECRET` | Image tool       | Route returns 503; image tool unavailable |
| `SIGHTENGINE_MODEL_LABEL`              | No               | Default: `"SightEngine"`                  |

**Code pattern:** All `getXxx()` functions (e.g. `getRedis()`, `getSmtpProvider()`, `getCarrierProvider()`) return `null` when not configured. Callers must handle null safely.

---

## Key Files & Patterns

### Rate Limiting & Caching (`src/lib/rate-limit.ts`)

- `checkRateLimit(ip)` — 20/min sliding window (shared across all tools)
- `checkDailyTextLimit(ip)` — 20/day fixed window (text/LLM cost protection)
- `checkDailyImageLimit(ip)` — 10/day fixed window (image/API cost protection)
- `getRedis()` — shared Redis client, or `null` if Upstash env vars absent

Never `await` cache writes in hot paths—use fire-and-forget:

```typescript
void setCachedSmtpResult(email, merged); // ✓ Correct
await setCachedSmtpResult(email, merged); // ✗ Adds latency
```

### SHA-256 Cache Keying

Raw PII is never stored in Redis:

```typescript
// Email: sha256(email.toLowerCase())
// Phone: sha256(e164NormalisedNumber)
// Text: sha256(normalised message, whitespace collapsed)
```

Cache keys follow convention: `itv:{tool}:{hash}` (e.g. `itv:smtp:abc123...`, `itv:phone:def456...`).

### Pluggable Providers

**SMTP:** `SmtpProvider` interface (ZeroBounceProvider, EmailableProvider). Factory: `getSmtpProvider()` returns configured provider or `null`.

**Carrier:** `CarrierProvider` interface (AbstractApiProvider, NumVerifyProvider). Factory: `getCarrierProvider()` returns configured provider or `null`.

No code changes needed to swap providers—controlled by env vars.

### LLM Client (`src/lib/llm-client.ts`)

- `callClaude(systemPrompt, userMessage, maxTokens?, timeoutMs?)` — handles retries on 529 Overloaded errors; returns `string | null`
- `isLlmConfigured()` — guard for routes that need Claude
- `getModelLabel()` — derives display label from model string (e.g. "Claude Sonnet 4.5")
- `AbortSignal.timeout(30_000)` prevents hanging on slow API

Model and token cap overridable via `ANTHROPIC_MODEL` and `ANTHROPIC_MAX_TOKENS` env vars at module load—enables cheaper/faster testing without code changes.

### Zod & Validation

- Use `z.safeParse()` in API routes—never `.parse()` (throws)
- Access errors via `.issues`, not `.errors` (Zod v4 breaking change; `.errors` is `undefined` at runtime)
- Response schemas in routes validate API payloads before merging into results

---

## Testing & Quality

All tests are pure unit tests—no network, no Redis, no filesystem. Jest mocks external dependencies.

**Test coverage:** 563 tests (161 email + 113 URL + 71 phone + 52 input-router + 45 text + 46 image-debunker + 27 image-route + 17 share-route + 16 qr-content + 15 smtp-cache)

Jest runs with `testEnvironment: "node"` and **no jsdom**, so component tests are not possible. Keep logic worth testing in pure libs (`input-router.ts`, `qr-content.ts`, the validators) rather than in hooks or components.

**Patterns:**

- Each validator check: passing case, failing case, score assertion, flag assertion, message assertion
- Bug regression tests in `describe("[Bug N regression]")` blocks
- Role-address tests: check +tag handling, case normalization
- Score edge cases: typo caps, TLD validity, disposable-domain flags

Example test structure:

```typescript
describe("validateEmailLocal", () => {
  it("passes a standard valid email", () => {
    const r = validateEmailLocal("user@example.com");
    expect(r.valid).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("flags mailinator.com as disposable", () => {
    const r = validateEmailLocal("throwaway@mailinator.com");
    expect(r.checks.notDisposable).toBe(false);
    expect(r.score).toBeLessThan(70);
  });
});
```

---

## TypeScript & Code Conventions

- **Strict mode always on.** Use `Record<string, unknown>` not `Record<string, any>`.
- **Immutability:** Result-merge functions return new objects—no in-place mutations.
- **`void` expression** to explicitly discard return values: `void cacheWrite(...)`.
- **Module-level constants** in `SCREAMING_SNAKE_CASE` (e.g. `ROLE_PREFIXES`, `SAFE_RISK_THRESHOLD`, `TYPO_MAP`).
- **Functions** in `camelCase` (e.g. `validateEmailLocal`, `applyMxResult`).
- **Error handling:** API routes catch all errors and return `NextResponse.json({ error: "..." }, { status: NNN })`. Lib functions return `null` on failure (not throw) for recoverable cases.

---

## Git Workflow

**Main branch is production. Never push to main directly.**

```bash
git checkout main
git pull origin main              # Always pull latest before branching
git checkout -b feat/your-feature
# ... make changes ...
git add <specific files>
git commit -m "feat: description"
git push -u origin feat/your-feature
gh pr create --base main --head feat/your-feature --title "..." --body "..."
# Wait for approval — do NOT merge yourself unless explicitly asked
```

The pre-commit hook (husky + lint-staged) runs **Prettier automatically** on staged files. Never manually reformat without committing the result—it creates orphan formatting diffs.

Prettier config: 2-space indent, double quotes, trailing commas, 80-char line width.

---

## Common Gotchas

| Symptom                                               | Likely Cause                                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Score is 100 for a `.con` typo address                | Typo cap escaped in `applyMxResult` or `mergeSmtpResult`                                                                                                         |
| `valid: true` on garbage-TLD address                  | `validTld` missing from `mergeSmtpResult`'s valid formula                                                                                                        |
| Typosquat URL scores 84 instead of ≤79                | Score bonus applied AFTER cap—reorder so caps come last                                                                                                          |
| Text tool returns 502                                 | Claude returned malformed JSON—check `DebunkResponseSchema` matches actual response                                                                              |
| Rate limit fires in local dev                         | `UPSTASH_REDIS_*` env vars set—clear them or use a dev Redis DB                                                                                                  |
| SMTP cache never hits                                 | Email normalisation mismatch, TTL expired, or `source === "local"` (cache excludes it)                                                                           |
| Safe Browsing returns 401                             | API key not enabled for "Safe Browsing API" in Google Cloud Console                                                                                              |
| `disposable-email-domains` import fails               | It's CJS/ESM hybrid—use `disposable-domains.ts` wrapper; don't import directly                                                                                   |
| Claude model 404                                      | Format is `claude-{variant}-{version}-{date}`, NOT `claude-{version}-{variant}-{date}`                                                                           |
| Smart Check opens with an empty box                   | The `itv_smart_input` handoff was consumed twice. `takeSmartInput()` is destructive and StrictMode double-invokes effects—cache the first read in a ref          |
| QR camera fails in production                         | `Permissions-Policy: camera=()` in `next.config.ts`—an empty allowlist blocks the top-level document too. Must be `camera=(self)`                                |
| Prose extraction returns junk "links"                 | A sentence with a missing space after a full stop matched the bare-domain regex—the TLD is missing from `EXTRACTABLE_TLDS`, or the allowlist check was skipped   |
| `192.168.1.1` detected as a phone                     | The IPv4 rule was moved after the phone-shape rule in `detectInputKind`                                                                                          |
| Phone "Valid length" shows X on a right-length number | `checks.validLength` was aliased to `isValid()` instead of `isPossible()`—a possible-but-invalid NANP number (e.g. bad exchange code) misreports as wrong length |
| Several Ko-fi bars on one page                        | A composite view passed `variant="standalone"` (or omitted it) on stacked cards                                                                                  |

---

## UI / Component Notes

- **Always-dark design** (zinc-950 background)—never introduce light-mode conditionals
- **Brand colour:** `orange-500` for CTAs; `orange-400` for links/accents
- **Score results:** `lime-500` (safe), `yellow-500` (suspicious), `rose-500` (dangerous)
- **Email tool accent:** `amber-400/500` (warm gold, distinct from brand orange)
- **Body text:** `zinc-400`—do NOT use `zinc-500` (fails WCAG AA contrast)
- **CheckShell** is a server component—keep it free of `useState`/`useEffect`
- **Affiliate nudges:** Use `AffiliateNudge.tsx`; shown only on risky/unsafe results; always labelled "Affiliate"
- **Smart Check accent:** `orange-400/500` (the brand colour) — deliberately not one of the six tool accents, since it is the generalist
- **Result-card `variant`** (`src/lib/result-card-variant.ts`): `"standalone"` (default — own Ko-fi bar + affiliate nudge), `"primary"` (composite headline card — nudge, no Ko-fi), `"nested"` (supporting card — neither). Use `showsKofi()` / `showsAffiliate()` rather than comparing the string. A composite view must render exactly one Ko-fi bar and at most one nudge.
- `KofiDonation` renders `null` unless `NEXT_PUBLIC_KOFI_USERNAME` is set, so it is invisible in local dev — that is not a bug.

---

## Adding a New Feature

1. Create feature branch from main (`git pull origin main` first)
2. Write code + tests
3. Run `npm run build` (0 errors), `npm test` (all pass), `npm run lint` (0 errors)
4. Add any new env vars to `.env.example` and Vercel dashboard
5. Update `CLAUDE.md` and `ARCHITECTURE.md` (mandatory, see below); update `DEVELOPER_GUIDE.md` and `README.md` if significant
6. Open PR; wait for approval before merging

---

## Documentation Must Stay Current

**`CLAUDE.md` and `ARCHITECTURE.md` must be kept up to date as part of finishing any coding task — not as a follow-up, not "if significant."** Before considering a coding task complete:

- If you added, removed, or changed a pipeline/route/lib file: update the relevant pipeline section and file structure listing in `ARCHITECTURE.md`, and the matching section in `CLAUDE.md`.
- If you added or changed an env var: update the Environment Variables table in both files (and `.env.example`).
- If you added or changed tests: update test counts/breakdowns in both files.
- If you changed a scoring formula, cache TTL, rate limit, or critical invariant: update the relevant bullet — these files are the source of truth other engineers (and future Claude sessions) rely on, and stale invariants cause real regressions.

Treat outdated `CLAUDE.md`/`ARCHITECTURE.md` content as a bug the same as a failing test. If a change makes something in either file inaccurate, fix it in the same PR — do not leave it for later.

---

## References

- **Full architecture details:** See `ARCHITECTURE.md` (data flows, error handling, scoring formulas)
- **Development setup:** See `DEVELOPER_GUIDE.md` (prerequisites, step-by-step, cost monitoring)
- **Copilot guidance:** See `.github/copilot-instructions.md` (tech stack, patterns, responsibilities)
- **README:** High-level features, deployment, cost estimates, affiliate model
